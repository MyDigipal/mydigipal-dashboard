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
    this.clientsData = []; // Store for sorting
    this.sortState = {
      column: null,
      ascending: false
    };
    this.sortHandlersSetup = false; // Track if handlers are already setup
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

      // Apply default date filter (last month)
      this.applyDatePresetDefault('lastmonth');

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
    const paulToggleLabel = document.getElementById('filterTogglePaul');
    if (paulToggle && paulToggleLabel) {
      // Toggle on label click
      paulToggleLabel.addEventListener('click', () => {
        paulToggle.checked = !paulToggle.checked;
        paulToggleLabel.classList.toggle('active', paulToggle.checked);
        this.currentFilters.includePaul = paulToggle.checked;
        this.refreshCurrentTab();
      });
    }
  }

  /**
   * Setup other event listeners
   */
  setupEventListeners() {
    // Internal filter toggle (Hours tab)
    const internalToggle = document.getElementById('excludeInternalCheckbox');
    const internalToggleLabel = document.getElementById('filterToggleInternal');
    if (internalToggle && internalToggleLabel) {
      internalToggleLabel.addEventListener('click', () => {
        internalToggle.checked = !internalToggle.checked;
        internalToggleLabel.classList.toggle('active', internalToggle.checked);
        // Refresh hours charts
        this.refreshCurrentTab();
      });
    }

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
   * Apply date preset default (without refreshing - used at init)
   * @param {string} preset - Preset identifier
   */
  applyDatePresetDefault(preset) {
    const today = new Date();
    let dateFrom, dateTo, label;

    switch (preset) {
      case 'lastmonth':
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        dateFrom = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        dateTo = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
        const monthName = CONFIG.MONTH_NAMES_FR[lastMonth.getMonth()];
        label = `${monthName} ${lastMonth.getFullYear()}`;
        break;
    }

    this.currentFilters.dateFrom = dateFrom ? dateFrom.toISOString().split('T')[0] : null;
    this.currentFilters.dateTo = dateTo ? dateTo.toISOString().split('T')[0] : null;

    // Update current period label
    this.updatePeriodLabel(label);

    // Update active preset button
    document.querySelectorAll('.date-preset').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.preset === preset) {
        btn.classList.add('active');
      }
    });
  }

  /**
   * Apply date preset (Last 7 days, Last 30 days, etc.)
   * @param {string} preset - Preset identifier
   */
  applyDatePreset(preset) {
    const today = new Date();
    let dateFrom, dateTo, label;

    switch (preset) {
      case '7days':
        dateFrom = new Date(today.setDate(today.getDate() - 7));
        dateTo = new Date();
        label = '7 derniers jours';
        break;
      case '30days':
        dateFrom = new Date(today.setDate(today.getDate() - 30));
        dateTo = new Date();
        label = '30 derniers jours';
        break;
      case '90days':
        dateFrom = new Date(today.setDate(today.getDate() - 90));
        dateTo = new Date();
        label = '90 derniers jours';
        break;
      case 'lastmonth':
        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        dateFrom = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        dateTo = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
        const monthName = CONFIG.MONTH_NAMES_FR[lastMonth.getMonth()];
        label = `${monthName} ${lastMonth.getFullYear()}`;
        break;
      case 'ytd':
        dateFrom = new Date(new Date().getFullYear(), 0, 1);
        dateTo = new Date();
        label = 'Année en cours';
        break;
      case 'all':
        dateFrom = null;
        dateTo = null;
        label = 'Toutes les données';
        break;
    }

    this.currentFilters.dateFrom = dateFrom ? dateFrom.toISOString().split('T')[0] : null;
    this.currentFilters.dateTo = dateTo ? dateTo.toISOString().split('T')[0] : null;

    // Update current period label
    this.updatePeriodLabel(label);

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

    // Update current period label
    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      const label = `${from.toLocaleDateString('fr-FR')} - ${to.toLocaleDateString('fr-FR')}`;
      this.updatePeriodLabel(label);
    } else if (dateFrom) {
      this.updatePeriodLabel(`Depuis ${new Date(dateFrom).toLocaleDateString('fr-FR')}`);
    } else if (dateTo) {
      this.updatePeriodLabel(`Jusqu'au ${new Date(dateTo).toLocaleDateString('fr-FR')}`);
    }

    // Update active preset button (clear all)
    document.querySelectorAll('.date-preset').forEach(btn => {
      btn.classList.remove('active');
    });

    // Refresh data
    this.refreshCurrentTab();
  }

  /**
   * Update period label display
   * @param {string} label - Label to display
   */
  updatePeriodLabel(label) {
    const periodElement = document.getElementById('currentPeriod');
    if (periodElement) {
      periodElement.textContent = label;
    }
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
        case 'clients':
          await this.loadRentabilite(dateFrom, dateTo, includePaul);
          break;
        case 'monthly':
          await this.loadEvolution(dateFrom, dateTo, includePaul);
          break;
        case 'performance':
          await this.loadPerformance(dateFrom, dateTo);
          break;
        case 'hours':
          await this.loadHeures(dateFrom, dateTo);
          break;
        case 'clientdetail':
          await this.loadClientTab(dateFrom, dateTo);
          break;
        case 'planning':
          await this.loadPlanning();
          break;
        case 'health':
          await window.healthManager.loadHealth();
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

    // Store data for sorting
    this.clientsData = data;

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

    // Render table with sort handlers
    this.renderClientsTable(data);
    this.setupTableSortHandlers();

    console.log('✅ Rentabilité loaded:', data.length, 'clients');
  }

  /**
   * Setup table sort handlers (clickable column headers)
   */
  setupTableSortHandlers() {
    if (this.sortHandlersSetup) return; // Only setup once

    const headers = document.querySelectorAll('#clientsTable thead th');
    const columnMap = ['client_name', 'revenue', 'cost', 'hours', 'profit', 'margin'];

    headers.forEach((header, index) => {
      header.style.cursor = 'pointer';
      header.style.userSelect = 'none';
      header.addEventListener('click', () => {
        this.sortClientsTable(columnMap[index]);
      });
    });

    this.sortHandlersSetup = true;
  }

  /**
   * Sort clients table by column
   * @param {string} column - Column name to sort by
   */
  sortClientsTable(column) {
    // Toggle direction if same column, otherwise start descending for numbers
    if (this.sortState.column === column) {
      this.sortState.ascending = !this.sortState.ascending;
    } else {
      this.sortState.column = column;
      // For numbers: start with descending (false), for client_name: start with ascending (true)
      this.sortState.ascending = false;
    }

    // Sort data
    const sortedData = [...this.clientsData].sort((a, b) => {
      let aVal, bVal;

      if (column === 'client_name') {
        aVal = a.client_name.toLowerCase();
        bVal = b.client_name.toLowerCase();
        return this.sortState.ascending ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      } else if (column === 'profit') {
        aVal = (a.revenue || 0) - (a.cost || 0);
        bVal = (b.revenue || 0) - (b.cost || 0);
      } else if (column === 'margin') {
        aVal = a.revenue ? ((a.revenue - a.cost) / a.revenue) * 100 : 0;
        bVal = b.revenue ? ((b.revenue - b.cost) / b.revenue) * 100 : 0;
      } else {
        aVal = a[column] || 0;
        bVal = b[column] || 0;
      }

      if (column !== 'client_name') {
        // ascending=false: grand → petit (bVal - aVal), ascending=true: petit → grand (aVal - bVal)
        return this.sortState.ascending ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    // Re-render table with sorted data
    this.renderClientsTable(sortedData);
  }

  /**
   * Render clients table
   * @param {Array} data - Clients data
   */
  renderClientsTable(data) {
    const tbody = document.querySelector('#clientsTable tbody');
    const tfoot = document.getElementById('clientsTableFooter');

    if (!tbody || !tfoot) return;

    const formatCurrency = (n) => '£' + (n || 0).toLocaleString('en-GB');
    const formatNumber = (n) => (n || 0).toLocaleString('en-GB');

    // Calculate totals
    const totals = data.reduce((acc, c) => ({
      revenue: acc.revenue + (c.revenue || 0),
      cost: acc.cost + (c.cost || 0),
      hours: acc.hours + (c.hours || 0)
    }), { revenue: 0, cost: 0, hours: 0 });

    const totalProfit = totals.revenue - totals.cost;
    const totalMargin = totals.revenue ? Math.round(totalProfit / totals.revenue * 100) : 0;

    // Render rows
    tbody.innerHTML = data.map(c => {
      const profit = (c.revenue || 0) - (c.cost || 0);
      const margin = c.revenue ? Math.round(profit / c.revenue * 100) : 0;
      return `
        <tr>
          <td><strong>${c.client_name}</strong></td>
          <td class="text-right text-green">${formatCurrency(c.revenue)}</td>
          <td class="text-right text-red">${formatCurrency(c.cost)}</td>
          <td class="text-right">${formatNumber(c.hours)}h</td>
          <td class="text-right ${profit >= 0 ? 'text-green' : 'text-red'}">${formatCurrency(profit)}</td>
          <td class="text-right">
            <span class="badge ${margin >= 70 ? 'high' : margin >= 50 ? 'medium' : 'low'}">${margin}%</span>
          </td>
        </tr>
      `;
    }).join('');

    // Render footer
    tfoot.innerHTML = `
      <tr class="total-row">
        <td><strong>TOTAL</strong></td>
        <td class="text-right">${formatCurrency(totals.revenue)}</td>
        <td class="text-right">${formatCurrency(totals.cost)}</td>
        <td class="text-right">${formatNumber(totals.hours)}h</td>
        <td class="text-right">${formatCurrency(totalProfit)}</td>
        <td class="text-right">
          <span class="badge ${totalMargin >= 70 ? 'high' : totalMargin >= 50 ? 'medium' : 'low'}" style="background: rgba(255,255,255,0.2); color: white;">${totalMargin}%</span>
        </td>
      </tr>
    `;
  }

  /**
   * Load Évolution tab (admin only)
   */
  async loadEvolution(dateFrom, dateTo, includePaul) {
    const data = await window.apiClient.getMonthly(dateFrom, dateTo, includePaul);

    // Calculate MoM and YoY comparisons
    this.calculateComparisons(data);

    // Render chart
    window.chartManager.renderMonthlyChart(data);

    console.log('✅ Évolution loaded:', data.length, 'months');
  }

  /**
   * Calculate Month-over-Month and Year-over-Year comparisons
   * @param {Array} data - Monthly data
   */
  calculateComparisons(data) {
    if (!data || data.length === 0) return;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth());
    const lastYearStr = `${lastYear.getFullYear()}-${String(lastYear.getMonth() + 1).padStart(2, '0')}`;

    const currentData = data.find(d => d.month === currentMonth);
    const lastMonthData = data.find(d => d.month === lastMonthStr);
    const lastYearData = data.find(d => d.month === lastYearStr);

    // Month-over-Month
    if (currentData && lastMonthData) {
      this.renderComparison('mom', currentData, lastMonthData);
    } else {
      this.renderComparison('mom', null, null);
    }

    // Year-over-Year
    if (currentData && lastYearData) {
      this.renderComparison('yoy', currentData, lastYearData);
    } else {
      this.renderComparison('yoy', null, null);
    }
  }

  /**
   * Render comparison stats (MoM or YoY)
   * @param {string} type - 'mom' or 'yoy'
   * @param {Object} current - Current period data
   * @param {Object} previous - Previous period data
   */
  renderComparison(type, current, previous) {
    const prefix = type === 'mom' ? 'mom' : 'yoy';

    if (!current || !previous) {
      document.getElementById(`${prefix}Revenue`).textContent = '-';
      document.getElementById(`${prefix}Profit`).textContent = '-';
      document.getElementById(`${prefix}Margin`).textContent = '-';
      document.getElementById(`${prefix}Hours`).textContent = '-';
      document.getElementById(`${prefix}RevenueTrend`).textContent = '';
      document.getElementById(`${prefix}ProfitTrend`).textContent = '';
      document.getElementById(`${prefix}MarginTrend`).textContent = '';
      document.getElementById(`${prefix}HoursTrend`).textContent = '';
      return;
    }

    const formatCurrency = (n) => '£' + (n || 0).toLocaleString('en-GB');
    const formatNumber = (n) => (n || 0).toLocaleString('en-GB');

    const revenueDiff = current.revenue - previous.revenue;
    const revenuePct = previous.revenue ? ((revenueDiff / previous.revenue) * 100).toFixed(0) : 0;

    const profitDiff = current.profit - previous.profit;
    const profitPct = previous.profit ? ((profitDiff / previous.profit) * 100).toFixed(0) : 0;

    const currentMargin = current.revenue ? ((current.profit / current.revenue) * 100).toFixed(0) : 0;
    const previousMargin = previous.revenue ? ((previous.profit / previous.revenue) * 100).toFixed(0) : 0;
    const marginDiff = currentMargin - previousMargin;

    const hoursDiff = (current.hours || 0) - (previous.hours || 0);
    const hoursPct = previous.hours ? ((hoursDiff / previous.hours) * 100).toFixed(0) : 0;

    // Update values
    document.getElementById(`${prefix}Revenue`).textContent = formatCurrency(current.revenue);
    document.getElementById(`${prefix}Profit`).textContent = formatCurrency(current.profit);
    document.getElementById(`${prefix}Margin`).textContent = currentMargin + '%';
    document.getElementById(`${prefix}Hours`).textContent = formatNumber(current.hours) + 'h';

    // Update trends
    this.renderTrend(`${prefix}RevenueTrend`, revenuePct, formatCurrency(revenueDiff));
    this.renderTrend(`${prefix}ProfitTrend`, profitPct, formatCurrency(profitDiff));
    this.renderTrend(`${prefix}MarginTrend`, marginDiff, marginDiff + ' pts');
    this.renderTrend(`${prefix}HoursTrend`, hoursPct, formatNumber(hoursDiff) + 'h');
  }

  /**
   * Render trend indicator
   * @param {string} elementId - Element ID
   * @param {number} pct - Percentage change
   * @param {string} label - Label to display
   */
  renderTrend(elementId, pct, label) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const isPositive = pct > 0;
    const isNegative = pct < 0;
    const arrow = isPositive ? '↑' : isNegative ? '↓' : '→';
    const sign = isPositive ? '+' : '';

    element.textContent = `${arrow} ${sign}${pct}% (${label})`;
    element.className = 'stat-trend ' + (isPositive ? 'positive' : isNegative ? 'negative' : 'neutral');
  }

  /**
   * Load Performance tab (admin only)
   */
  async loadPerformance(dateFrom, dateTo) {
    // Get employee hours data
    const employeesData = await window.apiClient.getEmployees(dateFrom, dateTo);

    // Get employee performance data (new endpoint needed, or calculate from existing)
    // For now, we'll use a workaround with existing endpoints
    const performanceData = await this.calculatePerformanceMetrics(dateFrom, dateTo);

    // Render charts
    window.chartManager.renderBillableRateChart(performanceData);
    window.chartManager.renderEmployeeRevenueChart(performanceData);

    // Render table
    this.renderPerformanceTable(performanceData);

    console.log('✅ Performance loaded:', performanceData.length, 'employees');
  }

  /**
   * Calculate performance metrics for employees
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   * @returns {Array} Performance data by employee
   */
  async calculatePerformanceMetrics(dateFrom, dateTo) {
    // Get all timesheets data (we'll need to call the API or use existing data)
    // For simplicity, we'll aggregate from getEmployees and calculate billable vs non-billable

    const employeesData = await window.apiClient.getEmployees(dateFrom, dateTo);

    // Get client data to estimate revenue per employee
    // This is a simplified calculation - in production you'd want a dedicated endpoint
    const clientsData = await window.apiClient.getClients(dateFrom, dateTo, false);

    // For each employee, calculate:
    // - Total hours (from employeesData)
    // - Billable hours (total - MyDigipal hours)
    // - Billable rate (billable / total * 100)
    // - Revenue generated (estimated from client data)

    const performance = employeesData.map(emp => {
      // For now, we'll estimate that 80% of hours are billable
      // In production, you'd query this from BigQuery filtering by client != 'MyDigipal'
      const totalHours = emp.total_hours;
      const billableHours = totalHours * 0.85; // Estimate 85% billable (you can adjust)
      const billableRate = (billableHours / totalHours * 100).toFixed(0);

      // Estimate revenue and cost (would need actual data from API)
      const avgHourlyRate = 100; // £100/hour average
      const revenue = billableHours * avgHourlyRate;
      const cost = totalHours * 50; // £50/hour cost estimate
      const profit = revenue - cost;

      return {
        employee_name: emp.employee_name,
        total_hours: totalHours,
        billable_hours: billableHours,
        billable_rate: parseFloat(billableRate),
        revenue: revenue,
        cost: cost,
        profit: profit
      };
    });

    return performance.sort((a, b) => b.billable_rate - a.billable_rate);
  }

  /**
   * Render performance table
   * @param {Array} data - Performance data
   */
  renderPerformanceTable(data) {
    const tbody = document.querySelector('#performanceTable tbody');
    const tfoot = document.getElementById('performanceTableFooter');

    if (!tbody || !tfoot) return;

    const formatCurrency = (n) => '£' + (n || 0).toLocaleString('en-GB');
    const formatNumber = (n) => (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 1 });

    // Calculate totals
    const totals = data.reduce((acc, e) => ({
      totalHours: acc.totalHours + e.total_hours,
      billableHours: acc.billableHours + e.billable_hours,
      revenue: acc.revenue + e.revenue,
      cost: acc.cost + e.cost,
      profit: acc.profit + e.profit
    }), { totalHours: 0, billableHours: 0, revenue: 0, cost: 0, profit: 0 });

    const avgBillableRate = totals.totalHours ? (totals.billableHours / totals.totalHours * 100).toFixed(0) : 0;

    // Render rows
    tbody.innerHTML = data.map(e => {
      const color = CONFIG.COLORS.EMPLOYEES[e.employee_name] || '#666';
      return `
        <tr>
          <td>
            <span style="display: inline-block; width: 12px; height: 12px; background: ${color}; border-radius: 3px; margin-right: 8px;"></span>
            <strong>${e.employee_name}</strong>
          </td>
          <td class="text-right">${formatNumber(e.total_hours)}h</td>
          <td class="text-right">${formatNumber(e.billable_hours)}h</td>
          <td class="text-right">
            <span class="badge ${e.billable_rate >= 80 ? 'high' : e.billable_rate >= 60 ? 'medium' : 'low'}">${e.billable_rate}%</span>
          </td>
          <td class="text-right text-green">${formatCurrency(e.revenue)}</td>
          <td class="text-right text-red">${formatCurrency(e.cost)}</td>
          <td class="text-right ${e.profit >= 0 ? 'text-green' : 'text-red'}">${formatCurrency(e.profit)}</td>
        </tr>
      `;
    }).join('');

    // Render footer
    tfoot.innerHTML = `
      <tr class="total-row">
        <td><strong>TOTAL</strong></td>
        <td class="text-right">${formatNumber(totals.totalHours)}h</td>
        <td class="text-right">${formatNumber(totals.billableHours)}h</td>
        <td class="text-right">
          <span class="badge ${avgBillableRate >= 80 ? 'high' : avgBillableRate >= 60 ? 'medium' : 'low'}" style="background: rgba(255,255,255,0.2); color: white;">${avgBillableRate}%</span>
        </td>
        <td class="text-right">${formatCurrency(totals.revenue)}</td>
        <td class="text-right">${formatCurrency(totals.cost)}</td>
        <td class="text-right">${formatCurrency(totals.profit)}</td>
      </tr>
    `;
  }

  /**
   * Load Heures tab
   */
  async loadHeures(dateFrom, dateTo) {
    const data = await window.apiClient.getEmployees(dateFrom, dateTo);

    // Render chart
    window.chartManager.renderEmployeesChart(data);

    // Render table
    this.renderEmployeesTable(data);

    console.log('✅ Heures loaded:', data.length, 'employees');
  }

  /**
   * Render employees hours table
   * @param {Array} data - Employees data
   */
  renderEmployeesTable(data) {
    const tbody = document.querySelector('#employeesTable tbody');
    const tfoot = document.getElementById('employeesTableFooter');

    if (!tbody || !tfoot) return;

    const totalHours = data.reduce((sum, e) => sum + e.total_hours, 0);
    const sortedData = [...data].sort((a, b) => b.total_hours - a.total_hours);

    // Render rows
    tbody.innerHTML = sortedData.map(e => {
      const pct = totalHours > 0 ? Math.round(e.total_hours / totalHours * 100) : 0;
      const color = CONFIG.COLORS.EMPLOYEES[e.employee_name] || '#666';
      return `
        <tr>
          <td>
            <span style="display: inline-block; width: 12px; height: 12px; background: ${color}; border-radius: 3px; margin-right: 8px;"></span>
            <strong>${e.employee_name}</strong>
          </td>
          <td class="text-right">${e.total_hours.toFixed(1)}h</td>
          <td class="text-right">${pct}%</td>
        </tr>
      `;
    }).join('');

    // Render footer
    tfoot.innerHTML = `
      <tr class="total-row">
        <td><strong>TOTAL</strong></td>
        <td class="text-right">${totalHours.toFixed(1)}h</td>
        <td class="text-right">100%</td>
      </tr>
    `;
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

    // Show client detail content, hide empty state
    document.getElementById('clientDetailContent').style.display = 'block';
    document.getElementById('clientDetailEmpty').style.display = 'none';

    // Update total hours display
    const totalHours = data.totals.reduce((sum, e) => sum + e.total_hours, 0);
    document.getElementById('clientTotalHours').textContent = totalHours.toFixed(1) + ' heures';

    // Render timeline chart
    const employees = data.totals.map(e => e.employee_name);
    window.chartManager.renderClientTimelineChart(data.daily, employees);

    // Render employee doughnut chart
    window.chartManager.renderClientEmployeesDoughnut(data.totals);

    // Render employee breakdown table
    this.renderClientEmployeesTable(data.totals);

    console.log('✅ Client detail loaded:', data.client_name);
  }

  /**
   * Render client employees table
   * @param {Array} totals - Employee totals
   */
  renderClientEmployeesTable(totals) {
    const tbody = document.querySelector('#clientEmployeesTable tbody');
    if (!tbody) return;

    const totalHours = totals.reduce((sum, t) => sum + t.total_hours, 0);
    const sortedTotals = [...totals].sort((a, b) => b.total_hours - a.total_hours);

    tbody.innerHTML = sortedTotals.map(t => {
      const pct = totalHours > 0 ? Math.round(t.total_hours / totalHours * 100) : 0;
      const color = CONFIG.COLORS.EMPLOYEES[t.employee_name] || '#666';
      return `
        <tr>
          <td>
            <span style="display: inline-block; width: 12px; height: 12px; background: ${color}; border-radius: 3px; margin-right: 8px;"></span>
            <strong>${t.employee_name}</strong>
          </td>
          <td class="text-right">${t.total_hours.toFixed(1)}h</td>
          <td class="text-right">${pct}%</td>
        </tr>
      `;
    }).join('');
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

    if (!data.clients || data.clients.length === 0) {
      document.getElementById('planningCards').innerHTML = '';
      document.getElementById('planningEmpty').style.display = 'block';
      document.getElementById('planningSummary').style.display = 'none';
      return;
    }

    document.getElementById('planningEmpty').style.display = 'none';
    document.getElementById('planningSummary').style.display = 'grid';

    // Update summary cards
    const totalBudgeted = data.clients.reduce((sum, c) => sum + c.budgeted_hours, 0);
    const totalActual = data.clients.reduce((sum, c) => sum + c.actual_hours, 0);
    const remaining = totalBudgeted - totalActual;

    document.getElementById('planningTotalBudget').textContent = totalBudgeted.toFixed(0) + 'h';
    document.getElementById('planningTotalActual').textContent = totalActual.toFixed(0) + 'h';
    document.getElementById('planningRemaining').textContent = remaining.toFixed(0) + 'h';
    document.getElementById('planningMonthProgress').textContent = data.month_progress_pct + '%';

    // Render planning cards
    this.renderPlanningCards(data.clients, data.month_progress_pct);

    console.log('✅ Budget progress loaded for', month, ':', data.clients.length, 'clients');
  }

  /**
   * Render planning cards for budget progress
   * @param {Array} clients - Client budget data
   * @param {number} monthProgressPct - Month progress percentage
   */
  renderPlanningCards(clients, monthProgressPct) {
    const cardsContainer = document.getElementById('planningCards');
    if (!cardsContainer) return;

    cardsContainer.innerHTML = clients.map((client, index) => {
      const progressWidth = Math.min(client.progress_pct, 100);
      const pacePosition = Math.min(monthProgressPct, 100);

      return `
        <div class="planning-card ${client.status}" style="animation-delay: ${index * 0.05}s">
          <div class="planning-card-header">
            <h4>${client.client_name}</h4>
            <span class="status-badge ${client.status}">
              ${client.status === 'ok' ? '✓ En bonne voie' :
                client.status === 'warning' ? '⚠️ Attention' :
                '🚨 Dépassé'}
            </span>
          </div>

          <div class="planning-card-stats">
            <span><strong>Budget:</strong> ${client.budgeted_hours}h</span>
            <span><strong>Réel:</strong> ${client.actual_hours}h</span>
            <span><strong>Restant:</strong> ${client.remaining_hours}h</span>
            <span class="${client.pace_diff > 0 ? 'text-red' : 'text-green'}">
              <strong>vs pace:</strong> ${client.pace_diff > 0 ? '+' : ''}${client.pace_diff}h
            </span>
          </div>

          <div class="progress-bar-container">
            <div class="progress-bar ${client.status}" style="width: ${progressWidth}%"></div>
            <div class="pace-marker" style="left: ${pacePosition}%" title="Position idéale: ${monthProgressPct}% du mois"></div>
            <span class="progress-text">${client.progress_pct}%</span>
          </div>

          ${client.employees && client.employees.length > 0 ? `
            <div class="planning-card-employees">
              ${client.employees.map((emp, idx) => `
                <span class="employee-chip">
                  <span class="dot" style="background: ${CONFIG.COLORS.EMPLOYEES[emp.employee_name] || CONFIG.COLORS.DEFAULT[idx % CONFIG.COLORS.DEFAULT.length]}"></span>
                  ${emp.employee_name}: ${emp.hours}h
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
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
