# MyDigipal Dashboard - Template Specification v2.1

## Design System

### Couleurs
```css
--primary: #0891B2;        /* Cyan/Teal - headers, accents */
--primary-dark: #164E63;   /* Dark teal - section headers */
--success: #10B981;        /* Green - positive deltas */
--danger: #EF4444;         /* Red - negative deltas */
--neutral: #6B7280;        /* Gray - secondary text */
--background: #F8FAFC;     /* Light gray background */
--card: #FFFFFF;           /* White cards */
--border: #E2E8F0;         /* Light borders */
```

### Typography
- **Font**: Inter (deja en place)
- **KPI Values**: 32px, font-weight 700
- **KPI Labels**: 12px, uppercase, color neutral
- **Section Headers**: 18px, font-weight 600, white sur fond primary-dark
- **Table Headers**: 12px, uppercase, font-weight 600
- **Table Data**: 14px, font-weight 400

### Composants

#### 1. Scorecard avec Sparkline et Delta
```
+---------------------------+
| IMPRESSIONS         +52%  |  <- Delta colore (vert/rouge)
| 1.0M                      |
| vs 658K (+342K)           |  <- Comparaison periode precedente
| ___/\___/\____ (sparkline)|
+---------------------------+
```
- Delta colore (vert = positif, rouge = negatif)
- Valeur de comparaison vs periode precedente (quand il y a de la place)
- Sparkline sous la valeur (30 derniers jours)

#### 2. Section Header
```
+-------------------------------------------+
| | Notoriete                               | (fond primary-dark, texte blanc)
+-------------------------------------------+
```

#### 3. Filter Pill
```
+--------------+
| Canal      v | (rounded, border, hover effect)
+--------------+
```

#### 4. Data Table avec Inline Bars et Delta
```
| Campagne      | Cout v  | D     | Clicks   | CTR    | Conv  | D     |
|---------------|---------|-------|----------|--------|-------|-------|
| SER#Renault   | 6,907 E | +12%  | ==== 25K | 21%    | 14.5K | +8%   |
| SER#Generic   | 3,853 E | -5%   | == 8K    | 11%    | 2.7K  | -12%  |
```
- Tri par clic sur header
- Barres proportionnelles dans les cellules
- Colonne Delta (D) pour metriques cles (Cout, Conv, Leads)
- Heatmap optionnel sur certaines colonnes

---

## Categories de Conversion

### Simplification des Categories
Seulement 2 categories (au lieu de 3):
- **LEAD**: Formulaires, appels, contacts directs
- **CONVERSION**: Toutes les autres conversions (incluant les anciens "engagements")

Note: Les "engagements" Meta/LinkedIn sont comptes comme CONVERSION.

---

## Filtre Marque Automobile

### Application
- Applique uniquement aux clients du secteur automobile
- Extrait automatiquement la marque du nom de campagne

### Regex Marques Europeennes
```regex
(?i)(renault|peugeot|citroen|dacia|alpine|ds|opel|volkswagen|vw|audi|bmw|mercedes|mercedes-benz|porsche|mini|seat|cupra|skoda|fiat|alfa\s*romeo|lancia|maserati|ferrari|lamborghini|toyota|lexus|honda|nissan|mazda|mitsubishi|suzuki|subaru|hyundai|kia|genesis|ford|volvo|jaguar|land\s*rover|range\s*rover|bentley|rolls\s*royce|aston\s*martin|mclaren|lotus|mg|byd|nio|xpeng|polestar|tesla|rivian|lucid|jeep|dodge|chrysler|ram|chevrolet|cadillac|buick|gmc|smart|caterham|morgan|tvr|ssangyong|daihatsu|isuzu|infiniti|acura|scion|saab)
```

### Clients Automobile (a appliquer)
- Groupe Theobald
- Groupe DMD
- Groupe Vulcain (tous sous-comptes)
- GGP Auto
- Lancien
- Guyane Automobile (tous sous-comptes)

---

## Structure des Pages

### Pattern General (Pyramid: High -> Detail)

```
+---------------------------------------------------------------------+
| HEADER: Logo + Titre Page + Client Name                             |
+---------------------------------------------------------------------+
| FILTERS GLOBAUX: [Canal v] [Campagne v] [Type v]                    |
| Note: Date Range est GLOBAL en haut du rapport, pas repete ici      |
+---------------------------------------------------------------------+
|                                                                     |
| SECTION 1: SCORECARDS (KPIs principaux groupes par theme)           |
| +---------------+ +---------------+ +---------------+               |
| | Notoriete     | | Cout          | | Conversions   |               |
| | Impr | CTR    | | Cout | CPC    | | Conv | CPL    |               |
| | + delta + vs  | | + delta + vs  | | + delta + vs  |               |
| +---------------+ +---------------+ +---------------+               |
|                                                                     |
+---------------------------------------------------------------------+
|                                                                     |
| SECTION 2: EVOLUTION (Graphiques temporels)                         |
| [Line Chart: Clicks + CTR] [Line Chart: Cout + CPC]                 |
|                                                                     |
+---------------------------------------------------------------------+
|                                                                     |
| SECTION 3: DISTRIBUTION (Pie/Donut charts)                          |
| (o) Clicks by X   (o) Cout by X   (o) Conversions by X              |
|                                                                     |
+---------------------------------------------------------------------+
|                                                                     |
| SECTION 4: DETAIL TABLE (Drill-down)                                |
| Campaign > Ad Group > Keyword (avec filtres locaux)                 |
| Colonnes avec Delta (D) pour Cout, Conv, Leads                      |
|                                                                     |
+---------------------------------------------------------------------+
```

---

## Templates par Source

### 1. GOOGLE ADS

#### Filtres disponibles
- Categorie Conversion (LEAD / CONVERSION)
- Marque (pour clients auto uniquement - extrait via regex)
- Type de campagne (SEARCH, PMAX, DISPLAY, VIDEO)
- Campagne

#### Section Scorecards
| Notoriete | Cout | Conversions |
|-----------|------|-------------|
| Impressions +% vs | Cout +% vs | Conversions +% vs |
| Clicks +% vs | CPC +% vs | Taux Conv +% |
| CTR +% | Search Imp. Share +% | Cout/Conv +% vs |
| | | Leads +% vs |
| | | Cout/Lead +% vs |

#### Section Evolution
- **Chart 1**: Clicks + CTR (dual axis line)
- **Chart 2**: Cout + CPC (dual axis line)
- **Chart 3**: Conversions + Leads (dual axis line)

#### Section Distribution (Donut x3)
- Clicks par Marque/Type campagne
- Cout par Marque/Type campagne
- Conversions par Marque/Type campagne

#### Section Conversions Detail
- Table: Type de Conversion | Conversions | D
- Donut: Repartition conversions par type
- Filtrable par categorie (LEAD/CONVERSION)

#### Section Campagne (Table principale)
| Campagne | Brand | Cout | D | CPC | Clicks | Impr | CTR | Conv | D | Leads | D | Cout/Conv | Cout/Lead |
Avec: inline bars, sorting, search, heatmap sur valeurs

#### Section Sous-Campagne (Drill-down)
| Campaign | Ad Group | Cout | D | CPC | Clicks | Impr | CTR | Conv | D | Leads | D |

#### Section Keywords (Drill-down)
| Keyword | Cout | D | CPC | Clicks | Impr | CTR | Conv | D | Leads | D |
Avec: search box pour filtrer keywords

#### Section Search Impressions
3 tables cote a cote:
- Campaign: Search Imp Share | Search Top IS
- Ad Group: Search Imp Share | Search Top IS
- Keyword: Search Imp Share | Search Top IS

---

### 2. META ADS

#### Filtres disponibles
- Compte
- Campagne
- Marque (pour clients auto uniquement)

#### Section Scorecards
| Notoriete | Engagement | Conversions |
|-----------|------------|-------------|
| Cout +% vs | Frequence +% | Leads +% vs |
| Impressions +% vs | Reach +% | Taux de Lead +% |
| Clicks +% vs | CTR +% | Cout/Lead +% vs |
| | | Conversions +% vs |
| | | Taux de Conv +% |
| | | Cout/Conv +% vs |

#### Section Evolution
- **Chart 1**: Clicks + Cout (dual axis)
- **Chart 2**: Frequence + Reach (dual axis)
- **Chart 3**: Leads + Conversions (dual axis)

#### Section Distribution (Donut x3)
- Leads par Campagne
- Cout par Campagne
- Conversions par Campagne

#### Section Conversions par Type
- Table: Type de Conversion | Conversions | D
- Donut: Repartition (Chat, Contact Mail/Tel, Meta Leads, Web Lead, etc.)

#### Section Campagne (Table principale)
| Campagne | Cout | D | Clicks | Impressions | Leads | D | Conversions | D |

#### Section Breakdown par Genre (si donnees disponibles)
| Gender | Cout | Clicks | CPC | Impressions | CTR | Leads | CPL |
Note: Donnees limitees, backfill en cours

#### Section Breakdown par Plateforme (si donnees disponibles)
| Platform | Cout | Clicks | CPC | Impressions | CTR | Leads | CPL |
Note: Donnees limitees, backfill en cours

---

### 3. LINKEDIN ADS

#### Filtres disponibles
- Compte
- Campagne
- Marque (pour clients auto uniquement)

#### Section Scorecards
| Notoriete | Cout | Conversions |
|-----------|------|-------------|
| Impressions +% vs | Cout +% vs | Conversions +% vs |
| Clicks +% vs | CPC +% vs | Taux Conv +% |
| CTR +% | CPM +% | Cout/Conv +% vs |
| | | Leads +% vs |
| | | Cout/Lead +% vs |

#### Section Evolution
- **Chart 1**: Impressions + Clicks (dual axis)
- **Chart 2**: Cout + CPC (dual axis)
- **Chart 3**: Conversions + Leads (dual axis)

#### Section Distribution (Donut x3)
- Clicks par Campagne
- Cout par Campagne
- Conversions par Campagne

#### Section Campagne (Table principale)
| Campagne | Cout | D | CPC | Clicks | Impressions | CTR | Conv | D | Leads | D |
Avec: inline bars, sorting, search

---

### 4. GA4 (Website) - NOUVELLE STRUCTURE 5 TABLES

**Tables BigQuery (googleAnalytics_v2):**
- `traffic_daily` - Trafic journalier par canal
- `events` - Événements avec catégorisation (LEAD/CONVERSION/ENGAGEMENT)
- `pages` - Pages vues et landing pages
- `audience` - Démographie (pays, device)
- `activity` - Activité par jour/heure (optionnel)

**NOTE:** Page unique (pas de sous-pages), design moderne style Coupler.io

#### Filtres disponibles
- Comptes GA4 (multi-select checkboxes, tous sélectionnés par défaut)
- Canal (optionnel)

#### Section 1: Scorecards (style Coupler.io)
4 cards colorés en ligne avec icônes et deltas:

```
+------------------+  +------------------+  +------------------+  +------------------+
| [icon] SESSIONS  |  | [icon] USERS     |  | [icon] LEADS     |  | [icon] CONVERSIONS|
| 201,992          |  | 176,987          |  | 230              |  | 1,901            |
| ↑ 26% vs prev    |  | ↑ 28% vs prev    |  | ↓ -10% vs prev   |  | ↓ -57% vs prev   |
| ▁▂▃▅▆▇ sparkline |  | ▁▂▃▅▆▇ sparkline |  | ▁▂▃▅▆▇ sparkline |  | ▁▂▃▅▆▇ sparkline |
+------------------+  +------------------+  +------------------+  +------------------+
```

Couleurs:
- Sessions: Bleu (#0B6CD9)
- Users: Vert (#11845B)
- Leads: Orange (#D5691B)
- Conversions: Violet (#7C3AED)

#### Section 2: KPIs Secondaires (cards compacts)
Grid 4 colonnes de métriques secondaires:
- Pages Vues | Taux d'engagement | Taux de rebond | Temps moyen
- Format: Label + Valeur + petit delta

#### Section 3: Timeline (chart interactif)
- Area chart: Sessions + Users dans le temps
- Sélecteur de métriques (boutons toggle): Sessions | Users | Pageviews | Conversions
- Période visible sur l'axe X

#### Section 4: Traffic Sources (table + donut)
Layout 2 colonnes:

**Gauche - Table:**
| Canal | Sessions | Users | Temps Moyen | Conversions | Δ |
Avec inline bars sur Sessions, tri par clic sur header

**Droite - Donut:**
Répartition Sessions par Canal (avec légende)

#### Section 5: Events & Conversions
Layout 2 colonnes:

**Gauche - Conversions par Type:**
| Event Name | Category | Count | Δ |
- Category = LEAD / CONVERSION / ENGAGEMENT (depuis Google Sheet)
- Badge coloré pour la catégorie
- Inline bar sur Count

**Droite - Donut:**
Répartition par catégorie (LEAD vs CONVERSION vs ENGAGEMENT)

#### Section 6: Top Pages
Table avec pagination:
| Page | Views | Sessions | Bounce Rate |
- Search box pour filtrer URLs
- Tri par colonnes
- Pagination: 20 par page

#### Section 7: Audience (cards + charts)
Layout grid:

**Row 1 - Device breakdown:**
3 cards avec icônes device:
```
[🖥️ Desktop]     [📱 Mobile]      [📟 Tablet]
   22,904           135,908          4,335
    ↑12%             ↑34%            ↑38%
```

**Row 2 - Geography:**
- Donut: Top 5 pays
- Table: Pays | Users | Sessions (top 10)

---

### 5. SEARCH CONSOLE (SEO)

#### Filtres disponibles
- Requete (search box)
- Pays
- Appareil
- Domain

#### Section Scorecards
- Impressions +% vs
- Clicks +% vs
- Site CTR +%
- Average Position +% (inverse: down = better)

#### Section Impression vs Clicks
- Dual axis line chart: Impressions + Clicks over time

#### Section Appareils
- Donut chart: Mobile | Desktop | Tablet
- Device icons avec impressions

#### Section Position vs CTR
- Bar charts: Average Position par date (top 10 days)
- Bar charts: CTR par date (top 10 days)

#### Section Geographie
- Map visualization
- Table: Pays | Clicks | Impressions | Average Position | CTR

#### Section Requetes (Table principale)
| Requete | Clicks | Impressions | Average Position | CTR |
Avec: search box, sorting, pagination (top 100)

---

### 6. PAID MEDIA (Combined)

#### Filtres disponibles
- Canal (Google Ads, Meta Ads, LinkedIn Ads)
- Marque (pour clients auto)
- Campaign Type
- Campagne

#### Section Scorecards
| Notoriete | Cout | Conversions |
|-----------|------|-------------|
| Impressions +% vs | Cout +% vs | Convs. (GAds) +% vs |
| Clicks +% vs | CPM +% | Convs. (Meta) +% vs |
| CTR +% | CPC +% vs | Convs. (LinkedIn) +% vs |
| | | Convs Total +% vs |
| | | Leads (GAds) +% vs |
| | | Leads (Meta) +% vs |
| | | Leads Total +% vs |

#### Section Evolution
- **Chart 1**: Impressions + Clicks (dual axis)
- **Chart 2**: Cout + CPC (dual axis)
- **Chart 3**: Convs par Canal (multi-line)

#### Section Canal (Donut x3)
- Leads par Canal
- Cout par Canal
- Conversions par Canal

#### Section Table Comparative
| Canal | Cout | D | Clicks | CPC | Impression | CTR | Convs | D | Leads | D | Cout/Conv | Cout/Lead |

---

## Interactions & Fonctionnalites

### Filtres Globaux
- Tous les filtres en haut affectent TOUS les graphiques/tables de la page
- Multi-select possible (ex: plusieurs campagnes)
- "Tout" comme option par defaut
- Date Range: GLOBAL uniquement (en haut du rapport), pas repete dans chaque page

### Filtres Locaux (par section)
- Certaines sections ont leurs propres filtres additionnels
- Ex: Section "Requetes" a un search box pour filtrer

### Tri des Tables
- Clic sur header = tri croissant/decroissant
- Indicateur visuel de la colonne triee (^/v)

### Pagination
- Tables avec plus de 20 lignes: pagination
- Format: "1 - 20 / 458" avec < > navigation

### Search Box
- Pour tables avec beaucoup de lignes (keywords, requetes, URLs)
- Filtrage en temps reel pendant la frappe

### Drill-down
- Tables hierarchiques: Campaign > Ad Group > Keyword
- Navigation par clic ou par boutons

### Delta Indicators
- Toutes les metriques cles montrent le D vs periode precedente
- Vert + = amelioration, Rouge - = degradation
- Certaines metriques inversees (ex: Cout + = rouge)
- Dans scorecards: valeur + delta + vs previous (quand il y a de la place)
- Dans tables: colonne D dediee pour metriques cles (Cout, Conv, Leads)

### Sparklines
- Mini graphiques sous les KPIs
- Derniers 30 jours de donnees
- Meme couleur que le KPI

### Export
- Export CSV par table
- Export PDF de la page complete

---

## Donnees Disponibles (BigQuery)

### Google Ads
- `googleAds_v2.campaignPerformance` - Metriques campagne
- `googleAds_v2.campaignPerformanceWithConversionType` - Conversions detaillees + category
- `googleAds_v2.adGroupPerformance` - Metriques ad group
- `googleAds_v2.adGroupPerformanceWithConversionType` - Conversions ad group + category
- `googleAds_v2.keywordPerformance` - Metriques keywords
- `googleAds_v2.keywordPerformanceWithConversionType` - Conversions keywords + category
- `googleAds_v2.searchTerms` - Termes de recherche

### Meta Ads
- `meta_ads_v2.adsMetrics` - Metriques principales
- `meta_ads_v2.adsMetricsWithConversionType` - Conversions detaillees + category
- `meta_ads_v2.adsMetricsGenderBreakdown` - Breakdown genre (donnees limitees)
- `meta_ads_v2.adsMetricsDeviceBreakdown` - Breakdown device (donnees limitees)
- `meta_ads_v2.adsMetricsPlacementBreakdown` - Breakdown placement (donnees limitees)

### LinkedIn Ads
- `linkedin_ads_v2.AdMetrics` - Metriques campagne (donnees completes 2025-2026)

### GA4 (nouvelle structure 5 tables - Janvier 2025)
- `googleAnalytics_v2.traffic_daily` - Trafic journalier par canal
  - Colonnes: property_name, date, sessionDefaultChannelGroup, sessions, totalUsers, newUsers,
    screenPageViews, engagedSessions, bounces, averageSessionDuration
- `googleAnalytics_v2.events` - Événements avec catégorisation
  - Colonnes: property_name, date, eventName, eventCount, eventValue, event_category (LEAD/CONVERSION/ENGAGEMENT)
- `googleAnalytics_v2.pages` - Pages vues et landing pages
  - Colonnes: property_name, date, pagePath, pageTitle, screenPageViews, sessions, averageSessionDuration
- `googleAnalytics_v2.audience` - Démographie et appareils
  - Colonnes: property_name, date, country, deviceCategory, totalUsers, sessions
- `googleAnalytics_v2.activity` - Activité par jour/heure (optionnel)
  - Colonnes: property_name, date, dayOfWeek, hour, totalUsers, sessions

### Search Console
- `search_console_v2.gsc_date` - Donnees par date
- `search_console_v2.gsc_date_query` - Par requete
- `search_console_v2.gsc_date_page` - Par page
- `search_console_v2.gsc_date_device` - Par device
- `search_console_v2.gsc_date_country` - Par pays

---

## Prochaines Etapes

### Phase 1: Backfills Urgents
- [ ] GA4: Backfill tous les mois 2025 (actuellement seulement 5 jours)
- [ ] Meta breakdowns: Backfill 2025 pour gender/device/placement

### Phase 2: Categorisation GA4
- [ ] Identifier tous les event names GA4
- [ ] Creer mapping LEAD/CONVERSION dans Google Sheet
- [ ] Implementer dans le pipeline

### Phase 3: Composants UI
- [ ] ScoreCard avec sparkline + delta + vs previous
- [ ] DataTable avec sorting, search, pagination, inline bars, colonnes delta
- [ ] FilterPill avec multi-select
- [ ] DonutChart
- [ ] DualAxisLineChart

### Phase 4: Implementation Pages
1. Google Ads (avec filtre marque auto)
2. Meta Ads
3. LinkedIn Ads (NOUVELLE PAGE)
4. GA4
5. Search Console
6. Paid Media (combined)

### Phase 5: Interactions Avancees
- Cross-filtering
- Drill-down navigation
- Export ameliore
