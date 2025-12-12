from flask import Flask, jsonify, request
from flask_cors import CORS
from google.cloud import bigquery
from datetime import datetime, timedelta
import os
import traceback

# Dashboard API v1.6 - Migrated to company/reporting datasets

app = Flask(__name__)
CORS(app)

client = bigquery.Client(project='mydigipal')

def get_date_params():
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    return date_from, date_to

@app.route('/')
def health():
    return jsonify({"status": "ok", "service": "mydigipal-dashboard-api", "version": "1.6"})

@app.route('/api/clients')
def get_clients():
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
      client_id,
      COALESCE(client_name, client_id) as client_name,
      ROUND(SUM(hours_worked), 0) AS hours,
      ROUND(SUM(cost_gbp), 0) AS cost,
      ROUND(SUM(revenue_gbp), 0) AS revenue,
      ROUND(SUM(profit_gbp), 0) AS profit,
      ROUND(SUM(profit_gbp) / NULLIF(SUM(revenue_gbp), 0) * 100, 0) AS margin
    FROM `mydigipal.reporting.vw_profitability`
    WHERE client_id != 'mydigipal' {date_filter}
    GROUP BY 1, 2
    HAVING SUM(revenue_gbp) > 0 OR SUM(hours_worked) > 100
    ORDER BY 6 DESC
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/clients-with-hours')
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
        
        # Daily breakdown by employee
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
        
        # Total by employee for the period
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
        
        # Client info
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
def get_budget_progress():
    """Get budget vs actual hours for the selected month with pace calculation"""
    try:
        # Get month parameter (default to current month)
        month = request.args.get('month')
        if not month:
            month = datetime.now().strftime('%Y-%m')
        
        # Parse month to get date range
        year, mon = month.split('-')
        month_start = f"{year}-{mon}-01"
        
        # Calculate month end
        if int(mon) == 12:
            next_year = int(year) + 1
            next_month = 1
        else:
            next_year = int(year)
            next_month = int(mon) + 1
        month_end = f"{next_year}-{next_month:02d}-01"
        
        # Calculate progress through month
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
        ),
        employee_breakdown AS (
          SELECT 
            t.client_id,
            t.employee_id,
            COALESCE(e.employee_name, t.employee_id) as employee_name,
            ROUND(SUM(t.hours), 1) as hours
          FROM `mydigipal.company.timesheets_fct` t
          LEFT JOIN `mydigipal.company.employees_dim` e ON t.employee_id = e.employee_id
          WHERE t.date >= @month_start AND t.date < @month_end
          GROUP BY 1, 2, 3
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
            
            # Calculate remaining hours
            r['remaining_hours'] = round(budgeted - actual, 1)
            
            # Calculate expected hours at this point in month
            expected_at_pace = round(budgeted * month_progress, 1)
            r['expected_hours'] = expected_at_pace
            
            # Calculate pace status
            # If actual > expected, we're ahead (bad - spending too fast)
            # If actual < expected, we're behind (good - on track or under)
            pace_diff = actual - expected_at_pace
            r['pace_diff'] = round(pace_diff, 1)
            
            if actual >= budgeted:
                r['status'] = 'exceeded'
            elif pace_diff > budgeted * 0.1:  # More than 10% ahead of pace
                r['status'] = 'warning'
            else:
                r['status'] = 'ok'
            
            # Progress percentage
            r['progress_pct'] = round((actual / budgeted * 100) if budgeted > 0 else 0, 0)
            
            result.append(r)
        
        # Get employee breakdown for each client
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
        
        # Group by client
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
        
        # Add breakdown to each client
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
def get_monthly():
    date_from, date_to = get_date_params()
    
    params = []
    date_filter = ""
    
    if date_from:
        date_filter += " AND month >= @date_from"
        params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
    else:
        date_filter += " AND month >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)"
    
    if date_to:
        date_filter += " AND month <= @date_to"
        params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))
    
    query = f"""
    SELECT 
      FORMAT_DATE('%Y-%m', month) as month,
      ROUND(SUM(hours_worked), 0) AS hours,
      ROUND(SUM(cost_gbp), 0) AS cost,
      ROUND(SUM(revenue_gbp), 0) AS revenue,
      ROUND(SUM(profit_gbp), 0) AS profit
    FROM `mydigipal.reporting.vw_profitability`
    WHERE client_id != 'mydigipal' {date_filter}
    GROUP BY 1
    ORDER BY 1
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/employees')
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
        
        # Use column positions to avoid "aggregation of aggregation" error
        # Column 2 = employee_name, Column 5 = total_hours
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
        
        # Rename total_hours to hours for frontend compatibility
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
