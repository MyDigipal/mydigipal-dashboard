// MyDigipal Dashboard - Tabs Module
// Handles tab navigation and panel visibility

class TabManager {
  constructor() {
    this.currentTab = null;
    this.tabs = {};
    this.panels = {};
  }

  /**
   * Initialize tab system
   */
  init() {
    // Get all tabs and panels
    const tabElements = document.querySelectorAll('.tab');
    const panelElements = document.querySelectorAll('.panel');

    // Store references
    tabElements.forEach(tab => {
      const tabId = tab.dataset.tab;
      this.tabs[tabId] = tab;

      // Add click handler
      tab.addEventListener('click', () => this.switchTab(tabId));
    });

    panelElements.forEach(panel => {
      const panelId = panel.id.replace('Panel', '');
      this.panels[panelId] = panel;
    });

    // Show first visible tab by default
    const firstTab = Array.from(tabElements).find(t => !t.classList.contains('hidden'));
    if (firstTab) {
      this.switchTab(firstTab.dataset.tab);
    }
  }

  /**
   * Switch to a specific tab
   * @param {string} tabId - Tab identifier
   */
  switchTab(tabId) {
    // Don't switch if already on this tab
    if (this.currentTab === tabId) return;

    // Update tab buttons
    Object.values(this.tabs).forEach(tab => {
      tab.classList.remove('active');
    });
    if (this.tabs[tabId]) {
      this.tabs[tabId].classList.add('active');
    }

    // Update panels
    Object.values(this.panels).forEach(panel => {
      panel.classList.remove('active');
    });
    if (this.panels[tabId]) {
      this.panels[tabId].classList.add('active');
    }

    // Update current tab
    this.currentTab = tabId;

    // Clear chart cache when switching tabs (Phase 3.3 optimization)
    if (window.chartManager) {
      window.chartManager.clearCache();
    }

    // Trigger load for this tab
    if (window.app && typeof window.app.loadTab === 'function') {
      window.app.loadTab(tabId);
    }
  }

  /**
   * Get current active tab
   * @returns {string} Current tab ID
   */
  getCurrentTab() {
    return this.currentTab;
  }

  /**
   * Show/hide tab based on condition
   * @param {string} tabId - Tab identifier
   * @param {boolean} visible - Whether tab should be visible
   */
  setTabVisibility(tabId, visible) {
    if (this.tabs[tabId]) {
      if (visible) {
        this.tabs[tabId].classList.remove('hidden');
      } else {
        this.tabs[tabId].classList.add('hidden');
      }
    }
  }

  /**
   * Hide admin-only tabs (called for non-admin users)
   */
  hideAdminTabs() {
    // Rentabilité and Évolution are admin-only
    this.setTabVisibility('rentabilite', false);
    this.setTabVisibility('evolution', false);

    // If current tab is admin-only, switch to first available tab
    if (this.currentTab === 'rentabilite' || this.currentTab === 'evolution') {
      this.switchTab('heures');
    }
  }
}

// Create global tab manager instance
window.tabManager = new TabManager();
