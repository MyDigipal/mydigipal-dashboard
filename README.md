# MyDigipal Dashboard

Dashboard interactif de rentabilité connecté à BigQuery en temps réel.

## 🎯 Fonctionnalités

- **Rentabilité Clients** : Profit, coût, revenue, marge par client
- **Évolution Mensuelle** : Tendances revenue/profit/coût sur 12 mois
- **Équipe** : Heures par employé, détail mensuel par personne
- **Alertes** : Clients en perte ou sans facturation

## 🏗️ Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────┐
│  Frontend HTML  │ ───▶ │  Cloud Run API   │ ───▶ │   BigQuery   │
│  (GitHub Pages) │      │  (Flask/Python)  │      │   (marts.*)  │
└─────────────────┘      └──────────────────┘      └──────────────┘
```

## 🚀 Déploiement

### 1. API Backend (Cloud Run)

```bash
cd api

# Déployer sur Cloud Run
gcloud run deploy dashboard-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated

# Copier l'URL générée
```

### 2. Frontend (GitHub Pages)

1. Dans le repo GitHub, aller dans **Settings > Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / **(root)**
4. Save

Le dashboard sera disponible sur: `https://mydigipal.github.io/mydigipal-dashboard/`

### 3. Configuration

Mettre à jour `API_URL` dans `index.html` avec l'URL Cloud Run:

```javascript
const API_URL = 'https://dashboard-api-xxxxx.us-central1.run.app';
```

## 📊 Vues BigQuery requises

Le dashboard utilise ces vues dans le dataset `marts`:

- `marts.client_profitability` - Données mensuelles par client
- `marts.employee_workload` - Heures par employé/client/mois
- `marts.client_team_breakdown` - Équipe par client
- `marts.client_profitability_alerts` - Alertes rentabilité

## 🎨 Personnalisation

### Couleurs MyDigipal
- Titres: `#211F54`
- Bleu accent: `#0B6CD9`
- Vert: `#11845B`
- Orange: `#D5691B`
- Fond gris: `#EFF0F6`

### Ajouter une nouvelle vue

1. Créer l'endpoint dans `api/main.py`
2. Ajouter l'appel fetch dans `index.html`
3. Créer le rendu (table ou chart)

## 📝 Endpoints API

| Endpoint | Description |
|----------|-------------|
| `GET /api/clients` | Rentabilité par client (all-time) |
| `GET /api/monthly` | Totaux mensuels (12 mois) |
| `GET /api/employees` | Heures par employé |
| `GET /api/employee/{id}` | Détail mensuel employé |
| `GET /api/client/{id}` | Détail client + équipe |
| `GET /api/alerts` | Clients problématiques |

## 🔒 Sécurité

L'API est publique (`--allow-unauthenticated`). Pour restreindre l'accès:

1. Retirer `--allow-unauthenticated` du deploy
2. Ajouter authentification IAM ou API key
3. Configurer CORS pour n'accepter que votre domaine

---

*MyDigipal © 2025*
