// MyDigipal Dashboard - Authentication Module
// Handles Google OAuth Sign-in and user session management

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isAdmin = false;
    this.initialized = false;
  }

  /**
   * Initialize Google OAuth and check for existing session
   */
  init() {
    // Check if user is already logged in (from sessionStorage)
    const storedUser = sessionStorage.getItem('user');
    const storedIsAdmin = sessionStorage.getItem('isAdmin');

    if (storedUser) {
      try {
        this.currentUser = JSON.parse(storedUser);
        this.isAdmin = storedIsAdmin === 'true';
        this.showDashboard();
        this.initialized = true;
        return;
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        sessionStorage.clear();
      }
    }

    // Show login screen if no valid session
    this.showLogin();
    this.initialized = true;
  }

  /**
   * Handle Google OAuth credential response
   * @param {Object} response - Google OAuth response
   */
  handleCredentialResponse(response) {
    try {
      const payload = this.parseJwt(response.credential);

      // Check if user is allowed
      if (!CONFIG.ALLOWED_EMAILS.includes(payload.email)) {
        this.showError('Accès non autorisé. Veuillez contacter un administrateur.');
        return;
      }

      // Store user info
      this.currentUser = payload;
      this.isAdmin = CONFIG.ADMIN_EMAILS.includes(payload.email);

      // Save to sessionStorage
      sessionStorage.setItem('user', JSON.stringify(payload));
      sessionStorage.setItem('isAdmin', this.isAdmin);

      // Show dashboard
      this.showDashboard();

    } catch (error) {
      console.error('Authentication error:', error);
      this.showError('Erreur d\'authentification. Veuillez réessayer.');
    }
  }

  /**
   * Parse JWT token to extract payload
   * @param {string} token - JWT token
   * @returns {Object} Decoded payload
   */
  parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
    return JSON.parse(jsonPayload);
  }

  /**
   * Show login screen and hide dashboard
   */
  showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('dashboard');

    if (loginScreen) loginScreen.style.display = 'flex';
    if (dashboard) dashboard.style.display = 'none';
  }

  /**
   * Show dashboard and hide login screen
   */
  showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('dashboard');

    if (loginScreen) loginScreen.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';

    // Update user info display
    this.updateUserDisplay();

    // Hide admin-only tabs if not admin
    if (!this.isAdmin) {
      this.hideAdminTabs();
    }

    // Trigger initial data load (will be handled by app.js)
    if (window.app && typeof window.app.init === 'function') {
      window.app.init();
    }
  }

  /**
   * Update user display in the UI
   */
  updateUserDisplay() {
    if (!this.currentUser) return;

    const userNameElement = document.getElementById('userName');
    const userEmailElement = document.getElementById('userEmail');
    const userPictureElement = document.getElementById('userPicture');

    if (userNameElement) userNameElement.textContent = this.currentUser.name || '';
    if (userEmailElement) userEmailElement.textContent = this.currentUser.email || '';
    if (userPictureElement && this.currentUser.picture) {
      userPictureElement.src = this.currentUser.picture;
    }
  }

  /**
   * Hide admin-only tabs for non-admin users
   */
  hideAdminTabs() {
    // Rentabilité and Évolution tabs are admin-only
    const adminTabs = document.querySelectorAll('[data-admin-only="true"]');
    adminTabs.forEach(tab => {
      tab.style.display = 'none';
    });
  }

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError(message) {
    const errorElement = document.getElementById('loginError');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  /**
   * Logout user and clear session
   */
  logout() {
    // Clear session
    sessionStorage.clear();
    this.currentUser = null;
    this.isAdmin = false;

    // Reload page to show login screen
    window.location.reload();
  }

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * Get current user info
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if current user is admin
   * @returns {boolean}
   */
  checkIsAdmin() {
    return this.isAdmin;
  }
}

// Create global auth manager instance
window.authManager = new AuthManager();

// Callback for Google OAuth (called by Google Sign-In button)
function handleCredentialResponse(response) {
  window.authManager.handleCredentialResponse(response);
}
