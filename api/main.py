from flask import Flask, jsonify, request
from flask_cors import CORS
from google.cloud import bigquery
from datetime import datetime, timedelta
import os

# Dashboard API v1.1 - With employees-breakdown endpoint

app = Flask(__name__)
CORS(app)  # Allow frontend to call API

client = bigquery.Client(project='mydigipal')

def get_date_params():
    """Parse date_from and date_to from query params"""
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    return date_from, date_to

@app.route('/')
def health():
    return jsonify({"status": "ok", "service": "mydigipal-dashboard-api", "version": "1.1"})

@app.route('/api/clients')
def get_clients():
    """Get profitability by client with optional date filter"""
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
    FROM `mydigipal.marts.client_profitability`
    WHERE client_id != 'mydigipal' {date_filter}
    GROUP BY 1, 2
    HAVING SUM(revenue_gbp) > 0 OR SUM(hours_worked) > 100
    ORDER BY profit DESC
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/monthly')
def get_monthly():
    """Get monthly totals with optional date filter"""
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
    FROM `mydigipal.marts.client_profitability`
    WHERE client_id != 'mydigipal' {date_filter}
    GROUP BY 1
    ORDER BY 1
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/employees')
def get_employees():
    """Get hours by employee with optional date filter - INCLUDES MyDigipal hours"""
    date_from, date_to = get_date_params()
    
    params = []
    date_filter = ""
    
    if date_from:
        date_filter += " AND month >= @date_from"
        params.append(bigquery.ScalarQueryParameter("date_from", "DATE", date_from))
    if date_to:
        date_filter += " AND month <= @date_to"
        params.append(bigquery.ScalarQueryParameter("date_to", "DATE", date_to))
    
    # Include ALL clients including mydigipal for total hours worked
    query = f"""
    SELECT 
      employee_id,
      COALESCE(employee_name, employee_id) as employee_name,
      ROUND(SUM(hours), 0) AS total_hours,
      ROUND(SUM(cost_gbp), 0) AS total_cost,
      COUNT(DISTINCT client_id) AS nb_clients
    FROM `mydigipal.marts.employee_workload`
    WHERE 1=1 {date_filter}
    GROUP BY 1, 2
    ORDER BY total_hours DESC
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/employees-breakdown')
def get_employees_breakdown():
    """Get hours by employee broken down by client - for stacked bar chart"""
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
      ROUND(SUM(hours), 0) AS hours
    FROM `mydigipal.marts.employee_workload`
    WHERE 1=1 {date_filter}
    GROUP BY 1, 2, 3, 4
    HAVING SUM(hours) > 0
    ORDER BY employee_name, hours DESC
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=params) if params else None
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/employee/<employee_id>')
def get_employee_detail(employee_id):
    """Get monthly breakdown for a specific employee - INCLUDES MyDigipal"""
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
    
    # Include ALL clients including mydigipal
    query = f"""
    SELECT 
      FORMAT_DATE('%Y-%m', month) as month,
      client_name,
      hours,
      cost_gbp
    FROM `mydigipal.marts.employee_workload`
    WHERE employee_id = @employee_id {date_filter}
    ORDER BY month DESC, hours DESC
    """
    
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/client/<client_id>')
def get_client_detail(client_id):
    """Get monthly breakdown and team for a specific client"""
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
    
    # Monthly data
    query1 = f"""
    SELECT 
      FORMAT_DATE('%Y-%m', month) as month,
      hours_worked as hours,
      cost_gbp as cost,
      revenue_gbp as revenue,
      profit_gbp as profit,
      margin_pct as margin
    FROM `mydigipal.marts.client_profitability`
    WHERE client_id = @client_id {date_filter}
    ORDER BY month DESC
    LIMIT 12
    """
    monthly = [dict(row) for row in client.query(query1, job_config=job_config).result()]
    
    # Team breakdown (same date filter)
    query2 = f"""
    SELECT 
      e.employee_name,
      ROUND(SUM(w.hours), 0) as hours,
      ROUND(SUM(w.cost_gbp), 0) as cost
    FROM `mydigipal.marts.employee_workload` w
    LEFT JOIN `mydigipal.staging.dim_employees` e ON w.employee_id = e.employee_id
    WHERE w.client_id = @client_id {date_filter}
    GROUP BY 1
    ORDER BY hours DESC
    """
    team = [dict(row) for row in client.query(query2, job_config=job_config).result()]
    
    return jsonify({"monthly": monthly, "team": team})

@app.route('/api/alerts')
def get_alerts():
    """Get clients with issues"""
    date_from, date_to = get_date_params()
    
    # Note: alerts are based on all-time data by default
    # Could add date filtering if needed
    
    query = """
    SELECT *
    FROM `mydigipal.marts.client_profitability_alerts`
    WHERE alert_type IN ('NO_REVENUE', 'LOSS', 'LOW_MARGIN')
    ORDER BY total_profit_gbp ASC
    LIMIT 20
    """
    rows = client.query(query).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/date-range')
def get_date_range():
    """Get min and max dates available in the data"""
    query = """
    SELECT 
      FORMAT_DATE('%Y-%m-%d', MIN(month)) as min_date,
      FORMAT_DATE('%Y-%m-%d', MAX(month)) as max_date
    FROM `mydigipal.marts.client_profitability`
    """
    rows = list(client.query(query).result())
    if rows:
        return jsonify(dict(rows[0]))
    return jsonify({"min_date": "2024-01-01", "max_date": "2025-12-31"})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
