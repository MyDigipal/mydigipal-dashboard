from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_caching import Cache
from google.cloud import bigquery
from datetime import datetime, timedelta
import os
import traceback

# Dashboard API v2.2 - Materialized views + Flask-Caching for performance

app = Flask(__name__)
CORS(app)

# Initialize cache (5 minute cache for all endpoints)
cache = Cache(app, config={
    'CACHE_TYPE': 'simple',  # In-memory cache for Cloud Run (single worker)
    'CACHE_DEFAULT_TIMEOUT': 300  # 5 minutes
})

client = bigquery.Client(project='mydigipal')

def get_date_params():
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    return date_from, date_to

@app.route('/')
@cache.cached(timeout=300)
def health():
    return jsonify({"status": "ok", "service": "mydigipal-dashboard-api", "version": "2.2"})

@app.route('/api/clients')
@cache.cached(timeout=300, query_string=True)
def get_clients():
    date_from, date_to = get_date_params()
    include_paul = request.args.get('include_paul', 'false').lower() == 'true'

    params = []
    filters = []

    if date_from:
        filters.append("month >= @date_from")
        params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
    if date_to:
        filters.append("month <= @date_to")
        params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))

    # Build filter clauses for timesheet and invoice CTEs
    timesheet_filters = []
    invoice_filters = []

    if date_from:
        timesheet_filters.append("date >= @date_from")
        invoice_filters.append("month >= @date_from")
    if date_to:
        timesheet_filters.append("date <= @date_to")
        invoice_filters.append("month <= @date_to")

    # Filter out Paul's internal hours if requested
    if not include_paul:
        timesheet_filters.append("NOT (employee_id = 'paul' AND client_id = 'mydigipal')")

    timesheet_where = "WHERE " + " AND ".join(timesheet_filters) if timesheet_filters else ""
    invoice_where = "WHERE " + " AND ".join(invoice_filters) if invoice_filters else ""

    # Original query using FULL OUTER JOIN (materialized view not yet created)
    query = f"""
    WITH timesheet_data AS (
      SELECT
        DATE_TRUNC(date, MONTH) as month,
        client_id,
        SUM(hours) as hours,
        SUM(cost_gbp) as cost_gbp
      FROM `mydigipal.company.timesheets_with_cost`
      {timesheet_where}
      GROUP BY 1, 2
    ),
    invoice_data AS (
      SELECT
        month,
        client_id,
        SUM(real_revenue_gbp) as revenue_gbp
      FROM `mydigipal.company.invoices_fct`
      {invoice_where}
      GROUP BY 1, 2
    )
    SELECT
      COALESCE(t.client_id, i.client_id) as client_id,
      c.client_name,
      ROUND(SUM(COALESCE(t.hours, 0)), 0) as hours,
      ROUND(SUM(COALESCE(t.cost_gbp, 0)), 0) as cost,
      ROUND(SUM(COALESCE(i.revenue_gbp, 0)), 0) as revenue,
      ROUND(SUM(COALESCE(i.revenue_gbp, 0)) - SUM(COALESCE(t.cost_gbp, 0)), 0) as profit,
      ROUND((SUM(COALESCE(i.revenue_gbp, 0)) - SUM(COALESCE(t.cost_gbp, 0))) / NULLIF(SUM(COALESCE(i.revenue_gbp, 0)), 0) * 100, 0) as margin
    FROM timesheet_data t
    FULL OUTER JOIN invoice_data i ON t.client_id = i.client_id AND t.month = i.month
    LEFT JOIN `mydigipal.company.clients_dim` c ON COALESCE(t.client_id, i.client_id) = c.client_id
    WHERE COALESCE(t.client_id, i.client_id) IS NOT NULL
    GROUP BY 1, 2
    HAVING SUM(COALESCE(i.revenue_gbp, 0)) > 0 OR SUM(COALESCE(t.hours, 0)) > 100
    ORDER BY profit DESC
    """

    job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/clients-with-hours')
@cache.cached(timeout=300, query_string=True)
def get_clients_with_hours():
    """Get list of clients that have hours logged in the selected period"""
    date_from, date_to = get_date_params()
    
    params = []
    date_filter = ""
    
    if date_from:
        date_filter += " AND t.date >= @date_from"
        params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
    if date_to:
        date_filter += " AND t.date <= @date_to"
        params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))
    
    query = f"""
    SELECT 
      t.client_id,
      COALESCE(c.client_name, t.client_id) as client_name,
      ROUND(SUM(t.hours), 1) AS total_hours
    FROM `mydigipal.company.timesheets_fct` t
    LEFT JOIN `mydigipal.company.clients_dim` c ON t.client_id = c.client_id
    WHERE t.hours > 0 {date_filter}
    GROUP BY 1, 2
    HAVING SUM(t.hours) > 0
    ORDER BY 3 DESC
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/client-timeline/<client_id>')
@cache.cached(timeout=300, query_string=True)
def get_client_timeline(client_id):
    """Get daily hours breakdown by employee for a specific client"""
    try:
        date_from, date_to = get_date_params()
        
        params = [bigquery.ScalarQueryParameter("client_id", "STRING", client_id)]
        date_filter = ""
        
        if date_from:
            date_filter += " AND t.date >= @date_from"
            params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
        if date_to:
            date_filter += " AND t.date <= @date_to"
            params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))
        
        query_daily = f"""
        SELECT 
          FORMAT_DATE('%Y-%m-%d', t.date) as date,
          t.employee_id,
          COALESCE(e.employee_name, t.employee_id) as employee_name,
          ROUND(SUM(t.hours), 2) AS hours
        FROM `mydigipal.company.timesheets_fct` t
        LEFT JOIN `mydigipal.company.employees_dim` e ON t.employee_id = e.employee_id
        WHERE t.client_id = @client_id AND t.hours > 0 {date_filter}
        GROUP BY 1, 2, 3
        ORDER BY 1, 3
        """
        
        job_config = bigquery.QueryJobConfig(query_parameters=params)
        daily_rows = client.query(query_daily, job_config=job_config).result()
        daily_data = [dict(row) for row in daily_rows]
        
        query_totals = f"""
        SELECT 
          t.employee_id,
          COALESCE(e.employee_name, t.employee_id) as employee_name,
          ROUND(SUM(t.hours), 1) AS total_hours
        FROM `mydigipal.company.timesheets_fct` t
        LEFT JOIN `mydigipal.company.employees_dim` e ON t.employee_id = e.employee_id
        WHERE t.client_id = @client_id AND t.hours > 0 {date_filter}
        GROUP BY 1, 2
        ORDER BY 3 DESC
        """
        
        total_rows = client.query(query_totals, job_config=job_config).result()
        totals_data = [dict(row) for row in total_rows]
        
        query_client = f"""
        SELECT 
          COALESCE(c.client_name, @client_id) as client_name
        FROM `mydigipal.company.clients_dim` c
        WHERE c.client_id = @client_id
        """
        client_rows = list(client.query(query_client, job_config=job_config).result())
        client_name = client_rows[0]['client_name'] if client_rows else client_id
        
        return jsonify({
            "client_id": client_id,
            "client_name": client_name,
            "daily": daily_data,
            "totals": totals_data
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }), 500

@app.route('/api/budget-progress')
@cache.cached(timeout=300, query_string=True)
def get_budget_progress():
    """Get budget vs actual hours for the selected month with pace calculation"""
    try:
        month = request.args.get('month')
        if not month:
            month = datetime.now().strftime('%Y-%m')
        
        year, mon = month.split('-')
        month_start = f"{year}-{mon}-01"
        
        if int(mon) == 12:
            next_year = int(year) + 1
            next_month = 1
        else:
            next_year = int(year)
            next_month = int(mon) + 1
        month_end = f"{next_year}-{next_month:02d}-01"
        
        today = datetime.now()
        month_start_date = datetime(int(year), int(mon), 1)
        if int(mon) == 12:
            month_end_date = datetime(int(year) + 1, 1, 1)
        else:
            month_end_date = datetime(int(year), int(mon) + 1, 1)
        
        total_days = (month_end_date - month_start_date).days
        days_passed = min((today - month_start_date).days + 1, total_days)
        month_progress = days_passed / total_days if total_days > 0 else 1.0
        
        params = [
            bigquery.ScalarQueryParameter("month", "STRING", month),
            bigquery.ScalarQueryParameter("month_start", "DATE", month_start),
            bigquery.ScalarQueryParameter("month_end", "DATE", month_end)
        ]
        
        query = """
        WITH budgets AS (
          SELECT 
            b.client_id,
            COALESCE(c.client_name, b.client_id) as client_name,
            b.budgeted_hours,
            b.budget_type,
            b.notes
          FROM `mydigipal.company.clients_budgets` b
          LEFT JOIN `mydigipal.company.clients_dim` c ON b.client_id = c.client_id
          WHERE b.month = @month
        ),
        actuals AS (
          SELECT 
            t.client_id,
            ROUND(SUM(t.hours), 1) as actual_hours
          FROM `mydigipal.company.timesheets_fct` t
          WHERE t.date >= @month_start AND t.date < @month_end
          GROUP BY 1
        )
        SELECT 
          b.client_id,
          b.client_name,
          b.budgeted_hours,
          b.budget_type,
          b.notes,
          COALESCE(a.actual_hours, 0) as actual_hours
        FROM budgets b
        LEFT JOIN actuals a ON b.client_id = a.client_id
        ORDER BY b.budgeted_hours DESC
        """
        
        job_config = bigquery.QueryJobConfig(query_parameters=params)
        rows = client.query(query, job_config=job_config).result()
        
        result = []
        for row in rows:
            r = dict(row)
            budgeted = r['budgeted_hours']
            actual = r['actual_hours']
            
            r['remaining_hours'] = round(budgeted - actual, 1)
            expected_at_pace = round(budgeted * month_progress, 1)
            r['expected_hours'] = expected_at_pace
            
            pace_diff = actual - expected_at_pace
            r['pace_diff'] = round(pace_diff, 1)
            
            if actual >= budgeted:
                r['status'] = 'exceeded'
            elif pace_diff > budgeted * 0.1:
                r['status'] = 'warning'
            else:
                r['status'] = 'ok'
            
            r['progress_pct'] = round((actual / budgeted * 100) if budgeted > 0 else 0, 0)
            result.append(r)
        
        query_breakdown = """
        SELECT 
          t.client_id,
          t.employee_id,
          COALESCE(e.employee_name, t.employee_id) as employee_name,
          ROUND(SUM(t.hours), 1) as hours
        FROM `mydigipal.company.timesheets_fct` t
        LEFT JOIN `mydigipal.company.employees_dim` e ON t.employee_id = e.employee_id
        WHERE t.date >= @month_start AND t.date < @month_end
        GROUP BY 1, 2, 3
        HAVING SUM(t.hours) > 0
        ORDER BY 1, 4 DESC
        """
        breakdown_rows = client.query(query_breakdown, job_config=job_config).result()
        
        breakdown_by_client = {}
        for row in breakdown_rows:
            cid = row['client_id']
            if cid not in breakdown_by_client:
                breakdown_by_client[cid] = []
            breakdown_by_client[cid].append({
                'employee_id': row['employee_id'],
                'employee_name': row['employee_name'],
                'hours': row['hours']
            })
        
        for r in result:
            r['employees'] = breakdown_by_client.get(r['client_id'], [])
        
        return jsonify({
            "month": month,
            "days_in_month": total_days,
            "days_passed": days_passed,
            "month_progress_pct": round(month_progress * 100, 0),
            "clients": result
        })
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }), 500

@app.route('/api/budget-months')
@cache.cached(timeout=300)
def get_budget_months():
    """Get list of months that have budget data"""
    try:
        query = """
        SELECT DISTINCT month
        FROM `mydigipal.company.clients_budgets`
        ORDER BY month DESC
        """
        rows = client.query(query).result()
        months = [row['month'] for row in rows]
        return jsonify(months)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/monthly')
@cache.cached(timeout=300, query_string=True)
def get_monthly():
    date_from, date_to = get_date_params()
    include_paul = request.args.get('include_paul', 'false').lower() == 'true'

    params = []
    filters = []

    if date_from:
        filters.append("month >= @date_from")
        params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
    else:
        filters.append("month >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)")

    if date_to:
        filters.append("month <= @date_to")
        params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))

    # Filter out Paul's internal hours if requested
    if not include_paul:
        filters.append("NOT (employee_id = 'paul' AND client_id = 'mydigipal')")

    where_clause = "WHERE " + " AND ".join(filters) if filters else ""

    # v2.2: Use materialized view for 50-80% faster queries
    query = f"""
    SELECT
      FORMAT_DATE('%Y-%m', month) as month,
      ROUND(SUM(hours), 0) AS hours,
      ROUND(SUM(cost_gbp), 0) AS cost,
      ROUND(SUM(revenue_gbp), 0) AS revenue,
      ROUND(SUM(profit_gbp), 0) AS profit
    FROM `mydigipal.company.mv_client_profitability`
    {where_clause}
    GROUP BY 1
    ORDER BY 1
    """

    job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/employees')
@cache.cached(timeout=300, query_string=True)
def get_employees():
    date_from, date_to = get_date_params()
    
    params = []
    date_filter = ""
    
    if date_from:
        date_filter += " AND month >= @date_from"
        params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
    if date_to:
        date_filter += " AND month <= @date_to"
        params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))
    
    query = f"""
    SELECT 
      employee_id,
      COALESCE(employee_name, employee_id) as employee_name,
      ROUND(SUM(hours), 0) AS total_hours,
      ROUND(SUM(cost_gbp), 0) AS total_cost,
      COUNT(DISTINCT client_id) AS nb_clients
    FROM `mydigipal.reporting.vw_employee_workload`
    WHERE 1=1 {date_filter}
    GROUP BY 1, 2
    ORDER BY 3 DESC
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/employees-breakdown')
@cache.cached(timeout=300, query_string=True)
def get_employees_breakdown():
    """Get hours by employee broken down by client"""
    try:
        date_from, date_to = get_date_params()
        
        params = []
        date_filter = ""
        
        if date_from:
            date_filter += " AND month >= @date_from"
            params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
        if date_to:
            date_filter += " AND month <= @date_to"
            params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))
        
        query = f"""
        SELECT 
          employee_id,
          COALESCE(employee_name, employee_id) as employee_name,
          client_id,
          client_name,
          ROUND(SUM(hours), 0) AS total_hours
        FROM `mydigipal.reporting.vw_employee_workload`
        WHERE 1=1 {date_filter}
        GROUP BY 1, 2, 3, 4
        HAVING SUM(hours) > 0
        ORDER BY 2, 5 DESC
        """
        
        job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
        rows = client.query(query, job_config=job_config).result()
        
        result = []
        for row in rows:
            r = dict(row)
            r['hours'] = r.pop('total_hours')
            result.append(r)
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "error": str(e),
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }), 500

@app.route('/api/employee/<employee_id>')
@cache.cached(timeout=300, query_string=True)
def get_employee_detail(employee_id):
    date_from, date_to = get_date_params()
    
    params = [bigquery.ScalarQueryParameter("employee_id", "STRING", employee_id)]
    date_filter = ""
    
    if date_from:
        date_filter += " AND month >= @date_from"
        params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
    else:
        date_filter += " AND month >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)"
    
    if date_to:
        date_filter += " AND month <= @date_to"
        params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))
    
    query = f"""
    SELECT 
      FORMAT_DATE('%Y-%m', month) as month,
      client_name,
      hours,
      cost_gbp
    FROM `mydigipal.reporting.vw_employee_workload`
    WHERE employee_id = @employee_id {date_filter}
    ORDER BY 1 DESC, 3 DESC
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/client/<client_id>')
@cache.cached(timeout=300, query_string=True)
def get_client_detail(client_id):
    date_from, date_to = get_date_params()
    
    params = [bigquery.ScalarQueryParameter("client_id", "STRING", client_id)]
    date_filter = ""
    
    if date_from:
        date_filter += " AND month >= @date_from"
        params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
    if date_to:
        date_filter += " AND month <= @date_to"
        params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))
    
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    
    query1 = f"""
    SELECT 
      FORMAT_DATE('%Y-%m', month) as month,
      hours_worked as hours,
      cost_gbp as cost,
      revenue_gbp as revenue,
      profit_gbp as profit,
      margin_pct as margin
    FROM `mydigipal.reporting.vw_profitability`
    WHERE client_id = @client_id {date_filter}
    ORDER BY 1 DESC
    LIMIT 12
    """
    monthly = [dict(row) for row in client.query(query1, job_config=job_config).result()]
    
    query2 = f"""
    SELECT 
      e.employee_name,
      ROUND(SUM(w.hours), 0) as total_hours,
      ROUND(SUM(w.cost_gbp), 0) as cost
    FROM `mydigipal.reporting.vw_employee_workload` w
    LEFT JOIN `mydigipal.company.employees_dim` e ON w.employee_id = e.employee_id
    WHERE w.client_id = @client_id {date_filter}
    GROUP BY 1
    ORDER BY 2 DESC
    """
    team_rows = client.query(query2, job_config=job_config).result()
    team = []
    for row in team_rows:
        r = dict(row)
        r['hours'] = r.pop('total_hours')
        team.append(r)
    
    return jsonify({"monthly": monthly, "team": team})

@app.route('/api/alerts')
@cache.cached(timeout=300)
def get_alerts():
    query = """
    SELECT *
    FROM `mydigipal.reporting.vw_profitability_alerts`
    WHERE alert_type IN ('NO_REVENUE', 'LOSS', 'LOW_MARGIN')
    ORDER BY total_profit_gbp ASC
    LIMIT 20
    """
    rows = client.query(query).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/date-range')
@cache.cached(timeout=300)
def get_date_range():
    query = """
    SELECT
      FORMAT_DATE('%Y-%m-%d', MIN(month)) as min_date,
      FORMAT_DATE('%Y-%m-%d', MAX(month)) as max_date
    FROM `mydigipal.reporting.vw_profitability`
    """
    rows = list(client.query(query).result())
    if rows:
        return jsonify(dict(rows[0]))
    return jsonify({"min_date": "2024-01-01", "max_date": "2025-12-31"})

@app.route('/api/health/latest')
@cache.cached(timeout=60)  # 1 minute cache for health data
def get_health_latest():
    """Get latest health check for all data sources."""
    try:
        query = """
        WITH LatestCheck AS (
          SELECT MAX(check_timestamp) as latest_timestamp
          FROM `mydigipal.company.data_quality_logs`
        )
        SELECT
          check_timestamp,
          source_name,
          latest_data_date,
          days_lag,
          row_count_last_7d,
          row_count_avg_7d,
          conversions_last_7d,
          conversions_avg_7d,
          status,
          alert_reason
        FROM `mydigipal.company.data_quality_logs`
        WHERE check_timestamp = (SELECT latest_timestamp FROM LatestCheck)
        ORDER BY
          CASE status
            WHEN 'CRITICAL' THEN 1
            WHEN 'WARNING' THEN 2
            WHEN 'OK' THEN 3
          END,
          source_name
        """
        rows = client.query(query).result()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        print(f"Error fetching health data: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "Data quality table not found or empty"}), 404

@app.route('/api/health/history')
@cache.cached(timeout=300, query_string=True)  # 5 minute cache
def get_health_history():
    """Get health check history for specified number of days."""
    try:
        days = int(request.args.get('days', 30))

        query = """
        SELECT
          check_timestamp,
          source_name,
          latest_data_date,
          days_lag,
          row_count_last_7d,
          status,
          alert_reason
        FROM `mydigipal.company.data_quality_logs`
        WHERE check_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
        ORDER BY check_timestamp DESC, source_name
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("days", "INT64", days)
            ]
        )

        rows = client.query(query, job_config=job_config).result()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        print(f"Error fetching health history: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch health history"}), 500

# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@app.route('/api/analytics/clients')
@cache.cached(timeout=600)  # 10 minutes cache
def get_analytics_clients():
    """Get list of active clients for analytics - only those with at least one account mapped"""
    try:
        query = """
        SELECT
            client_id,
            company_name as client_name,
            alternative_name,
            category,
            country,
            language,
            active,
            google_ads_accounts,
            meta_ads_accounts,
            linkedin_ads_accounts,
            ga4_properties,
            gsc_domains
        FROM `mydigipal.company.client_accounts_mapping`
        WHERE active = TRUE
          AND (
            google_ads_accounts IS NOT NULL
            OR meta_ads_accounts IS NOT NULL
            OR linkedin_ads_accounts IS NOT NULL
            OR ga4_properties IS NOT NULL
            OR gsc_domains IS NOT NULL
          )
        ORDER BY company_name ASC
        """

        results = client.query(query).result()
        clients_list = []
        
        for row in results:
            client_data = dict(row)
            
            # Parse pipe-separated account strings into arrays for easier frontend handling
            if client_data.get('google_ads_accounts'):
                client_data['google_ads_accounts_list'] = [acc.strip() for acc in client_data['google_ads_accounts'].split('|')]
            else:
                client_data['google_ads_accounts_list'] = []
                
            if client_data.get('meta_ads_accounts'):
                client_data['meta_ads_accounts_list'] = [acc.strip() for acc in client_data['meta_ads_accounts'].split('|')]
            else:
                client_data['meta_ads_accounts_list'] = []
                
            if client_data.get('linkedin_ads_accounts'):
                client_data['linkedin_ads_accounts_list'] = [acc.strip() for acc in client_data['linkedin_ads_accounts'].split('|')]
            else:
                client_data['linkedin_ads_accounts_list'] = []
                
            if client_data.get('ga4_properties'):
                client_data['ga4_properties_list'] = [prop.strip() for prop in client_data['ga4_properties'].split('|')]
            else:
                client_data['ga4_properties_list'] = []
                
            if client_data.get('gsc_domains'):
                client_data['gsc_domains_list'] = [domain.strip() for domain in client_data['gsc_domains'].split('|')]
            else:
                client_data['gsc_domains_list'] = []
            
            clients_list.append(client_data)

        return jsonify(clients_list)
    except Exception as e:
        print(f"Error fetching analytics clients: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch clients"}), 500


@app.route('/api/analytics/meta-ads')
@cache.cached(timeout=300, query_string=True)  # 5 minutes cache
def get_meta_ads_analytics():
    """Get Meta Ads analytics for a client"""
    try:
        client_id = request.args.get('client_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')

        if not client_id or not date_from or not date_to:
            return jsonify({'error': 'Missing required parameters: client_id, date_from, date_to'}), 400

        # Get client mapping
        mapping_query = """
        SELECT meta_ads_accounts
        FROM `mydigipal.company.client_accounts_mapping`
        WHERE client_id = @client_id
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("client_id", "STRING", client_id)
            ]
        )

        mapping_result = client.query(mapping_query, job_config=job_config).result()
        mapping_row = next(mapping_result, None)

        if not mapping_row or not mapping_row.meta_ads_accounts:
            return jsonify({'error': 'No Meta Ads accounts found for this client'}), 404

        accounts = [acc.strip() for acc in mapping_row.meta_ads_accounts.split('|')]

        # Calculate period length for comparison
        from datetime import datetime as dt
        date_from_dt = dt.strptime(date_from, '%Y-%m-%d')
        date_to_dt = dt.strptime(date_to, '%Y-%m-%d')
        period_days = (date_to_dt - date_from_dt).days + 1

        # Get summary data with comparison to previous period
        summary_query = """
        WITH current_period AS (
            SELECT
                SUM(CAST(impressions AS INT64)) as total_impressions,
                SUM(CAST(clicks AS INT64)) as total_clicks,
                SAFE_DIVIDE(SUM(CAST(clicks AS INT64)), SUM(CAST(impressions AS INT64))) * 100 as avg_ctr,
                SUM(CAST(spend AS FLOAT64)) as total_spend,
                SAFE_DIVIDE(SUM(CAST(spend AS FLOAT64)), SUM(CAST(clicks AS INT64))) as avg_cpc,
                COUNTIF(actions IS NOT NULL AND JSON_EXTRACT_SCALAR(actions, '$[0].value') IS NOT NULL) as total_conversions
            FROM `mydigipal.meta_ads_v2.adsMetrics`
            WHERE account_name IN UNNEST(@accounts)
              AND date_start BETWEEN @date_from AND @date_to
        ),
        previous_period AS (
            SELECT
                SUM(CAST(impressions AS INT64)) as total_impressions,
                SUM(CAST(clicks AS INT64)) as total_clicks,
                SAFE_DIVIDE(SUM(CAST(clicks AS INT64)), SUM(CAST(impressions AS INT64))) * 100 as avg_ctr,
                SUM(CAST(spend AS FLOAT64)) as total_spend,
                SAFE_DIVIDE(SUM(CAST(spend AS FLOAT64)), SUM(CAST(clicks AS INT64))) as avg_cpc,
                COUNTIF(actions IS NOT NULL AND JSON_EXTRACT_SCALAR(actions, '$[0].value') IS NOT NULL) as total_conversions
            FROM `mydigipal.meta_ads_v2.adsMetrics`
            WHERE account_name IN UNNEST(@accounts)
              AND date_start BETWEEN DATE_SUB(CAST(@date_from AS DATE), INTERVAL @period_days DAY)
                                  AND DATE_SUB(CAST(@date_from AS DATE), INTERVAL 1 DAY)
        )
        SELECT
            COALESCE(c.total_impressions, 0) as total_impressions,
            COALESCE(c.total_clicks, 0) as total_clicks,
            COALESCE(c.avg_ctr, 0) as avg_ctr,
            COALESCE(c.total_spend, 0) as total_spend,
            COALESCE(c.avg_cpc, 0) as avg_cpc,
            COALESCE(c.total_conversions, 0) as total_conversions,
            ROUND(SAFE_DIVIDE((c.total_impressions - p.total_impressions), NULLIF(p.total_impressions, 0)) * 100, 1) as impressions_change,
            ROUND(SAFE_DIVIDE((c.total_clicks - p.total_clicks), NULLIF(p.total_clicks, 0)) * 100, 1) as clicks_change,
            ROUND(SAFE_DIVIDE((c.avg_ctr - p.avg_ctr), NULLIF(p.avg_ctr, 0)) * 100, 1) as ctr_change,
            ROUND(SAFE_DIVIDE((c.total_spend - p.total_spend), NULLIF(p.total_spend, 0)) * 100, 1) as spend_change,
            ROUND(SAFE_DIVIDE((c.avg_cpc - p.avg_cpc), NULLIF(p.avg_cpc, 0)) * 100, 1) as cpc_change,
            ROUND(SAFE_DIVIDE((c.total_conversions - p.total_conversions), NULLIF(p.total_conversions, 0)) * 100, 1) as conversions_change
        FROM current_period c, previous_period p
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ArrayQueryParameter("accounts", "STRING", accounts),
                bigquery.ScalarQueryParameter("date_from", "DATE", date_from),
                bigquery.ScalarQueryParameter("date_to", "DATE", date_to),
                bigquery.ScalarQueryParameter("period_days", "INT64", period_days)
            ]
        )

        summary_result = client.query(summary_query, job_config=job_config).result()
        summary = dict(next(summary_result))

        # Get timeline data
        timeline_query = """
        SELECT
            date_start as date,
            SUM(CAST(impressions AS INT64)) as impressions,
            SUM(CAST(clicks AS INT64)) as clicks,
            SUM(CAST(spend AS FLOAT64)) as spend
        FROM `mydigipal.meta_ads_v2.adsMetrics`
        WHERE account_name IN UNNEST(@accounts)
          AND date_start BETWEEN @date_from AND @date_to
        GROUP BY date_start
        ORDER BY date_start ASC
        """

        job_config_timeline = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ArrayQueryParameter("accounts", "STRING", accounts),
                bigquery.ScalarQueryParameter("date_from", "DATE", date_from),
                bigquery.ScalarQueryParameter("date_to", "DATE", date_to)
            ]
        )

        timeline_result = client.query(timeline_query, job_config=job_config_timeline).result()
        timeline = [dict(row) for row in timeline_result]

        # Get campaigns data
        campaigns_query = """
        SELECT
            campaign_name,
            SUM(CAST(impressions AS INT64)) as impressions,
            SUM(CAST(clicks AS INT64)) as clicks,
            SAFE_DIVIDE(SUM(CAST(clicks AS INT64)), SUM(CAST(impressions AS INT64))) * 100 as ctr,
            SUM(CAST(spend AS FLOAT64)) as spend,
            SAFE_DIVIDE(SUM(CAST(spend AS FLOAT64)), SUM(CAST(clicks AS INT64))) as cpc,
            COUNTIF(actions IS NOT NULL) as conversions
        FROM `mydigipal.meta_ads_v2.adsMetrics`
        WHERE account_name IN UNNEST(@accounts)
          AND date_start BETWEEN @date_from AND @date_to
        GROUP BY campaign_name
        ORDER BY spend DESC
        LIMIT 50
        """

        campaigns_result = client.query(campaigns_query, job_config=job_config_timeline).result()
        campaigns = [dict(row) for row in campaigns_result]

        # Get conversions by type from dedicated table
        conversions_query = """
        SELECT
            conversion_type as type,
            CAST(SUM(conversions) AS INT64) as count
        FROM `mydigipal.meta_ads_v2.adsMetricsWithConversionType`
        WHERE account_name IN UNNEST(@accounts)
          AND date_start BETWEEN @date_from AND @date_to
          AND conversions > 0
        GROUP BY conversion_type
        ORDER BY count DESC
        """

        conversions_result = client.query(conversions_query, job_config=job_config_timeline).result()
        conversions_by_type = [dict(row) for row in conversions_result if row['count'] > 0]

        # If no conversions data, create placeholder
        if not conversions_by_type:
            conversions_by_type = [{'type': 'No conversions tracked', 'count': 0}]

        return jsonify({
            'summary': summary,
            'timeline': timeline,
            'campaigns': campaigns,
            'conversions_by_type': conversions_by_type,
            'accounts': accounts
        })

    except Exception as e:
        print(f"Error fetching Meta Ads analytics: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to fetch Meta Ads data: {str(e)}"}), 500


@app.route('/api/analytics/google-ads')
@cache.cached(timeout=600, query_string=True)
def get_google_ads_analytics():
    try:
        client_id = request.args.get('client_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')

        if not client_id or not date_from or not date_to:
            return jsonify({"error": "Missing parameters"}), 400

        # Get client's Google Ads accounts from mapping
        mapping_query = """
        SELECT google_ads_accounts
        FROM `mydigipal.company.client_accounts_mapping`
        WHERE client_id = @client_id
        LIMIT 1
        """

        job_config_mapping = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("client_id", "STRING", client_id)
            ]
        )

        mapping_result = client.query(mapping_query, job_config=job_config_mapping).result()
        mapping_row = next(mapping_result, None)

        if not mapping_row or not mapping_row['google_ads_accounts']:
            return jsonify({"error": "No Google Ads accounts found for this client"}), 404

        # Parse accounts (pipe-separated)
        accounts = [acc.strip() for acc in mapping_row['google_ads_accounts'].split('|')]

        # Get summary data
        summary_query = """
        SELECT
            SUM(impressions) as total_impressions,
            SUM(clicks) as total_clicks,
            SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as avg_ctr,
            SUM(cost) as total_cost,
            SAFE_DIVIDE(SUM(cost), SUM(clicks)) as avg_cpc,
            SUM(conversions) as total_conversions,
            SUM(conversions_value) as total_conversion_value,
            SAFE_DIVIDE(SUM(cost), SUM(conversions)) as cost_per_conversion
        FROM `mydigipal.googleAds_v2.campaignPerformance`
        WHERE account IN UNNEST(@accounts)
          AND PARSE_DATE('%Y-%m-%d', date) BETWEEN @date_from AND @date_to
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ArrayQueryParameter("accounts", "STRING", accounts),
                bigquery.ScalarQueryParameter("date_from", "DATE", date_from),
                bigquery.ScalarQueryParameter("date_to", "DATE", date_to)
            ]
        )

        summary_result = client.query(summary_query, job_config=job_config).result()
        summary_row = next(summary_result, None)
        summary = dict(summary_row) if summary_row else {}

        # Get timeline data (daily aggregates)
        timeline_query = """
        SELECT
            PARSE_DATE('%Y-%m-%d', date) as date,
            SUM(impressions) as impressions,
            SUM(clicks) as clicks,
            SUM(cost) as cost
        FROM `mydigipal.googleAds_v2.campaignPerformance`
        WHERE account IN UNNEST(@accounts)
          AND PARSE_DATE('%Y-%m-%d', date) BETWEEN @date_from AND @date_to
        GROUP BY date
        ORDER BY date ASC
        """

        timeline_result = client.query(timeline_query, job_config=job_config).result()
        timeline = [dict(row) for row in timeline_result]

        # Get campaigns data
        campaigns_query = """
        SELECT
            campaign_name,
            SUM(impressions) as impressions,
            SUM(clicks) as clicks,
            SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as ctr,
            SUM(cost) as cost,
            SAFE_DIVIDE(SUM(cost), SUM(clicks)) as cpc,
            SUM(conversions) as conversions,
            SUM(conversions_value) as conversion_value
        FROM `mydigipal.googleAds_v2.campaignPerformance`
        WHERE account IN UNNEST(@accounts)
          AND PARSE_DATE('%Y-%m-%d', date) BETWEEN @date_from AND @date_to
        GROUP BY campaign_name
        ORDER BY cost DESC
        LIMIT 50
        """

        campaigns_result = client.query(campaigns_query, job_config=job_config).result()
        campaigns = [dict(row) for row in campaigns_result]

        # Get keywords data
        keywords_query = """
        SELECT
            keyword as keyword_text,
            SUM(impressions) as impressions,
            SUM(clicks) as clicks,
            SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100 as ctr,
            SUM(cost) as cost,
            SAFE_DIVIDE(SUM(cost), SUM(clicks)) as cpc,
            SUM(conversions) as conversions
        FROM `mydigipal.googleAds_v2.keywordPerformance`
        WHERE account IN UNNEST(@accounts)
          AND PARSE_DATE('%Y-%m-%d', date) BETWEEN @date_from AND @date_to
        GROUP BY keyword
        ORDER BY clicks DESC
        LIMIT 50
        """

        keywords_result = client.query(keywords_query, job_config=job_config).result()
        keywords = [dict(row) for row in keywords_result]

        # Get conversions by type
        conversions_query = """
        SELECT
            conversion_type as type,
            CAST(SUM(conversions) AS INT64) as count,
            SUM(conversions_value) as value
        FROM `mydigipal.googleAds_v2.campaignPerformanceWithConversionType`
        WHERE account IN UNNEST(@accounts)
          AND PARSE_DATE('%Y-%m-%d', date) BETWEEN @date_from AND @date_to
          AND conversions > 0
        GROUP BY conversion_type
        ORDER BY count DESC
        """

        conversions_result = client.query(conversions_query, job_config=job_config).result()
        conversions_by_type = [dict(row) for row in conversions_result if row['count'] > 0]

        if not conversions_by_type:
            conversions_by_type = [{'type': 'No conversions tracked', 'count': 0, 'value': 0}]

        return jsonify({
            'summary': summary,
            'timeline': timeline,
            'campaigns': campaigns,
            'keywords': keywords,
            'conversions_by_type': conversions_by_type,
            'accounts': accounts
        })

    except Exception as e:
        print(f"Error fetching Google Ads analytics: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to fetch Google Ads data: {str(e)}"}), 500


@app.route('/api/analytics/ga4')
@cache.cached(timeout=300, query_string=True)
def get_ga4_analytics():
    """Get Google Analytics 4 data for a specific property"""
    try:
        property_name = request.args.get('property')
        date_from = request.args.get('date_from', '2024-01-01')
        date_to = request.args.get('date_to', datetime.now().strftime('%Y-%m-%d'))

        if not property_name:
            return jsonify({"error": "Property name is required"}), 400

        # Convert date format for GA4 (YYYYMMDD)
        date_from_formatted = datetime.strptime(date_from, '%Y-%m-%d').strftime('%Y%m%d')
        date_to_formatted = datetime.strptime(date_to, '%Y-%m-%d').strftime('%Y%m%d')

        # Query parameters
        job_config = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("property_name", "STRING", property_name),
            bigquery.ScalarQueryParameter("date_from", "STRING", date_from_formatted),
            bigquery.ScalarQueryParameter("date_to", "STRING", date_to_formatted)
        ])

        # Get timeline data (aggregate duplicates)
        timeline_query = """
        SELECT
            date,
            SUM(CAST(sessions AS INT64)) as sessions,
            SUM(CAST(totalUsers AS INT64)) as users,
            SUM(CAST(screenPageViews AS INT64)) as pageviews,
            SUM(CAST(conversions AS INT64)) as conversions,
            AVG(bounceRate) as bounce_rate,
            AVG(engagementRate) as engagement_rate
        FROM `mydigipal.googleAnalytics_v2.date`
        WHERE property_name = @property_name
          AND date BETWEEN @date_from AND @date_to
        GROUP BY date
        ORDER BY date
        """

        timeline_result = client.query(timeline_query, job_config=job_config).result()
        timeline = [dict(row) for row in timeline_result]

        # Calculate summary
        summary = {
            'sessions': sum(row['sessions'] for row in timeline),
            'users': sum(row['users'] for row in timeline),
            'pageviews': sum(row['pageviews'] for row in timeline),
            'conversions': sum(row['conversions'] for row in timeline),
            'bounce_rate': sum(row['bounce_rate'] or 0 for row in timeline) / len(timeline) if timeline else 0,
            'engagement_rate': sum(row['engagement_rate'] or 0 for row in timeline) / len(timeline) if timeline else 0
        }

        # Get channel breakdown
        channels_query = """
        SELECT
            firstUserDefaultChannelGroup as channel,
            SUM(CAST(sessions AS INT64)) as sessions,
            SUM(CAST(totalUsers AS INT64)) as users,
            SUM(CAST(screenPageViews AS INT64)) as pageviews,
            SUM(CAST(conversions AS INT64)) as conversions
        FROM `mydigipal.googleAnalytics_v2.sessionChannel`
        WHERE property_name = @property_name
          AND date BETWEEN @date_from AND @date_to
        GROUP BY firstUserDefaultChannelGroup
        ORDER BY sessions DESC
        LIMIT 10
        """

        channels_result = client.query(channels_query, job_config=job_config).result()
        channels = [dict(row) for row in channels_result]

        # Get top landing pages
        landing_pages_query = """
        SELECT
            landingPage as page,
            SUM(CAST(sessions AS INT64)) as sessions,
            SUM(CAST(totalUsers AS INT64)) as users,
            AVG(bounceRate) as bounce_rate,
            AVG(engagementRate) as engagement_rate
        FROM `mydigipal.googleAnalytics_v2.landingPage`
        WHERE property_name = @property_name
          AND date BETWEEN @date_from AND @date_to
          AND landingPage IS NOT NULL
        GROUP BY landingPage
        ORDER BY sessions DESC
        LIMIT 20
        """

        landing_pages_result = client.query(landing_pages_query, job_config=job_config).result()
        landing_pages = [dict(row) for row in landing_pages_result]

        # Get demographics (device category, country)
        demographics_query = """
        SELECT
            deviceCategory as device,
            country,
            SUM(CAST(sessions AS INT64)) as sessions,
            SUM(CAST(totalUsers AS INT64)) as users
        FROM `mydigipal.googleAnalytics_v2.demographics`
        WHERE property_name = @property_name
          AND date BETWEEN @date_from AND @date_to
        GROUP BY deviceCategory, country
        ORDER BY sessions DESC
        LIMIT 20
        """

        demographics_result = client.query(demographics_query, job_config=job_config).result()
        demographics = [dict(row) for row in demographics_result]

        return jsonify({
            'summary': summary,
            'timeline': timeline,
            'channels': channels,
            'landing_pages': landing_pages,
            'demographics': demographics,
            'property_name': property_name
        })

    except Exception as e:
        print(f"Error fetching GA4 analytics: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to fetch GA4 data: {str(e)}"}), 500


@app.route('/api/analytics/search-console')
@cache.cached(timeout=600, query_string=True)
def get_search_console_data():
    """Get Search Console data for a specific client and date range using global tables"""
    try:
        client_id = request.args.get('client_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        domains_filter = request.args.get('domains')  # Optional: comma-separated list

        if not client_id:
            return jsonify({"error": "client_id is required"}), 400

        # Get client mapping
        mapping_query = """
        SELECT gsc_domains, company_name
        FROM `mydigipal.company.client_accounts_mapping`
        WHERE client_id = @client_id
        """
        job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("client_id", "STRING", client_id)])
        mapping_result = client.query(mapping_query, job_config=job_config).result()
        mapping_row = next(mapping_result, None)

        if not mapping_row or not mapping_row.gsc_domains:
            return jsonify({"error": f"No Search Console domains found for client: {client_id}"}), 404

        available_domains = [domain.strip() for domain in mapping_row.gsc_domains.split('|')]
        
        if domains_filter:
            requested_domains = [d.strip() for d in domains_filter.split(',')]
            domains_to_query = [d for d in requested_domains if d in available_domains]
            if not domains_to_query:
                return jsonify({"error": "None of the requested domains are available"}), 400
        else:
            domains_to_query = available_domains

        # Build date filter
        date_params = []
        date_filter = ""
        if date_from and date_to:
            date_filter = "AND date BETWEEN @date_from AND @date_to"
            date_params.extend([bigquery.ScalarQueryParameter("date_from", "DATE", date_from), bigquery.ScalarQueryParameter("date_to", "DATE", date_to)])
        elif date_from:
            date_filter = "AND date >= @date_from"
            date_params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
        elif date_to:
            date_filter = "AND date <= @date_to"
            date_params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))

        domains_list_str = ", ".join([f"'{d}'" for d in domains_to_query])
        domains_filter_sql = f"AND domain_name IN ({domains_list_str})"
        query_params = [bigquery.ScalarQueryParameter("client_group", "STRING", client_id)] + date_params
        job_config = bigquery.QueryJobConfig(query_parameters=query_params)

        # Timeline
        timeline_query = f"""
        SELECT date, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) * 100 as ctr, AVG(position) as position
        FROM `mydigipal.marketing_data.gsc_date`
        WHERE client_group = @client_group {domains_filter_sql} {date_filter}
        GROUP BY date ORDER BY date ASC
        """
        timeline = [dict(row) for row in client.query(timeline_query, job_config=job_config).result()]

        # Top queries
        queries_query = f"""
        SELECT query, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) * 100 as ctr, AVG(position) as position
        FROM `mydigipal.marketing_data.gsc_date_query`
        WHERE client_group = @client_group {domains_filter_sql} {date_filter}
        GROUP BY query ORDER BY clicks DESC LIMIT 100
        """
        top_queries = [dict(row) for row in client.query(queries_query, job_config=job_config).result()]

        # Top pages
        pages_query = f"""
        SELECT page, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) * 100 as ctr, AVG(position) as position
        FROM `mydigipal.marketing_data.gsc_date_page`
        WHERE client_group = @client_group {domains_filter_sql} {date_filter}
        GROUP BY page ORDER BY clicks DESC LIMIT 100
        """
        top_pages = [dict(row) for row in client.query(pages_query, job_config=job_config).result()]

        # Devices
        device_query = f"""
        SELECT device, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) * 100 as ctr, AVG(position) as position
        FROM `mydigipal.marketing_data.gsc_date_device`
        WHERE client_group = @client_group {domains_filter_sql} {date_filter}
        GROUP BY device ORDER BY clicks DESC
        """
        devices = [dict(row) for row in client.query(device_query, job_config=job_config).result()]

        # Countries
        country_query = f"""
        SELECT country, SUM(clicks) as clicks, SUM(impressions) as impressions, AVG(ctr) * 100 as ctr, AVG(position) as position
        FROM `mydigipal.marketing_data.gsc_date_country`
        WHERE client_group = @client_group {domains_filter_sql} {date_filter}
        GROUP BY country ORDER BY clicks DESC LIMIT 20
        """
        countries = [dict(row) for row in client.query(country_query, job_config=job_config).result()]

        # Summary
        summary_query = f"""
        SELECT SUM(clicks) as total_clicks, SUM(impressions) as total_impressions, AVG(ctr) * 100 as avg_ctr, AVG(position) as avg_position
        FROM `mydigipal.marketing_data.gsc_date`
        WHERE client_group = @client_group {domains_filter_sql} {date_filter}
        """
        summary_results = client.query(summary_query, job_config=job_config).result()
        summary = [dict(row) for row in summary_results][0] if summary_results.total_rows > 0 else {}

        return jsonify({
            'summary': summary,
            'timeline': timeline,
            'top_queries': top_queries,
            'top_pages': top_pages,
            'devices': devices,
            'countries': countries,
            'domains': domains_to_query,
            'available_domains': available_domains,
            'client_name': mapping_row.company_name
        })
    except Exception as e:
        print(f"Error fetching Search Console data: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Failed to fetch Search Console data: {str(e)}"}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
