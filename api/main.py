from flask import Flask, jsonify
from flask_cors import CORS
from google.cloud import bigquery
import os

app = Flask(__name__)
CORS(app)  # Allow frontend to call API

client = bigquery.Client(project='mydigipal')

@app.route('/')
def health():
    return jsonify({"status": "ok", "service": "mydigipal-dashboard-api"})

@app.route('/api/clients')
def get_clients():
    """Get profitability by client (all time)"""
    query = """
    SELECT 
      client_id,
      COALESCE(client_name, client_id) as client_name,
      ROUND(SUM(hours_worked), 0) AS hours,
      ROUND(SUM(cost_gbp), 0) AS cost,
      ROUND(SUM(revenue_gbp), 0) AS revenue,
      ROUND(SUM(profit_gbp), 0) AS profit,
      ROUND(SUM(profit_gbp) / NULLIF(SUM(revenue_gbp), 0) * 100, 0) AS margin
    FROM `mydigipal.marts.client_profitability`
    WHERE client_id != 'mydigipal'
    GROUP BY 1, 2
    HAVING SUM(revenue_gbp) > 0 OR SUM(hours_worked) > 100
    ORDER BY profit DESC
    """
    rows = client.query(query).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/monthly')
def get_monthly():
    """Get monthly totals (excluding internal)"""
    query = """
    SELECT 
      FORMAT_DATE('%Y-%m', month) as month,
      ROUND(SUM(hours_worked), 0) AS hours,
      ROUND(SUM(cost_gbp), 0) AS cost,
      ROUND(SUM(revenue_gbp), 0) AS revenue,
      ROUND(SUM(profit_gbp), 0) AS profit
    FROM `mydigipal.marts.client_profitability`
    WHERE client_id != 'mydigipal'
      AND month >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
    GROUP BY 1
    ORDER BY 1
    """
    rows = client.query(query).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/employees')
def get_employees():
    """Get hours by employee"""
    query = """
    SELECT 
      employee_id,
      COALESCE(employee_name, employee_id) as employee_name,
      ROUND(SUM(hours), 0) AS total_hours,
      ROUND(SUM(cost_gbp), 0) AS total_cost,
      COUNT(DISTINCT client_id) AS nb_clients
    FROM `mydigipal.marts.employee_workload`
    WHERE client_id != 'mydigipal'
    GROUP BY 1, 2
    ORDER BY total_hours DESC
    """
    rows = client.query(query).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/employee/<employee_id>')
def get_employee_detail(employee_id):
    """Get monthly breakdown for a specific employee"""
    query = """
    SELECT 
      FORMAT_DATE('%Y-%m', month) as month,
      client_name,
      hours,
      cost_gbp
    FROM `mydigipal.marts.employee_workload`
    WHERE employee_id = @employee_id
      AND client_id != 'mydigipal'
      AND month >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
    ORDER BY month DESC, hours DESC
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("employee_id", "STRING", employee_id)]
    )
    rows = client.query(query, job_config=job_config).result()
    return jsonify([dict(row) for row in rows])

@app.route('/api/client/<client_id>')
def get_client_detail(client_id):
    """Get monthly breakdown and team for a specific client"""
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("client_id", "STRING", client_id)]
    )
    
    # Monthly data
    query1 = """
    SELECT 
      FORMAT_DATE('%Y-%m', month) as month,
      hours_worked as hours,
      cost_gbp as cost,
      revenue_gbp as revenue,
      profit_gbp as profit,
      margin_pct as margin
    FROM `mydigipal.marts.client_profitability`
    WHERE client_id = @client_id
    ORDER BY month DESC
    LIMIT 12
    """
    monthly = [dict(row) for row in client.query(query1, job_config=job_config).result()]
    
    # Team breakdown
    query2 = """
    SELECT 
      employee_name,
      total_hours as hours,
      total_cost_gbp as cost
    FROM `mydigipal.marts.client_team_breakdown`
    WHERE client_id = @client_id
    ORDER BY total_hours DESC
    """
    team = [dict(row) for row in client.query(query2, job_config=job_config).result()]
    
    return jsonify({"monthly": monthly, "team": team})

@app.route('/api/alerts')
def get_alerts():
    """Get clients with issues"""
    query = """
    SELECT *
    FROM `mydigipal.marts.client_profitability_alerts`
    WHERE alert_type IN ('NO_REVENUE', 'LOSS', 'LOW_MARGIN')
    ORDER BY total_profit_gbp ASC
    LIMIT 20
    """
    rows = client.query(query).result()
    return jsonify([dict(row) for row in rows])

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
