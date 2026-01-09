// MyDigipal Dashboard - Main Application
// Orchestrates all modules and handles data loading

class DashboardApp {
  constructor() {
    this.currentFilters = {
      dateFrom: null,
      dateTo: null,
      includePaul: false
    };
    this.initialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    if (this.initialized) return;

    console.log('🚀 Initializing MyDigipal Dashboard...');

    try {
      // Initialize auth
      window.authManager.init();

      // Only continue if authenticated
      if (!window.authManager.isAuthenticated()) {
        return;
      }

      // Initialize tabs
      window.tabManager.init();

      // Hide admin tabs if not admin
      if (!window.authManager.checkIsAdmin()) {
        window.tabManager.hideAdminTabs();
      }

      // Setup date filters
      this.setupDateFilters();

      // Setup event listeners
      this.setupEventListeners();

      // Load initial data for current tab
      const currentTab = window.tabManager.getCurrentTab();
      if (currentTab) {
        await this.loadTab(currentTab);
      }

      this.initialized = true;
      console.log('✅ Dashboard initialized successfully');

    } catch (error) {
      console.error('❌ Dashboard initialization error:', error);
      window.toastManager.error('Erreur d\'initialisation du dashboard');
    }
  }

  /**
   * Setup date filter controls
   */
  setupDateFilters() {
    // Date presets
    const presets = document.querySelectorAll('.date-preset');
    presets.forEach(preset => {
      preset.addEventListener('click', () => {
        this.applyDatePreset(preset.dataset.preset);
      });
    });

    // Custom date range
    const applyBtn = document.getElementById('applyDateRange');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;
        this.applyCustomDateRange(dateFrom, dateTo);
      });
    }

    // Paul filter toggle
    const paulToggle = document.getElementById('includePaulCheckbox');
    if (paulToggle) {
      paulToggle.addEventListener('change', (e) => {
        this.currentFilters.includePaul = e.target.checked;
        this.refreshCurrentTab();
      });
    }
  }

  /**
   * Setup other event listeners
   */
  setupEventListeners() {
    // Client selector (for Client tab)
    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) {
      clientSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          this.loadClientDetail(e.target.value);
        }
      });
    }

    // Planning month selector
    const monthSelect = document.getElementById('planningMonthSelect');
    if (monthSelect) {
      monthSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          this.loadBudgetProgress(e.target.value);
        }
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.authManager.logout();
      });
    }
  }

  /**
   * Apply date preset (Last 7 days, Last 30 days, etc.)
   * @param {string} preset - Preset identifier
   */
  applyDatePreset(preset) {
    const today = new Date();
    let dateFrom, dateTo;

    switch (preset) {
      case '7days':
        dateFrom = new Date(today.setDate(today.getDate() - 7));
        dateTo = new Date();
        break;
      case '30days':
        dateFrom = new Date(today.setDate(today.getDate() - 30));
        dateTo = new Date();
        break;
      case '90days':
        dateFrom = new Date(today.setDate(today.getDate() - 90));
        dateTo = new Date();
        break;
      case 'ytd':
        dateFrom = new Date(new Date().getFullYear(), 0, 1);
        dateTo = new Date();
        break;
      case 'all':
        dateFrom = null;
        dateTo = null;
        break;
    }

    this.currentFilters.dateFrom = dateFrom ? dateFrom.toISOString().split('T')[0] : null;
    this.currentFilters.dateTo = dateTo ? dateTo.toISOString().split('T')[0] : null;

    // Update active preset button
    document.querySelectorAll('.date-preset').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Refresh data
    this.refreshCurrentTab();
  }

  /**
   * Apply custom date range
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   */
  applyCustomDateRange(dateFrom, dateTo) {
    this.currentFilters.dateFrom = dateFrom || null;
    this.currentFilters.dateTo = dateTo || null;

    // Update active preset button (clear all)
    document.querySelectorAll('.date-preset').forEach(btn => {
      btn.classList.remove('active');
    });

    // Refresh data
    this.refreshCurrentTab();
  }

  /**
   * Refresh data for current tab
   */
  async refreshCurrentTab() {
    const currentTab = window.tabManager.getCurrentTab();
    if (currentTab) {
      // Clear API cache to force fresh data
      window.apiClient.clearCache();
      // Clear chart cache
      window.chartManager.clearCache();
      // Reload tab
      await this.loadTab(currentTab);
    }
  }

  /**
   * Load data for a specific tab
   * @param {string} tabId - Tab identifier
   */
  async loadTab(tabId) {
    console.log(`📊 Loading tab: ${tabId}`);

    try {
      const { dateFrom, dateTo, includePaul } = this.currentFilters;

      switch (tabId) {
        case 'rentabilite':
          await this.loadRentabilite(dateFrom, dateTo, includePaul);
          break;
        case 'evolution':
          await this.loadEvolution(dateFrom, dateTo, includePaul);
          break;
        case 'heures':
          await this.loadHeures(dateFrom, dateTo);
          break;
        case 'client':
          await this.loadClientTab(dateFrom, dateTo);
          break;
        case 'planning':
          await this.loadPlanning();
          break;
      }
    } catch (error) {
      console.error(`Error loading tab ${tabId}:`, error);
      window.toastManager.error('Erreur de chargement des données');
    }
  }

  /**
   * Load Rentabilité tab (admin only)
   */
  async loadRentabilite(dateFrom, dateTo, includePaul) {
    const data = await window.apiClient.getClients(dateFrom, dateTo, includePaul);

    // Update KPIs
    const totalRevenue = data.reduce((sum, c) => sum + c.revenue, 0);
    const totalCost = data.reduce((sum, c) => sum + c.cost, 0);
    const totalProfit = data.reduce((sum, c) => sum + c.profit, 0);
    const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(0) : 0;

    document.getElementById('kpiRevenue').textContent = '£' + totalRevenue.toLocaleString('en-GB');
    document.getElementById('kpiCost').textContent = '£' + totalCost.toLocaleString('en-GB');
    document.getElementById('kpiProfit').textContent = '£' + totalProfit.toLocaleString('en-GB');
    document.getElementById('kpiMargin').textContent = avgMargin + '%';

    // Render chart
    window.chartManager.renderClientsChart(data);

    // Update table (simplified - would need more code for full table)
    console.log('✅ Rentabilité loaded:', data.length, 'clients');
  }

  /**
   * Load Évolution tab (admin only)
   */
  async loadEvolution(dateFrom, dateTo, includePaul) {
    const data = await window.apiClient.getMonthly(dateFrom, dateTo, includePaul);

    // Render chart
    window.chartManager.renderMonthlyChart(data);

    console.log('✅ Évolution loaded:', data.length, 'months');
  }

  /**
   * Load Heures tab
   */
  async loadHeures(dateFrom, dateTo) {
    const data = await window.apiClient.getEmployees(dateFrom, dateTo);

    // Render chart
    window.chartManager.renderEmployeesChart(data);

    console.log('✅ Heures loaded:', data.length, 'employees');
  }

  /**
   * Load Client tab
   */
  async loadClientTab(dateFrom, dateTo) {
    const clients = await window.apiClient.getClientsWithHours(dateFrom, dateTo);

    // Populate client dropdown
    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) {
      clientSelect.innerHTML = '<option value="">Sélectionner un client...</option>' +
        clients.map(c => `<option value="${c.client_id}">${c.client_name} (${c.total_hours}h)</option>`).join('');
    }

    console.log('✅ Client tab loaded:', clients.length, 'clients');
  }

  /**
   * Load client detail (timeline)
   * @param {string} clientId - Client ID
   */
  async loadClientDetail(clientId) {
    const { dateFrom, dateTo } = this.currentFilters;
    const data = await window.apiClient.getClientTimeline(clientId, dateFrom, dateTo);

    // Update total hours display
    const totalHours = data.totals.reduce((sum, e) => sum + e.total_hours, 0);
    document.getElementById('clientTotalHours').textContent = totalHours.toFixed(1) + ' heures';

    // Render timeline chart
    const employees = data.totals.map(e => e.employee_name);
    window.chartManager.renderClientTimelineChart(data.daily, employees);

    console.log('✅ Client detail loaded:', data.client_name);
  }

  /**
   * Load Planning tab
   */
  async loadPlanning() {
    // Get available months
    const months = await window.apiClient.getBudgetMonths();

    // Populate month dropdown
    const monthSelect = document.getElementById('planningMonthSelect');
    if (monthSelect && months.length > 0) {
      monthSelect.innerHTML = months.map(m => {
        const [year, month] = m.split('-');
        const monthName = CONFIG.MONTH_NAMES_FR[parseInt(month) - 1];
        return `<option value="${m}">${monthName} ${year.slice(2)}</option>`;
      }).join('');

      // Load first month by default
      await this.loadBudgetProgress(months[0]);
    }

    console.log('✅ Planning loaded:', months.length, 'months available');
  }

  /**
   * Load budget progress for a specific month
   * @param {string} month - Month in YYYY-MM format
   */
  async loadBudgetProgress(month) {
    const data = await window.apiClient.getBudgetProgress(month);

    // Update summary cards
    const totalBudgeted = data.clients.reduce((sum, c) => sum + c.budgeted_hours, 0);
    const totalActual = data.clients.reduce((sum, c) => sum + c.actual_hours, 0);
    const remaining = totalBudgeted - totalActual;

    document.getElementById('planningTotalBudget').textContent = totalBudgeted.toFixed(0) + 'h';
    document.getElementById('planningTotalActual').textContent = totalActual.toFixed(0) + 'h';
    document.getElementById('planningRemaining').textContent = remaining.toFixed(0) + 'h';
    document.getElementById('planningMonthProgress').textContent = data.month_progress_pct + '%';

    // Render planning cards (simplified - would need more code for full implementation)
    console.log('✅ Budget progress loaded for', month, ':', data.clients.length, 'clients');
  }
}

// Create global app instance
window.app = new DashboardApp();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.app.init());
} else {
  window.app.init();
}
