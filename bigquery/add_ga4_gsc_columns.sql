-- Add GA4 and Search Console columns to client_accounts_mapping
-- Execute in BigQuery Console: https://console.cloud.google.com/bigquery?project=mydigipal

-- 1. Add new columns if they don't exist
ALTER TABLE `mydigipal.company.client_accounts_mapping`
ADD COLUMN IF NOT EXISTS ga4_properties STRING,
ADD COLUMN IF NOT EXISTS gsc_domains STRING;

-- 2. Populate GA4 properties (examples - adjust based on actual client data)
-- Format: property_name|property_name2 (pipe-separated for multiple properties)

-- Examples to update (you'll need to add all clients):
UPDATE `mydigipal.company.client_accounts_mapping`
SET ga4_properties = CASE client_id
  WHEN 'ggp' THEN 'GGP'
  WHEN 'dmd' THEN 'DMD'
  WHEN 'vulgain' THEN 'Vulgain'
  WHEN 'guyane' THEN 'Guyane'
  WHEN 'mydigipal' THEN 'MyDigipal'
  -- Add more clients here
  ELSE NULL
END
WHERE client_id IN ('ggp', 'dmd', 'vulgain', 'guyane', 'mydigipal');

-- 3. Populate Search Console domains (examples - adjust based on actual client data)
-- Format: domain1.com|domain2.com (pipe-separated for multiple domains)

UPDATE `mydigipal.company.client_accounts_mapping`
SET gsc_domains = CASE client_id
  WHEN 'ggp' THEN 'groupe-ggp.fr'
  WHEN 'dmd' THEN 'www.groupe-dmd.fr'
  WHEN 'vulgain' THEN 'vulgain.com'
  WHEN 'guyane' THEN 'www.guyane-amazonie.fr|www.cayenne.aeroport.fr|www.saint-laurent-du-maroni.aeroport.fr'
  WHEN 'mydigipal' THEN 'mydigipal.com'
  -- Add more clients here
  ELSE NULL
END
WHERE client_id IN ('ggp', 'dmd', 'vulgain', 'guyane', 'mydigipal');

-- 4. Verify changes
SELECT
  client_id,
  company_name,
  google_ads_accounts,
  meta_ads_accounts,
  linkedin_ads_accounts,
  ga4_properties,
  gsc_domains
FROM `mydigipal.company.client_accounts_mapping`
WHERE active = TRUE
  AND (ga4_properties IS NOT NULL OR gsc_domains IS NOT NULL)
ORDER BY company_name;
