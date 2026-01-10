-- Complete Client Mapping Fixes for MyDigipal Dashboard
-- Execute in BigQuery Console: https://console.cloud.google.com/bigquery?project=mydigipal

-- 1. Update existing clients with proper capitalization
UPDATE `mydigipal.company.clients_dim`
SET client_name = CASE client_id
  WHEN 'systemgie' THEN 'Systemgie'
  WHEN 'fl_ingenierie' THEN 'FL Ingenierie'
  WHEN 'auto_ici' THEN 'Auto-ici'
  WHEN 'dosojin' THEN 'Dosojin'
  WHEN 'bluesky' THEN 'Bluesky'
  WHEN 'passion_production' THEN 'Passion Production'
  ELSE client_name
END
WHERE client_id IN ('systemgie', 'fl_ingenierie', 'auto_ici', 'dosojin', 'bluesky', 'passion_production');

-- 2. Insert missing clients if they don't exist
INSERT INTO `mydigipal.company.clients_dim` (client_id, client_name)
VALUES
  ('systemgie', 'Systemgie'),
  ('fl_ingenierie', 'FL Ingenierie'),
  ('auto_ici', 'Auto-ici'),
  ('dosojin', 'Dosojin'),
  ('bluesky', 'Bluesky')
ON CONFLICT (client_id) DO UPDATE SET
  client_name = EXCLUDED.client_name;

-- 3. MERGE Live Passion Production into Passion Production
-- Update timesheets
UPDATE `mydigipal.company.timesheets_with_cost`
SET client_id = 'passion_production'
WHERE client_id = 'live_passion';

-- Update invoices
UPDATE `mydigipal.company.invoices_fct`
SET client_id = 'passion_production'
WHERE client_id = 'live_passion';

-- Delete the duplicate entry
DELETE FROM `mydigipal.company.clients_dim`
WHERE client_id = 'live_passion';

-- 4. Verify all changes
SELECT client_id, client_name
FROM `mydigipal.company.clients_dim`
WHERE client_id IN ('systemgie', 'fl_ingenierie', 'auto_ici', 'dosojin', 'bluesky', 'passion_production')
ORDER BY client_name;

-- Expected results:
-- auto_ici         | Auto-ici
-- bluesky          | Bluesky
-- dosojin          | Dosojin
-- fl_ingenierie    | FL Ingenierie
-- passion_production | Passion Production
-- systemgie        | Systemgie
