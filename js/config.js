// MyDigipal Dashboard - Configuration
// Centralized configuration for the entire application

window.CONFIG = {
  // API Configuration
  API_URL: 'https://dashboard-api-53817551397.us-central1.run.app',

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: '53817551397-ejtf8sgg777dqlrlmfliqjcteat8lqf4.apps.googleusercontent.com',

  // User Access Control
  ADMIN_EMAILS: ['paul@mydigipal.com'],
  ALLOWED_EMAILS: [
    'paul@mydigipal.com',
    'jordan@mydigipal.com',
    'juliette@mydigipal.com',
    'alexandre@mydigipal.com',
    'alizee@mydigipal.com',
    'heather@mydigipal.com'
  ],

  // Application Settings
  INTERNAL_CLIENT: 'MyDigipal',
  CACHE_DURATION: 300000, // 5 minutes in milliseconds

  // Date & Localization
  MONTH_NAMES_FR: [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ],

  // Chart Colors
  COLORS: {
    PRIMARY: '#0B6CD9',
    SUCCESS: '#11845B',
    WARNING: '#D5691B',
    DANGER: '#dc2626',
    INFO: '#3b82f6',

    // Employee-specific colors for consistency
    EMPLOYEES: {
      'Alexandre': '#0B6CD9',
      'Jordan': '#11845B',
      'Juliette': '#D5691B',
      'Paul': '#dc2626',
      'Pradeep': '#8b5cf6',
      'Alizée': '#ec4899',
      'Heather': '#14b8a6',
      'Diksha': '#f59e0b'
    },

    // Chart palette for multiple series
    CHART_PALETTE: [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
      '#6366f1', '#84cc16'
    ]
  },

  // Feature Flags
  FEATURES: {
    EXPORT_CSV: true,
    EXPORT_PDF: true,
    ERROR_TOASTS: true,
    CHART_CACHE: true
  }
};
