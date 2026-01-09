-- Client Mapping Fixes for MyDigipal Dashboard
-- Execute these queries in BigQuery Console

-- 1. Add missing clients from invoices with proper capitalization
INSERT INTO `mydigipal.company.clients_dim` (client_id, client_name)
VALUES
  ('auto_ici', 'Auto-ici'),
  ('dosojin', 'Dosojin')
ON CONFLICT (client_id) DO UPDATE SET
  client_name = EXCLUDED.client_name;

-- 2. Fix Live Passion Production vs Passion Production
-- Option A: Keep both separate with clear names
UPDATE `mydigipal.company.clients_dim`
SET client_name = 'Passion Production - Studio'
WHERE client_id = 'passion_production';

UPDATE `mydigipal.company.clients_dim`
SET client_name = 'Passion Production - Live'
WHERE client_id = 'live_passion';

-- Option B (ALTERNATIVE): Merge both into one client
-- If you want to merge them into a single "Passion Production" entry:
-- UNCOMMENT BELOW AND RUN INSTEAD OF OPTION A

-- UPDATE `mydigipal.company.timesheets_with_cost`
-- SET client_id = 'passion_production'
-- WHERE client_id = 'live_passion';

-- UPDATE `mydigipal.company.invoices_fct`
-- SET client_id = 'passion_production'
-- WHERE client_id = 'live_passion';

-- DELETE FROM `mydigipal.company.clients_dim`
-- WHERE client_id = 'live_passion';

-- UPDATE `mydigipal.company.clients_dim`
-- SET client_name = 'Passion Production'
-- WHERE client_id = 'passion_production';

-- 3. Verify the changes
SELECT client_id, client_name
FROM `mydigipal.company.clients_dim`
WHERE client_id IN ('auto_ici', 'dosojin', 'passion_production', 'live_passion')
ORDER BY client_name;
