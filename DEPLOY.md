# Déploiement Dashboard API

## Prérequis
- Google Cloud SDK installé (`gcloud`)
- Projet GCP: `mydigipal`

## Étapes

### 1. Cloner le repo
```bash
git clone https://github.com/MyDigipal/mydigipal-dashboard.git
cd mydigipal-dashboard/api
```

### 2. Déployer l'API sur Cloud Run
```bash
gcloud run deploy dashboard-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project mydigipal
```

### 3. Copier l'URL générée
Elle ressemblera à: `https://dashboard-api-53817551397.us-central1.run.app`

### 4. Activer GitHub Pages
1. Aller sur https://github.com/MyDigipal/mydigipal-dashboard/settings/pages
2. Source: "Deploy from a branch"
3. Branch: main / (root)
4. Save

### 5. Mettre à jour l'URL API dans le frontend
Modifier `index.html` ligne ~200 avec l'URL Cloud Run:
```javascript
const API_URL = 'https://dashboard-api-XXXXX.us-central1.run.app';
```

## URLs finales
- **Dashboard**: https://mydigipal.github.io/mydigipal-dashboard/
- **API**: https://dashboard-api-XXXXX.us-central1.run.app

## Pour héberger sur ton domaine
Créer un CNAME pour `dashboard.mydigipal.com` pointant vers `mydigipal.github.io`
Puis dans GitHub Pages, ajouter le custom domain.
