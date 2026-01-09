-- MyDigipal Dashboard - Materialized Views for Performance Optimization
-- Created: 2026-01-09
-- Purpose: Pre-aggregate data to reduce query time and BigQuery costs

-- ============================================================================
-- 1. Client Profitability Materialized View
-- ============================================================================
-- Replaces expensive FULL OUTER JOIN in /api/clients and /api/monthly
-- Expected improvement: 50-80% faster queries
-- Refresh: Every 4 hours via BigQuery scheduled query

CREATE MATERIALIZED VIEW IF NOT EXISTS `mydigipal.company.mv_client_profitability`
AS
SELECT
  COALESCE(t.month, i.month) as month,
  COALESCE(t.client_id, i.client_id) as client_id,
  c.client_name,
  t.employee_id,
  COALESCE(t.hours, 0) as hours,
  COALESCE(t.cost_gbp, 0) as cost_gbp,
  COALESCE(i.revenue_gbp, 0) as revenue_gbp,
  COALESCE(i.revenue_gbp, 0) - COALESCE(t.cost_gbp, 0) as profit_gbp
FROM (
  -- Timesheets aggregated by month and client
  SELECT
    DATE_TRUNC(date, MONTH) as month,
    client_id,
    employee_id,
    SUM(hours) as hours,
    SUM(cost_gbp) as cost_gbp
  FROM `mydigipal.company.timesheets_with_cost`
  GROUP BY 1, 2, 3
) t
FULL OUTER JOIN (
  -- Invoices aggregated by month and client
  SELECT
    month,
    client_id,
    SUM(real_revenue_gbp) as revenue_gbp
  FROM `mydigipal.company.invoices_fct`
  GROUP BY 1, 2
) i ON t.client_id = i.client_id AND t.month = i.month
LEFT JOIN `mydigipal.company.clients_dim` c ON COALESCE(t.client_id, i.client_id) = c.client_id
WHERE COALESCE(t.client_id, i.client_id) IS NOT NULL;

-- ============================================================================
-- Setup Scheduled Refresh (Run this separately in BigQuery Console)
-- ============================================================================
-- Note: Materialized views auto-refresh, but you can force refresh with:
-- CALL BQ.REFRESH_MATERIALIZED_VIEW('mydigipal.company.mv_client_profitability');

-- ============================================================================
-- How to use this file:
-- ============================================================================
-- 1. Open BigQuery Console: https://console.cloud.google.com/bigquery
-- 2. Select project: mydigipal
-- 3. Click "+ COMPOSE NEW QUERY"
-- 4. Copy-paste the CREATE MATERIALIZED VIEW statement above
-- 5. Click "RUN"
--
-- The view will be created and will auto-refresh when base tables change.
-- For manual refresh every 4 hours, create a scheduled query in BigQuery.

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the view was created successfully:
--
-- SELECT
--   COUNT(*) as total_rows,
--   COUNT(DISTINCT client_id) as unique_clients,
--   MIN(month) as earliest_month,
--   MAX(month) as latest_month
-- FROM `mydigipal.company.mv_client_profitability`;
