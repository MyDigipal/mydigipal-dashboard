// MyDigipal Dashboard - API Module
// Handles all API requests with caching, retry logic, and error handling

/**
 * Toast Notification Manager (Phase 3.2)
 * Shows elegant toast notifications for errors, warnings, and success messages
 */
class ToastManager {
  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Toast type: 'error', 'warning', 'success'
   */
  show(message, type = 'error') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add to body
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  error(message) {
    this.show(message, 'error');
  }

  warning(message) {
    this.show(message, 'warning');
  }

  success(message) {
    this.show(message, 'success');
  }
}

/**
 * API Client with caching and retry logic
 */
class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.cache = new Map();
    this.toastManager = new ToastManager();
  }

  /**
   * Fetch with automatic retry and caching
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @param {number} retries - Number of retries (default: 3)
   * @returns {Promise<any>} API response data
   */
  async fetchWithRetry(endpoint, options = {}, retries = 3) {
    const cacheKey = `${endpoint}${JSON.stringify(options)}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
        return cached.data;
      }
    }

    try {
      const response = await fetch(this.baseURL + endpoint, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache successful response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;

    } catch (error) {
      // Retry logic
      if (retries > 0) {
        const attemptNumber = 4 - retries;
        this.toastManager.warning(`Tentative ${attemptNumber}/3...`);

        await this.sleep(1000);
        return this.fetchWithRetry(endpoint, options, retries - 1);
      }

      // All retries failed
      this.toastManager.error('Erreur de chargement. Veuillez réessayer.');
      throw error;
    }
  }

  /**
   * Helper: Sleep for a given duration
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  // ========================================================================
  // API Endpoints
  // ========================================================================

  /**
   * Get list of clients with profitability data
   * @param {string} dateFrom - Start date (YYYY-MM-DD)
   * @param {string} dateTo - End date (YYYY-MM-DD)
   * @param {boolean} includePaul - Include Paul's internal hours
   * @returns {Promise<Array>} List of clients
   */
  async getClients(dateFrom = null, dateTo = null, includePaul = false) {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (includePaul) params.append('include_paul', 'true');

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithRetry(`/api/clients${query}`);
  }

  /**
   * Get monthly aggregated data
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   * @param {boolean} includePaul - Include Paul's hours
   * @returns {Promise<Array>} Monthly data
   */
  async getMonthly(dateFrom = null, dateTo = null, includePaul = false) {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (includePaul) params.append('include_paul', 'true');

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithRetry(`/api/monthly${query}`);
  }

  /**
   * Get employee workload data
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   * @returns {Promise<Array>} Employee data
   */
  async getEmployees(dateFrom = null, dateTo = null) {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithRetry(`/api/employees${query}`);
  }

  /**
   * Get employee breakdown by client
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   * @returns {Promise<Array>} Employee breakdown
   */
  async getEmployeesBreakdown(dateFrom = null, dateTo = null) {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithRetry(`/api/employees-breakdown${query}`);
  }

  /**
   * Get clients with hours logged
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   * @returns {Promise<Array>} Clients with hours
   */
  async getClientsWithHours(dateFrom = null, dateTo = null) {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithRetry(`/api/clients-with-hours${query}`);
  }

  /**
   * Get client timeline (daily hours by employee)
   * @param {string} clientId - Client ID
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   * @returns {Promise<Object>} Client timeline data
   */
  async getClientTimeline(clientId, dateFrom = null, dateTo = null) {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithRetry(`/api/client-timeline/${clientId}${query}`);
  }

  /**
   * Get budget progress for a specific month
   * @param {string} month - Month in YYYY-MM format
   * @returns {Promise<Object>} Budget progress data
   */
  async getBudgetProgress(month = null) {
    const params = new URLSearchParams();
    if (month) params.append('month', month);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetchWithRetry(`/api/budget-progress${query}`);
  }

  /**
   * Get list of months with budget data
   * @returns {Promise<Array>} List of months
   */
  async getBudgetMonths() {
    return this.fetchWithRetry('/api/budget-months');
  }

  /**
   * Get date range available in the system
   * @returns {Promise<Object>} {min_date, max_date}
   */
  async getDateRange() {
    return this.fetchWithRetry('/api/date-range');
  }

  /**
   * Get profitability alerts
   * @returns {Promise<Array>} List of alerts
   */
  async getAlerts() {
    return this.fetchWithRetry('/api/alerts');
  }
}

// Create global API client instance
window.apiClient = new APIClient(CONFIG.API_URL);

// Create global toast manager for external use
window.toastManager = window.apiClient.toastManager;
