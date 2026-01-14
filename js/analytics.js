// Analytics Module - Interactive Reports for MyDigipal Clients
// Replaces Looker Studio with modern, interactive dashboards

class AnalyticsManager {
    constructor() {
        this.currentClient = null;
        this.currentSource = null;
        this.currentDateFrom = null;
        this.currentDateTo = null;
        this.charts = {};
    }

    // Classify conversion as Lead or regular Conversion
    isLead(conversionType) {
        if (!conversionType) return false;
        const lowerType = conversionType.toLowerCase();
        return lowerType.includes('lead') ||
               lowerType.includes('formulaire') ||
               lowerType.includes('form');
    }

    // Calculate leads and conversions from conversion types array
    calculateLeadsAndConversions(conversions_by_type) {
        let totalLeads = 0;
        let totalConversions = 0;

        conversions_by_type.forEach(conv => {
            const count = conv.count || 0;
            if (this.isLead(conv.type)) {
                totalLeads += count;
            } else {
                totalConversions += count;
            }
        });

        return { totalLeads, totalConversions };
    }

    init() {
        console.log('[Analytics] Initializing...');
        this.loadClients();
        this.attachEventListeners();
        this.setDefaultDates();
    }

    async loadClients() {
        try {
            const response = await fetch(`${window.CONFIG.API_URL}/api/analytics/clients`);
            const clients = await response.json();

            const select = document.getElementById('analyticsClient');
            if (!select) {
                console.error('[Analytics] Client select element not found');
                return;
            }

            select.innerHTML = '<option value="">-- Sélectionner un client --</option>';

            clients
                .filter(c => c.active)
                .forEach(client => {
                    const option = document.createElement('option');
                    option.value = client.client_id;
                    option.textContent = client.client_name;
                    option.dataset.clientData = JSON.stringify(client);
                    select.appendChild(option);
                });

            console.log(`[Analytics] Loaded ${clients.length} clients`);
        } catch (error) {
            console.error('[Analytics] Error loading clients:', error);
        }
    }

    attachEventListeners() {
        const loadBtn = document.getElementById('analyticsLoadBtn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                this.loadReport();
            });
        }

        // Listen for client selection changes to update available sources
        const clientSelect = document.getElementById('analyticsClient');
        if (clientSelect) {
            clientSelect.addEventListener('change', (e) => {
                this.updateAvailableSources(e.target);
            });
        }
    }

    updateAvailableSources(clientSelect) {
        const sourceSelect = document.getElementById('analyticsSource');
        if (!sourceSelect) return;

        const selectedOption = clientSelect.options[clientSelect.selectedIndex];

        // If no client selected, show all sources
        if (!selectedOption || !selectedOption.value) {
            Array.from(sourceSelect.options).forEach(opt => {
                opt.style.display = '';
                opt.disabled = false;
            });
            return;
        }

        // Get client data
        let clientData = {};
        try {
            clientData = JSON.parse(selectedOption.dataset.clientData || '{}');
        } catch (e) {
            console.error('[Analytics] Error parsing client data:', e);
            return;
        }

        // Map source values to client data fields
        const sourceMapping = {
            'meta': 'meta_ads_accounts',
            'google-ads': 'google_ads_accounts',
            'linkedin-ads': 'linkedin_ads_accounts',
            'ga4': 'ga4_properties',
            'search-console': 'gsc_domains',
            'multi': null // Multi-source requires at least one paid media source
        };

        let hasAnyPaidMedia = false;

        Array.from(sourceSelect.options).forEach(opt => {
            const sourceValue = opt.value;
            const dataField = sourceMapping[sourceValue];

            if (sourceValue === 'multi') {
                // Multi-source is available if client has at least one paid media account
                hasAnyPaidMedia = !!(clientData.meta_ads_accounts || clientData.google_ads_accounts || clientData.linkedin_ads_accounts);
                opt.style.display = hasAnyPaidMedia ? '' : 'none';
                opt.disabled = !hasAnyPaidMedia;
            } else if (dataField) {
                const hasAccounts = !!clientData[dataField];
                opt.style.display = hasAccounts ? '' : 'none';
                opt.disabled = !hasAccounts;

                if (dataField.includes('ads')) {
                    hasAnyPaidMedia = hasAnyPaidMedia || hasAccounts;
                }
            }
        });

        // If current selection is now hidden, reset to first available option
        const currentOption = sourceSelect.options[sourceSelect.selectedIndex];
        if (currentOption && (currentOption.style.display === 'none' || currentOption.disabled)) {
            // Find first available option
            for (let opt of sourceSelect.options) {
                if (opt.style.display !== 'none' && !opt.disabled && opt.value) {
                    sourceSelect.value = opt.value;
                    break;
                }
            }
        }

        console.log(`[Analytics] Updated sources for client ${clientData.client_name || selectedOption.value}`);
    }

    setDefaultDates() {
        // No longer needed - using global dates from dashboard
    }

    getGlobalDates() {
        // Get dates from global date filter (set by app.js)
        const dateFrom = document.getElementById('dateFrom')?.value;
        const dateTo = document.getElementById('dateTo')?.value;

        if (!dateFrom || !dateTo) {
            // Fallback to last 30 days
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);

            return {
                dateFrom: thirtyDaysAgo.toISOString().split('T')[0],
                dateTo: today.toISOString().split('T')[0]
            };
        }

        return { dateFrom, dateTo };
    }

    async loadReport() {
        const clientId = document.getElementById('analyticsClient')?.value;
        const source = document.getElementById('analyticsSource')?.value;
        const { dateFrom, dateTo } = this.getGlobalDates();

        if (!clientId || !source) {
            alert('Veuillez sélectionner un client et une source');
            return;
        }

        this.currentClient = clientId;
        this.currentSource = source;
        this.currentDateFrom = dateFrom;
        this.currentDateTo = dateTo;

        // Show loading
        const container = document.getElementById('analyticsReportContainer');
        if (!container) {
            console.error('[Analytics] Report container not found');
            return;
        }
        container.innerHTML = '<div class="loading">⏳ Chargement du rapport...</div>';

        try {
            console.log(`[Analytics] Loading ${source} report for ${clientId} (${dateFrom} to ${dateTo})`);

            let data;
            switch (source) {
                case 'meta':
                    // Hide account selection panel for single-account sources
                    this.hideAccountSelectionPanel();
                    data = await this.fetchMetaAdsData(clientId, dateFrom, dateTo);
                    this.renderMetaAdsReport(data);
                    break;
                case 'google-ads':
                    // Hide account selection panel for single-account sources
                    this.hideAccountSelectionPanel();
                    data = await this.fetchGoogleAdsData(clientId, dateFrom, dateTo);
                    this.renderGoogleAdsReport(data);
                    break;
                case 'linkedin-ads':
                    // Hide account selection panel for single-account sources
                    this.hideAccountSelectionPanel();
                    data = await this.fetchLinkedInAdsData(clientId, dateFrom, dateTo);
                    this.renderLinkedInAdsReport(data);
                    break;
                case 'ga4':
                    // Hide account selection panel for single-account sources
                    this.hideAccountSelectionPanel();
                    // Use client name or alternative name as GA4 property
                    const clientSelect = document.getElementById('analyticsClient');
                    if (!clientSelect) return;
                    const selectedOption = clientSelect.options[clientSelect.selectedIndex];
                    const clientName = selectedOption.textContent.split('(')[0].trim();

                    data = await this.fetchGA4Data(clientName, dateFrom, dateTo);
                    this.renderGA4Report(data);
                    break;
                case 'search-console':
                    // Use client_id for Search Console
                    const scClientSelect = document.getElementById('analyticsClient');
                    if (!scClientSelect) return;
                    const scSelectedOption = scClientSelect.options[scClientSelect.selectedIndex];
                    const scClientName = scSelectedOption.textContent;
                    const scClientId = scSelectedOption.value;

                    // Check if client has multiple GSC domains
                    const clientData = JSON.parse(scSelectedOption.dataset.clientData || '{}');
                    if (clientData.gsc_domains_list && clientData.gsc_domains_list.length > 1) {
                        // Show panel instead of modal
                        this.showAccountSelectionPanel(clientData.gsc_domains_list);
                    } else {
                        // Hide panel for single domain
                        this.hideAccountSelectionPanel();
                        this.selectedAccounts = null;
                    }

                    await this.renderSearchConsoleReport(scClientId, scClientName, dateFrom, dateTo);
                    break;
                case 'multi':
                    this.hideAccountSelectionPanel();
                    data = await this.fetchPaidMediaData(clientId, dateFrom, dateTo);
                    this.renderPaidMediaReport(data);
                    break;
            }
        } catch (error) {
            console.error('[Analytics] Error loading report:', error);
            container.innerHTML = `<div class="error">❌ Erreur lors du chargement du rapport<br><small>${error.message}</small></div>`;
        }
    }

    async fetchMetaAdsData(clientId, dateFrom, dateTo) {
        const url = `${window.CONFIG.API_URL}/api/analytics/meta-ads?client_id=${clientId}&date_from=${dateFrom}&date_to=${dateTo}`;
        console.log(`[Analytics] Fetching Meta Ads data: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch Meta Ads data');
        }
        return response.json();
    }

    renderMetaAdsReport(data) {
        console.log('[Analytics] Rendering Meta Ads report', data);

        const container = document.getElementById('analyticsReportContainer');
        if (!container) {
            console.error('[Analytics] Report container not found');
            return;
        }

        // Destroy existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.charts = {};

        const summary = data.summary || {};
        const timeline = data.timeline || [];
        const campaigns = data.campaigns || [];
        const conversions_by_type = data.conversions_by_type || [];

        // Calculate leads and conversions
        const { totalLeads, totalConversions } = this.calculateLeadsAndConversions(conversions_by_type);

        // Calculate max spend for inline bars
        const maxSpend = campaigns.length > 0 ? Math.max(...campaigns.map(c => c.spend || 0)) : 1;

        container.innerHTML = `
            <div class="analytics-report modern-report">
                <!-- Main KPIs - Colorful Scorecards -->
                <div class="scorecard-grid">
                    <div class="scorecard bg-blue">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 6v6l4 2"></path>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Dépense Totale</div>
                            <div class="scorecard-value">${this.formatCurrency(summary.total_spend || 0)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">CPC moy: ${this.formatCurrency(summary.avg_cpc || 0)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-green">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Total Leads</div>
                            <div class="scorecard-value">${this.formatNumber(totalLeads)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">Coût/Lead: ${totalLeads > 0 ? this.formatCurrency((summary.total_spend || 0) / totalLeads) : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-orange">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Conversions</div>
                            <div class="scorecard-value">${this.formatNumber(totalConversions)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">Coût/Conv: ${totalConversions > 0 ? this.formatCurrency((summary.total_spend || 0) / totalConversions) : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-purple">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">CTR moyen</div>
                            <div class="scorecard-value">${(summary.avg_ctr || 0).toFixed(2)}%</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">${this.formatNumber(summary.total_clicks || 0)} clics</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Secondary KPIs -->
                <div class="kpi-mini-grid" style="margin-top: 1.5rem;">
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(11, 108, 217, 0.1); color: #0B6CD9;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(summary.total_impressions || 0)}</div>
                            <div class="kpi-mini-label">Impressions</div>
                        </div>
                    </div>
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(17, 132, 91, 0.1); color: #11845B;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(summary.total_clicks || 0)}</div>
                            <div class="kpi-mini-label">Clics</div>
                        </div>
                    </div>
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(213, 105, 27, 0.1); color: #D5691B;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="9" y1="21" x2="9" y2="9"></line>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(campaigns.length)}</div>
                            <div class="kpi-mini-label">Campagnes</div>
                        </div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <div class="section-header">
                        <h3>Performance dans le temps</h3>
                    </div>
                    <div class="chart-container" style="height: 280px;">
                        <canvas id="metaTimelineChart"></canvas>
                    </div>
                </div>

                <!-- Two Column Layout: Conversions + Table -->
                <div class="two-column-layout" style="margin-top: 2rem;">
                    <!-- Conversions by Type -->
                    <div class="analytics-section">
                        <h3>Conversions par type</h3>
                        <div class="channels-layout">
                            <div class="chart-container" style="height: 250px;">
                                <canvas id="metaConversionsChart"></canvas>
                            </div>
                            <div class="conversions-list">
                                ${conversions_by_type.slice(0, 8).map(conv => {
                                    const isLead = this.isLead(conv.type);
                                    const maxConv = Math.max(...conversions_by_type.map(c => c.count || 0));
                                    const pct = maxConv > 0 ? Math.round((conv.count / maxConv) * 100) : 0;
                                    return `
                                        <div class="conversion-row">
                                            <span class="conversion-type ${isLead ? 'lead' : 'conversion'}">${conv.type}</span>
                                            <div class="inline-bar-container">
                                                <div class="inline-bar" style="width: ${pct}%; background: ${isLead ? '#11845B' : '#0B6CD9'};"></div>
                                            </div>
                                            <span class="conversion-count">${this.formatNumber(conv.count || 0)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Campaign Summary -->
                    <div class="analytics-section">
                        <h3>Top Campagnes</h3>
                        <div class="campaign-cards">
                            ${campaigns.slice(0, 4).map(c => {
                                const { totalLeads: cLeads, totalConversions: cConv } = this.calculateLeadsAndConversions(c.conversions_by_type || []);
                                return `
                                    <div class="campaign-card">
                                        <div class="campaign-name">${c.campaign_name || 'N/A'}</div>
                                        <div class="campaign-stats">
                                            <span class="stat"><strong>${this.formatCurrency(c.spend || 0)}</strong> dépensé</span>
                                            <span class="stat"><strong>${cLeads}</strong> leads</span>
                                            <span class="stat"><strong>${(c.ctr || 0).toFixed(2)}%</strong> CTR</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- Full Campaigns Table -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <div class="section-header">
                        <h3>Toutes les campagnes</h3>
                        <div class="table-search">
                            <input type="text" id="metaCampaignsSearch" placeholder="Rechercher..." class="search-input">
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="analytics-table" id="metaCampaignsTable">
                            <thead>
                                <tr>
                                    <th class="sortable" data-col="0">Campagne</th>
                                    <th class="sortable number" data-col="1">Dépense</th>
                                    <th>Budget</th>
                                    <th class="sortable number" data-col="2">Clics</th>
                                    <th class="sortable number" data-col="3">CTR</th>
                                    <th class="sortable number" data-col="4">Leads</th>
                                    <th class="sortable number" data-col="5">Conv.</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Render charts and tables
        setTimeout(() => {
            this.renderMetaTimelineChart(timeline);
            if (conversions_by_type.length > 0) {
                this.renderConversionsChart(conversions_by_type);
            }
            this.populateCampaignsTable(campaigns, maxSpend);
            this.setupMetaInteractions();
        }, 100);
    }

    setupMetaInteractions() {
        const searchInput = document.getElementById('metaCampaignsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('#metaCampaignsTable tbody tr');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(query) ? '' : 'none';
                });
            });
        }
    }

    renderMetaTimelineChart(timeline) {
        const ctx = document.getElementById('metaTimelineChart');
        if (!ctx) return;

        this.charts.metaTimeline = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: timeline.map(d => {
                    const date = new Date(d.date);
                    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                }),
                datasets: [
                    {
                        type: 'line',
                        label: 'Dépense (€)',
                        data: timeline.map(d => d.spend),
                        borderColor: '#D5691B',
                        backgroundColor: 'rgba(213, 105, 27, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        type: 'bar',
                        label: 'Conversions',
                        data: timeline.map(d => d.conversions || 0),
                        backgroundColor: '#0B6CD9',
                        borderColor: '#0B6CD9',
                        borderWidth: 1,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        titleFont: {
                            family: 'Inter',
                            size: 13,
                            weight: '700'
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.yAxisID === 'y1') {
                                    label += context.parsed.y.toLocaleString('fr-FR', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    }) + '€';
                                } else {
                                    label += context.parsed.y.toLocaleString('fr-FR');
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Conversions',
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Dépense (€)',
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            },
                            callback: function(value) {
                                return value.toLocaleString('fr-FR', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                }) + '€';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    }
                }
            }
        });
    }

    populateCampaignsTable(campaigns) {
        const tbody = document.querySelector('#metaCampaignsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        campaigns.forEach(campaign => {
            // Calculate leads and conversions for this campaign
            const conversions_by_type = campaign.conversions_by_type || [];
            const { totalLeads, totalConversions } = this.calculateLeadsAndConversions(conversions_by_type);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${campaign.campaign_name || 'N/A'}</td>
                <td class="number">${this.formatNumber(campaign.impressions || 0)}</td>
                <td class="number">${this.formatNumber(campaign.clicks || 0)}</td>
                <td class="number">${this.formatCurrency(campaign.spend || 0)}</td>
                <td class="number">${(campaign.ctr || 0).toFixed(2)}%</td>
                <td class="number">${this.formatCurrency(campaign.cpc || 0)}</td>
                <td class="number" style="color: #11845B; font-weight: 600;">${this.formatNumber(totalLeads)}</td>
                <td class="number" style="color: #0B6CD9; font-weight: 600;">${this.formatNumber(totalConversions)}</td>
            `;
            tbody.appendChild(row);
        });

        // Add sorting functionality
        this.makeSortable('#metaCampaignsTable');
    }

    renderConversionsChart(conversions) {
        const ctx = document.getElementById('metaConversionsChart');
        if (!ctx) return;

        // Color conversions based on whether they are leads or not
        const colors = conversions.map(c =>
            this.isLead(c.type) ? '#11845B' : '#0B6CD9'
        );

        this.charts.metaConversions = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: conversions.map(c => c.type),
                datasets: [{
                    data: conversions.map(c => c.count),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            font: {
                                family: 'Inter',
                                size: 14
                            },
                            generateLabels: (chart) => {
                                const data = chart.data;
                                return data.labels.map((label, i) => ({
                                    text: label,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    hidden: false,
                                    index: i
                                }));
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        titleFont: {
                            family: 'Inter',
                            size: 13,
                            weight: '700'
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Populate conversions table
        this.populateConversionsTable(conversions);
    }

    populateConversionsTable(conversions) {
        const tbody = document.querySelector('#metaConversionsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        conversions.forEach(conv => {
            const isLead = this.isLead(conv.type);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="color: ${isLead ? '#11845B' : '#0B6CD9'}; font-weight: 600;">
                    ${conv.type}
                    ${isLead ? '<span style="font-size: 0.85em; margin-left: 8px; padding: 2px 6px; background: #d4f4dd; border-radius: 4px;">Lead</span>' : ''}
                </td>
                <td class="number" style="color: ${isLead ? '#11845B' : '#0B6CD9'}; font-weight: 600;">
                    ${this.formatNumber(conv.count || 0)}
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    makeSortable(tableSelector) {
        const table = document.querySelector(tableSelector);
        if (!table) return;

        const headers = table.querySelectorAll('th.sortable');

        headers.forEach(header => {
            header.addEventListener('click', () => {
                const colIndex = parseInt(header.dataset.col);
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));

                const isAscending = header.classList.contains('sorted-asc');

                // Remove sorted classes from all headers
                headers.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));

                // Add sorted class to clicked header
                header.classList.add(isAscending ? 'sorted-desc' : 'sorted-asc');

                rows.sort((a, b) => {
                    let aVal = a.children[colIndex].textContent.trim();
                    let bVal = b.children[colIndex].textContent.trim();

                    // Remove formatting for numbers
                    aVal = aVal.replace(/[€%\s]/g, '').replace(',', '.');
                    bVal = bVal.replace(/[€%\s]/g, '').replace(',', '.');

                    if (!isNaN(aVal) && !isNaN(bVal)) {
                        return isAscending ? parseFloat(bVal) - parseFloat(aVal) : parseFloat(aVal) - parseFloat(bVal);
                    }

                    return isAscending ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
                });

                rows.forEach(row => tbody.appendChild(row));
            });
        });
    }

    // Google Ads Data Fetching
    async fetchGoogleAdsData(clientId, dateFrom, dateTo) {
        const url = `${window.CONFIG.API_URL}/api/analytics/google-ads?client_id=${clientId}&date_from=${dateFrom}&date_to=${dateTo}`;
        console.log(`[Analytics] Fetching Google Ads data: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch Google Ads data');
        }
        return response.json();
    }

    renderGoogleAdsReport(data) {
        console.log('[Analytics] Rendering Google Ads report', data);

        const container = document.getElementById('analyticsReportContainer');
        if (!container) {
            console.error('[Analytics] Report container not found');
            return;
        }

        // Destroy existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.charts = {};

        const s = data.summary || {};
        const conversions_by_type = data.conversions_by_type || [];
        const campaigns = data.campaigns || [];
        const keywords = data.keywords || [];

        // Calculate leads and conversions
        const { totalLeads, totalConversions } = this.calculateLeadsAndConversions(conversions_by_type);

        container.innerHTML = `
            <div class="analytics-report modern-report">
                <!-- Main KPIs - Colorful Scorecards -->
                <div class="scorecard-grid">
                    <div class="scorecard bg-blue">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 6v6l4 2"></path>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Dépense Totale</div>
                            <div class="scorecard-value">${this.formatCurrency(s.total_cost || 0)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">CPC moy: ${this.formatCurrency(s.avg_cpc || 0)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-green">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Total Leads</div>
                            <div class="scorecard-value">${this.formatNumber(totalLeads)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">Coût/Lead: ${totalLeads > 0 ? this.formatCurrency((s.total_cost || 0) / totalLeads) : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-orange">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Conversions</div>
                            <div class="scorecard-value">${this.formatNumber(totalConversions)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">Coût/Conv: ${totalConversions > 0 ? this.formatCurrency((s.total_cost || 0) / totalConversions) : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-purple">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">CTR moyen</div>
                            <div class="scorecard-value">${(s.avg_ctr || 0).toFixed(2)}%</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">${this.formatNumber(s.total_clicks || 0)} clics</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Secondary KPIs -->
                <div class="kpi-mini-grid" style="margin-top: 1.5rem;">
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(11, 108, 217, 0.1); color: #0B6CD9;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(s.total_impressions || 0)}</div>
                            <div class="kpi-mini-label">Impressions</div>
                        </div>
                    </div>
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(17, 132, 91, 0.1); color: #11845B;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="9" y1="21" x2="9" y2="9"></line>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(campaigns.length)}</div>
                            <div class="kpi-mini-label">Campagnes</div>
                        </div>
                    </div>
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(213, 105, 27, 0.1); color: #D5691B;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(keywords.length)}</div>
                            <div class="kpi-mini-label">Mots-clés</div>
                        </div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <div class="section-header">
                        <h3>Performance dans le temps</h3>
                    </div>
                    <div class="chart-container" style="height: 280px;">
                        <canvas id="googleAdsTimelineChart"></canvas>
                    </div>
                </div>

                <!-- Two Column Layout -->
                <div class="two-column-layout" style="margin-top: 2rem;">
                    <!-- Conversions by Type -->
                    <div class="analytics-section">
                        <h3>Conversions par type</h3>
                        <div class="channels-layout">
                            <div class="chart-container" style="height: 250px;">
                                <canvas id="googleAdsConversionsChart"></canvas>
                            </div>
                            <div class="conversions-list">
                                ${conversions_by_type.slice(0, 8).map(conv => {
                                    const isLead = this.isLead(conv.type);
                                    const maxConv = Math.max(...conversions_by_type.map(c => c.count || 0));
                                    const pct = maxConv > 0 ? Math.round((conv.count / maxConv) * 100) : 0;
                                    return `
                                        <div class="conversion-row">
                                            <span class="conversion-type ${isLead ? 'lead' : 'conversion'}">${conv.type}</span>
                                            <div class="inline-bar-container">
                                                <div class="inline-bar" style="width: ${pct}%; background: ${isLead ? '#11845B' : '#0B6CD9'};"></div>
                                            </div>
                                            <span class="conversion-count">${this.formatNumber(conv.count || 0)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Top Keywords Preview -->
                    <div class="analytics-section">
                        <h3>Top Mots-clés</h3>
                        <div class="keywords-preview">
                            ${keywords.slice(0, 6).map((kw, i) => {
                                const maxClicks = keywords[0]?.clicks || 1;
                                const pct = Math.round((kw.clicks / maxClicks) * 100);
                                return `
                                    <div class="keyword-row">
                                        <span class="keyword-rank">${i + 1}</span>
                                        <span class="keyword-text">${kw.keyword || 'N/A'}</span>
                                        <div class="inline-bar-container">
                                            <div class="inline-bar" style="width: ${pct}%; background: #7C3AED;"></div>
                                        </div>
                                        <span class="keyword-clicks">${this.formatNumber(kw.clicks || 0)}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- Campaigns Table -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <div class="section-header">
                        <h3>Performance par campagne</h3>
                        <div class="table-search">
                            <input type="text" id="googleAdsCampaignsSearch" placeholder="Rechercher..." class="search-input">
                        </div>
                    </div>
                    <div class="table-container">
                        <table id="googleAdsCampaignsTable" class="analytics-table">
                            <thead>
                                <tr>
                                    <th class="sortable" data-col="0">Campagne</th>
                                    <th class="sortable number" data-col="1">Coût</th>
                                    <th>Performance</th>
                                    <th class="sortable number" data-col="2">Clics</th>
                                    <th class="sortable number" data-col="3">CTR</th>
                                    <th class="sortable number" data-col="4">Leads</th>
                                    <th class="sortable number" data-col="5">Conv.</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>

                <!-- Keywords Table -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <div class="section-header">
                        <h3>Tous les mots-clés</h3>
                        <div class="table-search">
                            <input type="text" id="googleAdsKeywordsSearch" placeholder="Rechercher..." class="search-input">
                        </div>
                    </div>
                    <div class="table-container">
                        <table id="googleAdsKeywordsTable" class="analytics-table">
                            <thead>
                                <tr>
                                    <th class="sortable" data-col="0">Mot-clé</th>
                                    <th class="sortable number" data-col="1">Clics</th>
                                    <th>Performance</th>
                                    <th class="sortable number" data-col="2">CTR</th>
                                    <th class="sortable number" data-col="3">Coût</th>
                                    <th class="sortable number" data-col="4">Conv.</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Render charts & tables
        setTimeout(() => {
            this.renderGoogleAdsTimelineChart(data.timeline);
            this.populateGoogleAdsCampaignsTable(campaigns);
            this.populateGoogleAdsKeywordsTable(keywords);
            this.renderGoogleAdsConversionsChart(conversions_by_type);
            this.setupGoogleAdsInteractions();
        }, 100);
    }

    setupGoogleAdsInteractions() {
        ['googleAdsCampaignsSearch', 'googleAdsKeywordsSearch'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                const tableId = id.replace('Search', 'Table');
                input.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
                    rows.forEach(row => {
                        row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
                    });
                });
            }
        });
    }

    renderGoogleAdsTimelineChart(timeline) {
        const ctx = document.getElementById('googleAdsTimelineChart');
        if (!ctx) return;

        this.charts.googleAdsTimeline = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: timeline.map(d => new Date(d.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })),
                datasets: [
                    {
                        type: 'line',
                        label: 'Dépense (€)',
                        data: timeline.map(d => d.cost),
                        borderColor: '#D5691B',
                        backgroundColor: 'rgba(213, 105, 27, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        type: 'bar',
                        label: 'Leads',
                        data: timeline.map(d => d.leads || 0),
                        backgroundColor: '#11845B',
                        borderColor: '#11845B',
                        borderWidth: 1,
                        stack: 'conversions',
                        yAxisID: 'y'
                    },
                    {
                        type: 'bar',
                        label: 'Conversions',
                        data: timeline.map(d => d.conversions || 0),
                        backgroundColor: '#0B6CD9',
                        borderColor: '#0B6CD9',
                        borderWidth: 1,
                        stack: 'conversions',
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        titleFont: {
                            family: 'Inter',
                            size: 13,
                            weight: '700'
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.yAxisID === 'y1') {
                                    label += context.parsed.y.toLocaleString('fr-FR', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    }) + '€';
                                } else {
                                    label += context.parsed.y.toLocaleString('fr-FR');
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Conversions',
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Dépense (€)',
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            },
                            callback: function(value) {
                                return value.toLocaleString('fr-FR', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                }) + '€';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    }
                }
            }
        });
    }

    populateGoogleAdsCampaignsTable(campaigns) {
        const tbody = document.querySelector('#googleAdsCampaignsTable tbody');
        if (!tbody) return;

        campaigns.slice(0, 20).forEach(campaign => {
            // Calculate leads and conversions for this campaign
            const conversions_by_type = campaign.conversions_by_type || [];
            const { totalLeads, totalConversions } = this.calculateLeadsAndConversions(conversions_by_type);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${campaign.campaign_name || 'N/A'}</td>
                <td class="number">${this.formatNumber(campaign.impressions || 0)}</td>
                <td class="number">${this.formatNumber(campaign.clicks || 0)}</td>
                <td class="number">${this.formatCurrency(campaign.cost || 0)}</td>
                <td class="number">${(campaign.ctr || 0).toFixed(2)}%</td>
                <td class="number">${this.formatCurrency(campaign.cpc || 0)}</td>
                <td class="number" style="color: #11845B; font-weight: 600;">${this.formatNumber(totalLeads)}</td>
                <td class="number" style="color: #0B6CD9; font-weight: 600;">${this.formatNumber(totalConversions)}</td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#googleAdsCampaignsTable');
    }

    populateGoogleAdsKeywordsTable(keywords) {
        const tbody = document.querySelector('#googleAdsKeywordsTable tbody');
        if (!tbody) return;

        keywords.slice(0, 20).forEach(keyword => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${keyword.keyword_text || 'N/A'}</td>
                <td class="number">${this.formatNumber(keyword.impressions || 0)}</td>
                <td class="number">${this.formatNumber(keyword.clicks || 0)}</td>
                <td class="number">${(keyword.ctr || 0).toFixed(2)}%</td>
                <td class="number">${this.formatCurrency(keyword.cost || 0)}</td>
                <td class="number">${this.formatCurrency(keyword.cpc || 0)}</td>
                <td class="number" style="color: #0B6CD9; font-weight: 600;">${this.formatNumber(keyword.conversions || 0)}</td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#googleAdsKeywordsTable');
    }

    renderGoogleAdsConversionsChart(conversions) {
        const ctx = document.getElementById('googleAdsConversionsChart');
        if (!ctx) return;

        // Color conversions based on whether they are leads or not
        const colors = conversions.map(c =>
            this.isLead(c.type) ? '#11845B' : '#0B6CD9'
        );

        this.charts.googleAdsConversions = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: conversions.map(c => c.type),
                datasets: [{
                    data: conversions.map(c => c.count),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            font: {
                                family: 'Inter',
                                size: 14
                            },
                            generateLabels: (chart) => {
                                const data = chart.data;
                                return data.labels.map((label, i) => ({
                                    text: label,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    hidden: false,
                                    index: i
                                }));
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        titleFont: {
                            family: 'Inter',
                            size: 13,
                            weight: '700'
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Populate Google Ads conversions table
        this.populateGoogleAdsConversionsTable(conversions);
    }

    populateGoogleAdsConversionsTable(conversions) {
        const tbody = document.querySelector('#googleAdsConversionsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        conversions.forEach(conv => {
            const isLead = this.isLead(conv.type);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="color: ${isLead ? '#11845B' : '#0B6CD9'}; font-weight: 600;">
                    ${conv.type}
                    ${isLead ? '<span style="font-size: 0.85em; margin-left: 8px; padding: 2px 6px; background: #d4f4dd; border-radius: 4px;">Lead</span>' : ''}
                </td>
                <td class="number" style="color: ${isLead ? '#11845B' : '#0B6CD9'}; font-weight: 600;">
                    ${this.formatNumber(conv.count || 0)}
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async fetchLinkedInAdsData(clientId, dateFrom, dateTo) {
        const url = `${CONFIG.API_URL}/api/analytics/linkedin-ads?client_id=${clientId}&date_from=${dateFrom}&date_to=${dateTo}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch LinkedIn Ads data');
        return await response.json();
    }

    renderLinkedInAdsReport(data) {
        const container = document.getElementById('analyticsReportContainer');
        if (!container) return;

        const { summary, timeline, campaigns, conversions_by_type, accounts } = data;
        const s = summary || {};

        // Calculate leads and conversions from conversions_by_type
        const { totalLeads, totalConversions } = this.calculateLeadsAndConversions(conversions_by_type || []);

        container.innerHTML = `
            <div class="analytics-report modern-report">
                <!-- Main KPIs - Colorful Scorecards (LinkedIn blue theme) -->
                <div class="scorecard-grid">
                    <div class="scorecard" style="background: linear-gradient(135deg, #0077B5, #005885);">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 6v6l4 2"></path>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Dépense Totale</div>
                            <div class="scorecard-value">${this.formatCurrency(s.total_spend || 0)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">CPC moy: ${this.formatCurrency(s.avg_cpc || 0)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-green">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Total Leads</div>
                            <div class="scorecard-value">${this.formatNumber(totalLeads)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">Coût/Lead: ${totalLeads > 0 ? this.formatCurrency((s.total_spend || 0) / totalLeads) : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-orange">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Conversions</div>
                            <div class="scorecard-value">${this.formatNumber(totalConversions)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">Coût/Conv: ${totalConversions > 0 ? this.formatCurrency((s.total_spend || 0) / totalConversions) : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-purple">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">CTR moyen</div>
                            <div class="scorecard-value">${(s.avg_ctr || 0).toFixed(2)}%</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">${this.formatNumber(s.total_clicks || 0)} clics</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Secondary KPIs -->
                <div class="kpi-mini-grid" style="margin-top: 1.5rem;">
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(0, 119, 181, 0.1); color: #0077B5;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(s.total_impressions || 0)}</div>
                            <div class="kpi-mini-label">Impressions</div>
                        </div>
                    </div>
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(17, 132, 91, 0.1); color: #11845B;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(s.total_engagements || 0)}</div>
                            <div class="kpi-mini-label">Engagements</div>
                        </div>
                    </div>
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(213, 105, 27, 0.1); color: #D5691B;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="9" y1="21" x2="9" y2="9"></line>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber((campaigns || []).length)}</div>
                            <div class="kpi-mini-label">Campagnes</div>
                        </div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <div class="section-header">
                        <h3>Performance dans le temps</h3>
                    </div>
                    <div class="chart-container" style="height: 280px;">
                        <canvas id="linkedInAdsTimelineChart"></canvas>
                    </div>
                </div>

                <!-- Two Column Layout -->
                <div class="two-column-layout" style="margin-top: 2rem;">
                    <!-- Conversions by Type -->
                    <div class="analytics-section">
                        <h3>Conversions par type</h3>
                        <div class="channels-layout">
                            <div class="chart-container" style="height: 250px;">
                                <canvas id="linkedInAdsConversionsChart"></canvas>
                            </div>
                            <div class="conversions-list">
                                ${(conversions_by_type || []).slice(0, 8).map(conv => {
                                    const isLead = this.isLead(conv.type);
                                    const maxConv = Math.max(...(conversions_by_type || []).map(c => c.count || 0));
                                    const pct = maxConv > 0 ? Math.round((conv.count / maxConv) * 100) : 0;
                                    return `
                                        <div class="conversion-row">
                                            <span class="conversion-type ${isLead ? 'lead' : 'conversion'}">${conv.type}</span>
                                            <div class="inline-bar-container">
                                                <div class="inline-bar" style="width: ${pct}%; background: ${isLead ? '#11845B' : '#0077B5'};"></div>
                                            </div>
                                            <span class="conversion-count">${this.formatNumber(conv.count || 0)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Top Campaigns Preview -->
                    <div class="analytics-section">
                        <h3>Top Campagnes</h3>
                        <div class="campaign-cards">
                            ${(campaigns || []).slice(0, 4).map(c => `
                                <div class="campaign-card">
                                    <div class="campaign-name">${c.campaign_name || 'N/A'}</div>
                                    <div class="campaign-stats">
                                        <span class="stat"><strong>${this.formatCurrency(c.spend || 0)}</strong> dépensé</span>
                                        <span class="stat"><strong>${c.leads || 0}</strong> leads</span>
                                        <span class="stat"><strong>${(c.ctr || 0).toFixed(2)}%</strong> CTR</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Campaigns Table -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <div class="section-header">
                        <h3>Toutes les campagnes</h3>
                        <div class="table-search">
                            <input type="text" id="linkedInCampaignsSearch" placeholder="Rechercher..." class="search-input">
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="analytics-table" id="linkedInAdsCampaignsTable">
                            <thead>
                                <tr>
                                    <th class="sortable" data-col="0">Campagne</th>
                                    <th class="sortable number" data-col="1">Dépense</th>
                                    <th>Performance</th>
                                    <th class="sortable number" data-col="2">Clics</th>
                                    <th class="sortable number" data-col="3">CTR</th>
                                    <th class="sortable number" data-col="4">Leads</th>
                                    <th class="sortable number" data-col="5">Engagements</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Populate charts and tables
        this.renderLinkedInAdsTimelineChart(timeline);
        this.renderLinkedInAdsConversionsChart(conversions_by_type);
        this.populateLinkedInAdsConversionsTable(conversions_by_type);
        this.populateLinkedInAdsCampaignsTable(campaigns);
        this.setupLinkedInInteractions();
    }

    setupLinkedInInteractions() {
        const searchInput = document.getElementById('linkedInCampaignsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('#linkedInAdsCampaignsTable tbody tr');
                rows.forEach(row => {
                    row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
                });
            });
        }
    }

    renderLinkedInAdsTimelineChart(timeline) {
        const ctx = document.getElementById('linkedInAdsTimelineChart');
        if (!ctx) return;

        this.charts.linkedInAdsTimeline = new Chart(ctx.getContext('2d'), {
            data: {
                labels: timeline.map(d => {
                    const date = new Date(d.date?.value || d.date);
                    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                }),
                datasets: [
                    {
                        type: 'line',
                        label: 'Dépense (€)',
                        data: timeline.map(d => d.spend || 0),
                        borderColor: '#0077B5',
                        backgroundColor: 'rgba(0, 119, 181, 0.1)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        type: 'bar',
                        label: 'Leads',
                        data: timeline.map(d => d.leads || 0),
                        backgroundColor: '#11845B',
                        borderColor: '#11845B',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        type: 'bar',
                        label: 'Conversions',
                        data: timeline.map(d => d.conversions || 0),
                        backgroundColor: '#0B6CD9',
                        borderColor: '#0B6CD9',
                        borderWidth: 1,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        titleFont: {
                            family: 'Inter',
                            size: 13,
                            weight: '700'
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.yAxisID === 'y1') {
                                    label += context.parsed.y.toLocaleString('fr-FR', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    }) + '€';
                                } else {
                                    label += context.parsed.y.toLocaleString('fr-FR');
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Leads & Conversions',
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Dépense (€)',
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            },
                            callback: function(value) {
                                return value.toLocaleString('fr-FR', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                }) + '€';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    }
                }
            }
        });
    }

    renderLinkedInAdsConversionsChart(conversions) {
        const ctx = document.getElementById('linkedInAdsConversionsChart');
        if (!ctx) return;

        // Color conversions based on whether they are leads or not
        const colors = conversions.map(c =>
            c.is_lead ? '#11845B' : '#0077B5'
        );

        this.charts.linkedInAdsConversions = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: conversions.map(c => c.type),
                datasets: [{
                    data: conversions.map(c => c.count),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        padding: 12,
                        cornerRadius: 8,
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toLocaleString('fr-FR')} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    populateLinkedInAdsConversionsTable(conversions) {
        const tbody = document.querySelector('#linkedInAdsConversionsTable tbody');
        if (!tbody) return;

        conversions.forEach(conv => {
            const isLead = conv.is_lead;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="color: ${isLead ? '#11845B' : '#0077B5'}; font-weight: 600;">
                    ${conv.type}
                    ${isLead ? '<span style="font-size: 0.85em; margin-left: 8px; padding: 2px 6px; background: #d4f4dd; border-radius: 4px;">Lead</span>' : ''}
                </td>
                <td class="number" style="color: ${isLead ? '#11845B' : '#0077B5'}; font-weight: 600;">
                    ${this.formatNumber(conv.count || 0)}
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    populateLinkedInAdsCampaignsTable(campaigns) {
        const tbody = document.querySelector('#linkedInAdsCampaignsTable tbody');
        if (!tbody) return;

        campaigns.slice(0, 20).forEach(campaign => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${campaign.campaign_name || 'N/A'}</td>
                <td class="number">${this.formatNumber(campaign.impressions || 0)}</td>
                <td class="number">${this.formatNumber(campaign.clicks || 0)}</td>
                <td class="number">${this.formatCurrency(campaign.cost || 0)}</td>
                <td class="number">${(campaign.ctr || 0).toFixed(2)}%</td>
                <td class="number">${this.formatCurrency(campaign.cpc || 0)}</td>
                <td class="number" style="color: #11845B; font-weight: 600;">${this.formatNumber(campaign.leads || 0)}</td>
                <td class="number" style="color: #0077B5; font-weight: 600;">${this.formatNumber(campaign.conversions || 0)}</td>
                <td class="number">${this.formatNumber(campaign.total_engagements || 0)}</td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#linkedInAdsCampaignsTable');
    }

    async fetchPaidMediaData(clientId, dateFrom, dateTo) {
        const url = `${CONFIG.API_URL}/api/analytics/paid-media?client_id=${clientId}&date_from=${dateFrom}&date_to=${dateTo}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch Paid Media data');
        return await response.json();
    }

    renderPaidMediaReport(data) {
        const container = document.getElementById('analyticsReportContainer');
        if (!container) return;

        const { summary, timeline, platform_breakdown, platforms_available } = data;
        const s = summary || {};
        const platforms = platform_breakdown || [];

        // Determine which platforms are available
        const availablePlatforms = [];
        if (platforms_available?.meta) availablePlatforms.push('Meta');
        if (platforms_available?.google) availablePlatforms.push('Google');
        if (platforms_available?.linkedin) availablePlatforms.push('LinkedIn');

        // Platform colors
        const platformColors = {
            'Meta Ads': '#1877F2',
            'Google Ads': '#4285F4',
            'LinkedIn Ads': '#0077B5'
        };

        container.innerHTML = `
            <div class="analytics-report modern-report">
                <!-- Main KPIs - Colorful Scorecards -->
                <div class="scorecard-grid">
                    <div class="scorecard bg-blue">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 6v6l4 2"></path>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Dépense Totale</div>
                            <div class="scorecard-value">${this.formatCurrency(s.total_spend || 0)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">CPC moy: ${this.formatCurrency(s.avg_cpc || 0)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-green">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Total Leads</div>
                            <div class="scorecard-value">${this.formatNumber(s.total_leads || 0)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">Coût/Lead: ${s.total_leads > 0 ? this.formatCurrency((s.total_spend || 0) / s.total_leads) : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-orange">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Conversions</div>
                            <div class="scorecard-value">${this.formatNumber(s.total_conversions || 0)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">Coût/Conv: ${s.total_conversions > 0 ? this.formatCurrency((s.total_spend || 0) / s.total_conversions) : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-purple">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">CTR moyen</div>
                            <div class="scorecard-value">${(s.avg_ctr || 0).toFixed(2)}%</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">${this.formatNumber(s.total_clicks || 0)} clics</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Secondary KPIs -->
                <div class="kpi-mini-grid" style="margin-top: 1.5rem;">
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(11, 108, 217, 0.1); color: #0B6CD9;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(s.total_impressions || 0)}</div>
                            <div class="kpi-mini-label">Impressions</div>
                        </div>
                    </div>
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(17, 132, 91, 0.1); color: #11845B;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(s.total_clicks || 0)}</div>
                            <div class="kpi-mini-label">Clics</div>
                        </div>
                    </div>
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(213, 105, 27, 0.1); color: #D5691B;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="9" y1="21" x2="9" y2="9"></line>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${availablePlatforms.length}</div>
                            <div class="kpi-mini-label">Plateformes</div>
                        </div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <div class="section-header">
                        <h3>Performance globale dans le temps</h3>
                    </div>
                    <div class="chart-container" style="height: 280px;">
                        <canvas id="paidMediaTimelineChart"></canvas>
                    </div>
                </div>

                <!-- Two Column Layout -->
                <div class="two-column-layout" style="margin-top: 2rem;">
                    <!-- Platform Chart -->
                    <div class="analytics-section">
                        <h3>Répartition par plateforme</h3>
                        <div class="chart-container" style="height: 280px;">
                            <canvas id="paidMediaPlatformChart"></canvas>
                        </div>
                    </div>

                    <!-- Platform Cards -->
                    <div class="analytics-section">
                        <h3>Performance par plateforme</h3>
                        <div class="platform-cards">
                            ${platforms.map(p => {
                                const color = platformColors[p.platform] || '#6366f1';
                                const totalSpend = s.total_spend || 1;
                                const spendPct = Math.round((p.spend / totalSpend) * 100);
                                return `
                                    <div class="platform-card" style="border-left: 4px solid ${color};">
                                        <div class="platform-header">
                                            <span class="platform-name">${p.platform}</span>
                                            <span class="platform-spend">${this.formatCurrency(p.spend || 0)}</span>
                                        </div>
                                        <div class="platform-bar">
                                            <div class="platform-bar-fill" style="width: ${spendPct}%; background: ${color};"></div>
                                        </div>
                                        <div class="platform-metrics">
                                            <span><strong>${this.formatNumber(p.leads || 0)}</strong> leads</span>
                                            <span><strong>${this.formatNumber(p.conversions || 0)}</strong> conv.</span>
                                            <span><strong>${(p.ctr || 0).toFixed(2)}%</strong> CTR</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- Platform Table -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <h3>Détail par plateforme</h3>
                    <div class="table-container">
                        <table class="analytics-table" id="paidMediaPlatformTable">
                            <thead>
                                <tr>
                                    <th>Plateforme</th>
                                    <th class="number">Dépense</th>
                                    <th>Part budget</th>
                                    <th class="number">Impressions</th>
                                    <th class="number">Clics</th>
                                    <th class="number">CTR</th>
                                    <th class="number">Leads</th>
                                    <th class="number">Conv.</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Populate charts and tables
        this.renderPaidMediaTimelineChart(timeline);
        this.renderPaidMediaPlatformChart(platform_breakdown);
        this.populatePaidMediaPlatformTable(platform_breakdown, s.total_spend);
    }

    renderPaidMediaTimelineChart(timeline) {
        const ctx = document.getElementById('paidMediaTimelineChart');
        if (!ctx) return;

        this.charts.paidMediaTimeline = new Chart(ctx.getContext('2d'), {
            data: {
                labels: timeline.map(d => {
                    const date = new Date(d.date);
                    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                }),
                datasets: [
                    {
                        type: 'line',
                        label: 'Dépense (€)',
                        data: timeline.map(d => d.spend || 0),
                        borderColor: '#211F54',
                        backgroundColor: 'rgba(33, 31, 84, 0.1)',
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1'
                    },
                    {
                        type: 'bar',
                        label: 'Leads',
                        data: timeline.map(d => d.leads || 0),
                        backgroundColor: '#11845B',
                        borderColor: '#11845B',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        type: 'bar',
                        label: 'Conversions',
                        data: timeline.map(d => d.conversions || 0),
                        backgroundColor: '#0B6CD9',
                        borderColor: '#0B6CD9',
                        borderWidth: 1,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        titleFont: {
                            family: 'Inter',
                            size: 13,
                            weight: '700'
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.yAxisID === 'y1') {
                                    label += context.parsed.y.toLocaleString('fr-FR', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    }) + '€';
                                } else {
                                    label += context.parsed.y.toLocaleString('fr-FR');
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Leads & Conversions',
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Dépense (€)',
                            font: {
                                family: 'Inter',
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            },
                            callback: function(value) {
                                return value.toLocaleString('fr-FR', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                }) + '€';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    }
                }
            }
        });
    }

    renderPaidMediaPlatformChart(platforms) {
        const ctx = document.getElementById('paidMediaPlatformChart');
        if (!ctx) return;

        // Platform colors
        const platformColors = {
            'Meta Ads': '#1877F2',
            'Google Ads': '#4285F4',
            'LinkedIn Ads': '#0077B5'
        };

        const colors = platforms.map(p => platformColors[p.platform] || '#211F54');

        this.charts.paidMediaPlatform = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: platforms.map(p => p.platform),
                datasets: [{
                    label: 'Dépense',
                    data: platforms.map(p => p.spend),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                family: 'Inter',
                                size: 14
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        padding: 12,
                        cornerRadius: 8,
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toLocaleString('fr-FR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}€ (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    populatePaidMediaPlatformTable(platforms) {
        const tbody = document.querySelector('#paidMediaPlatformTable tbody');
        if (!tbody) return;

        const platformEmojis = {
            'Meta Ads': '📘',
            'Google Ads': '🔴',
            'LinkedIn Ads': '💼'
        };

        platforms.forEach(platform => {
            const row = document.createElement('tr');
            const emoji = platformEmojis[platform.platform] || '📊';
            row.innerHTML = `
                <td>${emoji} ${platform.platform}</td>
                <td class="number">${this.formatNumber(platform.impressions || 0)}</td>
                <td class="number">${this.formatNumber(platform.clicks || 0)}</td>
                <td class="number">${this.formatCurrency(platform.spend || 0)}</td>
                <td class="number">${(platform.ctr || 0).toFixed(2)}%</td>
                <td class="number" style="color: #11845B; font-weight: 600;">${this.formatNumber(platform.leads || 0)}</td>
                <td class="number" style="color: #0B6CD9; font-weight: 600;">${this.formatNumber(platform.conversions || 0)}</td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#paidMediaPlatformTable');
    }

    async fetchGA4Data(property, dateFrom, dateTo) {
        const url = `${CONFIG.API_URL}/api/analytics/ga4?property=${encodeURIComponent(property)}&date_from=${dateFrom}&date_to=${dateTo}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch GA4 data');
        return await response.json();
    }

    renderGA4Report(data) {
        const container = document.getElementById('analyticsReportContainer');
        if (!container) {
            console.error('[Analytics] Report container not found');
            return;
        }

        // Destroy existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.charts = {};

        const s = data.summary || {};
        const events = data.events || [];
        const devices = data.devices || [];
        const countries = data.countries || [];
        const pages = data.pages || [];
        const channels = data.channels || [];

        // Calculate totals for devices
        const totalDeviceUsers = devices.reduce((sum, d) => sum + (d.users || 0), 0);

        // Get device icon
        const getDeviceIcon = (device) => {
            const d = (device || '').toLowerCase();
            if (d === 'mobile') return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
            if (d === 'tablet') return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
            return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>';
        };

        // Format duration
        const formatDuration = (seconds) => {
            if (!seconds) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Group events by category
        const leadEvents = events.filter(e => e.event_category === 'LEAD');
        const conversionEvents = events.filter(e => e.event_category === 'CONVERSION');
        const engagementEvents = events.filter(e => e.event_category === 'ENGAGEMENT');
        const otherEvents = events.filter(e => !e.event_category);

        container.innerHTML = `
            <div class="analytics-report ga4-modern-report">
                <!-- Main KPIs - Colorful Scorecards -->
                <div class="scorecard-grid">
                    <div class="scorecard bg-blue">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Utilisateurs</div>
                            <div class="scorecard-value">${this.formatNumber(s.users || 0)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">${this.formatNumber(s.new_users || 0)} nouveaux</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-green">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Sessions</div>
                            <div class="scorecard-value">${this.formatNumber(s.sessions || 0)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">${s.pages_per_session || 0} pages/session</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-orange">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Pages vues</div>
                            <div class="scorecard-value">${this.formatNumber(s.pageviews || 0)}</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">Durée moy. ${formatDuration(s.avg_session_duration)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="scorecard bg-purple">
                        <div class="scorecard-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                        </div>
                        <div class="scorecard-content">
                            <div class="scorecard-label">Engagement</div>
                            <div class="scorecard-value">${s.engagement_rate || 0}%</div>
                            <div class="scorecard-secondary">
                                <span class="text-light">Rebond: ${s.bounce_rate || 0}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Conversions KPI Cards Row -->
                <div class="kpi-mini-grid" style="margin-top: 1.5rem;">
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(17, 132, 91, 0.1); color: #11845B;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="8" x2="20" y2="14"></line>
                                <line x1="23" y1="11" x2="17" y2="11"></line>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(s.leads || 0)}</div>
                            <div class="kpi-mini-label">Leads</div>
                        </div>
                    </div>
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(11, 108, 217, 0.1); color: #0B6CD9;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(s.conversions || 0)}</div>
                            <div class="kpi-mini-label">Conversions</div>
                        </div>
                    </div>
                    <div class="kpi-mini-card">
                        <div class="kpi-mini-icon" style="background: rgba(213, 105, 27, 0.1); color: #D5691B;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                            </svg>
                        </div>
                        <div class="kpi-mini-content">
                            <div class="kpi-mini-value">${this.formatNumber(s.engagement_events || 0)}</div>
                            <div class="kpi-mini-label">Engagements</div>
                        </div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <div class="section-header">
                        <h3>Evolution dans le temps</h3>
                        <div class="metric-toggle-group" id="ga4TimelineToggle">
                            <button class="metric-toggle active" data-metric="sessions">Sessions</button>
                            <button class="metric-toggle" data-metric="users">Utilisateurs</button>
                            <button class="metric-toggle" data-metric="pageviews">Pages vues</button>
                        </div>
                    </div>
                    <div class="chart-container" style="height: 280px;">
                        <canvas id="ga4TimelineChart"></canvas>
                    </div>
                </div>

                <!-- Two Column Layout: Channels + Devices/Countries -->
                <div class="two-column-layout" style="margin-top: 2rem;">
                    <!-- Channels Section -->
                    <div class="analytics-section">
                        <h3>Acquisition par canal</h3>
                        <div class="channels-layout">
                            <div class="chart-container" style="height: 250px;">
                                <canvas id="ga4ChannelsChart"></canvas>
                            </div>
                            <div class="channels-table-wrapper">
                                <table class="analytics-table compact" id="ga4ChannelsTable">
                                    <thead>
                                        <tr>
                                            <th>Canal</th>
                                            <th>Sessions</th>
                                            <th>%</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Audience Section -->
                    <div class="analytics-section">
                        <h3>Audience</h3>

                        <!-- Device Cards -->
                        <div class="device-cards-grid">
                            ${devices.map(d => {
                                const pct = totalDeviceUsers > 0 ? Math.round((d.users / totalDeviceUsers) * 100) : 0;
                                return `
                                    <div class="device-card">
                                        <div class="device-icon">${getDeviceIcon(d.device)}</div>
                                        <div class="device-info">
                                            <div class="device-name">${d.device || 'Unknown'}</div>
                                            <div class="device-stats">${this.formatNumber(d.users)} utilisateurs</div>
                                        </div>
                                        <div class="device-percentage">${pct}%</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>

                        <!-- Top Countries -->
                        <div class="countries-list" style="margin-top: 1rem;">
                            <h4 style="font-size: 0.85rem; color: #666; margin-bottom: 0.75rem;">Top Pays</h4>
                            ${countries.slice(0, 5).map((c, i) => {
                                const maxUsers = countries[0]?.users || 1;
                                const pct = Math.round((c.users / maxUsers) * 100);
                                return `
                                    <div class="country-row">
                                        <span class="country-rank">${i + 1}</span>
                                        <span class="country-name">${c.country || 'Unknown'}</span>
                                        <div class="inline-bar-container">
                                            <div class="inline-bar" style="width: ${pct}%"></div>
                                        </div>
                                        <span class="country-value">${this.formatNumber(c.users)}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- Events by Category -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <h3>Événements par catégorie</h3>
                    <div class="events-categories-grid">
                        <!-- Leads -->
                        <div class="event-category-card lead">
                            <div class="category-header">
                                <span class="category-badge lead">LEAD</span>
                                <span class="category-total">${this.formatNumber(s.leads || 0)}</span>
                            </div>
                            <div class="events-list">
                                ${leadEvents.slice(0, 5).map(e => `
                                    <div class="event-row">
                                        <span class="event-name">${e.eventName}</span>
                                        <span class="event-count">${this.formatNumber(e.count || 0)}</span>
                                    </div>
                                `).join('') || '<div class="no-events">Aucun événement Lead</div>'}
                            </div>
                        </div>

                        <!-- Conversions -->
                        <div class="event-category-card conversion">
                            <div class="category-header">
                                <span class="category-badge conversion">CONVERSION</span>
                                <span class="category-total">${this.formatNumber(s.conversions || 0)}</span>
                            </div>
                            <div class="events-list">
                                ${conversionEvents.slice(0, 5).map(e => `
                                    <div class="event-row">
                                        <span class="event-name">${e.eventName}</span>
                                        <span class="event-count">${this.formatNumber(e.count || 0)}</span>
                                    </div>
                                `).join('') || '<div class="no-events">Aucun événement Conversion</div>'}
                            </div>
                        </div>

                        <!-- Engagement -->
                        <div class="event-category-card engagement">
                            <div class="category-header">
                                <span class="category-badge engagement">ENGAGEMENT</span>
                                <span class="category-total">${this.formatNumber(s.engagement_events || 0)}</span>
                            </div>
                            <div class="events-list">
                                ${engagementEvents.slice(0, 5).map(e => `
                                    <div class="event-row">
                                        <span class="event-name">${e.eventName}</span>
                                        <span class="event-count">${this.formatNumber(e.count || 0)}</span>
                                    </div>
                                `).join('') || '<div class="no-events">Aucun événement Engagement</div>'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Top Pages -->
                <div class="analytics-section" style="margin-top: 2rem;">
                    <div class="section-header">
                        <h3>Pages les plus vues</h3>
                        <div class="table-search">
                            <input type="text" id="ga4PagesSearch" placeholder="Rechercher une page..." class="search-input">
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="analytics-table" id="ga4PagesTable">
                            <thead>
                                <tr>
                                    <th class="sortable" data-col="0">Page</th>
                                    <th class="sortable number" data-col="1">Vues</th>
                                    <th class="sortable number" data-col="2">Sessions</th>
                                    <th>Distribution</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Store data for later use
        this.ga4Data = data;

        // Render charts & tables
        setTimeout(() => {
            this.renderGA4TimelineChart(data.timeline);
            this.renderGA4ChannelsChart(channels);
            this.populateGA4ChannelsTable(channels);
            this.populateGA4PagesTable(pages);
            this.setupGA4Interactions();
        }, 100);
    }

    renderGA4TimelineChart(timeline) {
        const ctx = document.getElementById('ga4TimelineChart');
        if (!ctx) return;

        this.charts.ga4Timeline = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: timeline.map(d => {
                    const dateStr = String(d.date);
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    return new Date(`${year}-${month}-${day}`).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
                }),
                datasets: [
                    {
                        label: 'Sessions',
                        data: timeline.map(d => d.sessions),
                        borderColor: '#0B6CD9',
                        backgroundColor: 'rgba(11, 108, 217, 0.15)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Utilisateurs',
                        data: timeline.map(d => d.users),
                        borderColor: '#11845B',
                        backgroundColor: 'rgba(17, 132, 91, 0.15)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        hidden: true
                    },
                    {
                        label: 'Pages vues',
                        data: timeline.map(d => d.pageviews),
                        borderColor: '#D5691B',
                        backgroundColor: 'rgba(213, 105, 27, 0.15)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        hidden: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                            font: { family: 'Inter', size: 11 },
                            callback: (value) => this.formatNumber(value)
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'Inter', size: 11 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        titleFont: { family: 'Inter', size: 13, weight: '600' },
                        bodyFont: { family: 'Inter', size: 12 },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${this.formatNumber(context.parsed.y)}`
                        }
                    }
                }
            }
        });
    }

    renderGA4ChannelsChart(channels) {
        const ctx = document.getElementById('ga4ChannelsChart');
        if (!ctx) return;

        const colors = ['#0B6CD9', '#11845B', '#D5691B', '#7C3AED', '#DC2626', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#84cc16'];

        this.charts.ga4Channels = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: channels.map(c => c.channel || 'Other'),
                datasets: [{
                    data: channels.map(c => c.sessions),
                    backgroundColor: colors.slice(0, channels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        titleFont: { family: 'Inter', size: 13, weight: '600' },
                        bodyFont: { family: 'Inter', size: 12 },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${this.formatNumber(context.parsed)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    populateGA4ChannelsTable(channels) {
        const tbody = document.querySelector('#ga4ChannelsTable tbody');
        if (!tbody) return;

        const totalSessions = channels.reduce((sum, c) => sum + (c.sessions || 0), 0);
        const colors = ['#0B6CD9', '#11845B', '#D5691B', '#7C3AED', '#DC2626', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#84cc16'];

        channels.forEach((channel, i) => {
            const pct = totalSessions > 0 ? ((channel.sessions / totalSessions) * 100).toFixed(1) : 0;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span class="channel-color" style="background: ${colors[i % colors.length]}"></span>
                    ${channel.channel || 'Other'}
                </td>
                <td class="number">${this.formatNumber(channel.sessions || 0)}</td>
                <td class="number">${pct}%</td>
            `;
            tbody.appendChild(row);
        });
    }

    populateGA4PagesTable(pages) {
        const tbody = document.querySelector('#ga4PagesTable tbody');
        if (!tbody) return;

        const maxViews = pages.length > 0 ? pages[0].views : 1;

        pages.forEach(page => {
            const pct = maxViews > 0 ? Math.round((page.views / maxViews) * 100) : 0;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="page-cell">
                    <span class="page-path" title="${page.path}">${page.path || '/'}</span>
                    ${page.title ? `<span class="page-title">${page.title}</span>` : ''}
                </td>
                <td class="number">${this.formatNumber(page.views || 0)}</td>
                <td class="number">${this.formatNumber(page.sessions || 0)}</td>
                <td>
                    <div class="inline-bar-container">
                        <div class="inline-bar" style="width: ${pct}%; background: #0B6CD9;"></div>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#ga4PagesTable');
    }

    setupGA4Interactions() {
        // Timeline metric toggle
        const toggleGroup = document.getElementById('ga4TimelineToggle');
        if (toggleGroup && this.charts.ga4Timeline) {
            toggleGroup.querySelectorAll('.metric-toggle').forEach(btn => {
                btn.addEventListener('click', () => {
                    // Update active state
                    toggleGroup.querySelectorAll('.metric-toggle').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const metric = btn.dataset.metric;
                    const chart = this.charts.ga4Timeline;

                    // Show/hide datasets
                    chart.data.datasets.forEach((ds, i) => {
                        if (metric === 'sessions' && i === 0) ds.hidden = false;
                        else if (metric === 'users' && i === 1) ds.hidden = false;
                        else if (metric === 'pageviews' && i === 2) ds.hidden = false;
                        else ds.hidden = true;
                    });

                    chart.update();
                });
            });
        }

        // Pages search
        const searchInput = document.getElementById('ga4PagesSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                const rows = document.querySelectorAll('#ga4PagesTable tbody tr');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(query) ? '' : 'none';
                });
            });
        }
    }

    // ==================== SEARCH CONSOLE FUNCTIONS ====================

    async fetchSearchConsoleData(clientId, dateFrom, dateTo) {
        const params = new URLSearchParams({
            client_id: clientId,
            date_from: dateFrom,
            date_to: dateTo
        });

        // Add domains filter if specific accounts are selected
        // Fixed: If selectedAccounts is empty array or null/undefined, use all domains
        if (this.selectedAccounts && this.selectedAccounts.length > 0) {
            params.append('domains', this.selectedAccounts.join(','));
        }
        // If selectedAccounts is null or empty, API will use all available domains

        const response = await fetch(`${window.CONFIG.API_URL}/api/analytics/search-console?${params}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch Search Console data');
        }

        return await response.json();
    }

    async renderSearchConsoleReport(clientId, clientName, dateFrom, dateTo) {
        try {
            const data = await this.fetchSearchConsoleData(clientId, dateFrom, dateTo);
            const s = data.summary || {};
            const devices = data.devices || [];
            const queries = data.top_queries || [];
            const pages = data.top_pages || [];

            // Get device icon
            const getDeviceIcon = (device) => {
                const d = (device || '').toUpperCase();
                if (d === 'MOBILE') return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
                if (d === 'TABLET') return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>';
                return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>';
            };

            const totalClicks = devices.reduce((sum, d) => sum + (d.clicks || 0), 0);

            const reportSection = document.getElementById('analyticsReportContainer');
            if (!reportSection) {
                console.error('[Analytics] Report container not found');
                return;
            }

            reportSection.innerHTML = `
                <div class="analytics-report modern-report">
                    <!-- Main KPIs - Colorful Scorecards -->
                    <div class="scorecard-grid">
                        <div class="scorecard bg-blue">
                            <div class="scorecard-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                </svg>
                            </div>
                            <div class="scorecard-content">
                                <div class="scorecard-label">Total Clics</div>
                                <div class="scorecard-value">${this.formatNumber(s.total_clicks || 0)}</div>
                                <div class="scorecard-secondary">
                                    <span class="text-light">Trafic organique</span>
                                </div>
                            </div>
                        </div>

                        <div class="scorecard bg-green">
                            <div class="scorecard-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </div>
                            <div class="scorecard-content">
                                <div class="scorecard-label">Impressions</div>
                                <div class="scorecard-value">${this.formatNumber(s.total_impressions || 0)}</div>
                                <div class="scorecard-secondary">
                                    <span class="text-light">Visibilité Google</span>
                                </div>
                            </div>
                        </div>

                        <div class="scorecard bg-orange">
                            <div class="scorecard-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                                </svg>
                            </div>
                            <div class="scorecard-content">
                                <div class="scorecard-label">CTR moyen</div>
                                <div class="scorecard-value">${(s.avg_ctr || 0).toFixed(2)}%</div>
                                <div class="scorecard-secondary">
                                    <span class="text-light">Taux de clic</span>
                                </div>
                            </div>
                        </div>

                        <div class="scorecard bg-purple">
                            <div class="scorecard-icon">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="20" x2="12" y2="10"></line>
                                    <line x1="18" y1="20" x2="18" y2="4"></line>
                                    <line x1="6" y1="20" x2="6" y2="16"></line>
                                </svg>
                            </div>
                            <div class="scorecard-content">
                                <div class="scorecard-label">Position moy.</div>
                                <div class="scorecard-value">${(s.avg_position || 0).toFixed(1)}</div>
                                <div class="scorecard-secondary">
                                    <span class="text-light">${s.avg_position <= 10 ? 'Page 1' : s.avg_position <= 20 ? 'Page 2' : 'Page 3+'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Secondary KPIs -->
                    <div class="kpi-mini-grid" style="margin-top: 1.5rem;">
                        <div class="kpi-mini-card">
                            <div class="kpi-mini-icon" style="background: rgba(11, 108, 217, 0.1); color: #0B6CD9;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </div>
                            <div class="kpi-mini-content">
                                <div class="kpi-mini-value">${this.formatNumber(queries.length)}</div>
                                <div class="kpi-mini-label">Requêtes</div>
                            </div>
                        </div>
                        <div class="kpi-mini-card">
                            <div class="kpi-mini-icon" style="background: rgba(17, 132, 91, 0.1); color: #11845B;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                            </div>
                            <div class="kpi-mini-content">
                                <div class="kpi-mini-value">${this.formatNumber(pages.length)}</div>
                                <div class="kpi-mini-label">Pages indexées</div>
                            </div>
                        </div>
                    </div>

                    <!-- Timeline Chart -->
                    <div class="analytics-section" style="margin-top: 2rem;">
                        <div class="section-header">
                            <h3>Performance dans le temps</h3>
                        </div>
                        <div class="chart-container" style="height: 280px;">
                            <canvas id="searchConsoleTimelineChart"></canvas>
                        </div>
                    </div>

                    <!-- Two Column Layout: Devices + Top Queries -->
                    <div class="two-column-layout" style="margin-top: 2rem;">
                        <!-- Devices -->
                        <div class="analytics-section">
                            <h3>Performance par appareil</h3>
                            <div class="channels-layout">
                                <div class="chart-container" style="height: 200px;">
                                    <canvas id="searchConsoleDevicesChart"></canvas>
                                </div>
                                <div class="device-cards-grid">
                                    ${devices.map(d => {
                                        const pct = totalClicks > 0 ? Math.round((d.clicks / totalClicks) * 100) : 0;
                                        return `
                                            <div class="device-card">
                                                <div class="device-icon">${getDeviceIcon(d.device)}</div>
                                                <div class="device-info">
                                                    <div class="device-name">${d.device || 'Unknown'}</div>
                                                    <div class="device-stats">${this.formatNumber(d.clicks)} clics</div>
                                                </div>
                                                <div class="device-percentage">${pct}%</div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Top Queries Preview -->
                        <div class="analytics-section">
                            <h3>Top requêtes</h3>
                            <div class="queries-preview">
                                ${queries.slice(0, 8).map((q, i) => {
                                    const maxClicks = queries[0]?.clicks || 1;
                                    const pct = Math.round((q.clicks / maxClicks) * 100);
                                    return `
                                        <div class="query-row">
                                            <span class="query-rank">${i + 1}</span>
                                            <span class="query-text">${q.query || 'N/A'}</span>
                                            <div class="inline-bar-container">
                                                <div class="inline-bar" style="width: ${pct}%; background: #11845B;"></div>
                                            </div>
                                            <span class="query-clicks">${this.formatNumber(q.clicks || 0)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Top Queries Table -->
                    <div class="analytics-section" style="margin-top: 2rem;">
                        <div class="section-header">
                            <h3>Toutes les requêtes</h3>
                            <div class="table-search">
                                <input type="text" id="searchConsoleQueriesSearch" placeholder="Rechercher..." class="search-input">
                            </div>
                        </div>
                        <div class="table-container">
                            <table class="analytics-table" id="searchConsoleQueriesTable">
                                <thead>
                                    <tr>
                                        <th class="sortable" data-col="0">Requête</th>
                                        <th class="sortable number" data-col="1">Clics</th>
                                        <th>Performance</th>
                                        <th class="sortable number" data-col="2">Impressions</th>
                                        <th class="sortable number" data-col="3">CTR</th>
                                        <th class="sortable number" data-col="4">Position</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Top Pages Table -->
                    <div class="analytics-section" style="margin-top: 2rem;">
                        <div class="section-header">
                            <h3>Pages les plus performantes</h3>
                            <div class="table-search">
                                <input type="text" id="searchConsolePagesSearch" placeholder="Rechercher..." class="search-input">
                            </div>
                        </div>
                        <div class="table-container">
                            <table class="analytics-table" id="searchConsolePagesTable">
                                <thead>
                                    <tr>
                                        <th class="sortable" data-col="0">URL</th>
                                        <th class="sortable number" data-col="1">Clics</th>
                                        <th>Performance</th>
                                        <th class="sortable number" data-col="2">Impressions</th>
                                        <th class="sortable number" data-col="3">CTR</th>
                                        <th class="sortable number" data-col="4">Position</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Render charts
            this.renderSearchConsoleTimelineChart(data.timeline);
            this.renderSearchConsoleDevicesChart(data.devices);

            // Populate tables
            this.populateSearchConsoleDevicesTable(data.devices);
            this.populateSearchConsoleQueriesTable(data.top_queries);
            this.populateSearchConsolePagesTable(data.top_pages);
            this.setupSearchConsoleInteractions();

        } catch (error) {
            console.error('Search Console error:', error);
            const container = document.getElementById('analyticsReportContainer');
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <h3>Erreur lors du chargement des données Search Console</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }
    }

    setupSearchConsoleInteractions() {
        ['searchConsoleQueriesSearch', 'searchConsolePagesSearch'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                const tableId = id.replace('Search', 'Table');
                input.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
                    rows.forEach(row => {
                        row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
                    });
                });
            }
        });
    }

    renderSearchConsoleTimelineChart(timeline) {
        const ctx = document.getElementById('searchConsoleTimelineChart');
        if (!ctx) return;

        if (this.charts.searchConsoleTimeline) {
            this.charts.searchConsoleTimeline.destroy();
        }

        this.charts.searchConsoleTimeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeline.map(d => new Date(d.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })),
                datasets: [
                    {
                        label: 'Clicks',
                        data: timeline.map(d => d.clicks),
                        borderColor: '#0B6CD9',
                        backgroundColor: 'rgba(11, 108, 217, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Impressions',
                        data: timeline.map(d => d.impressions),
                        borderColor: '#11845B',
                        backgroundColor: 'rgba(17, 132, 91, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Avg. Position',
                        data: timeline.map(d => d.position),
                        borderColor: '#D5691B',
                        backgroundColor: 'rgba(213, 105, 27, 0.1)',
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y1',
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.yAxisID === 'y1') {
                                    label += context.parsed.y.toFixed(1);
                                } else {
                                    label += context.parsed.y.toLocaleString('fr-FR');
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Clicks / Impressions'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        reverse: true,
                        title: {
                            display: true,
                            text: 'Position (lower is better)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    renderSearchConsoleDevicesChart(devices) {
        const ctx = document.getElementById('searchConsoleDevicesChart');
        if (!ctx) return;

        if (this.charts.searchConsoleDevices) {
            this.charts.searchConsoleDevices.destroy();
        }

        const deviceColors = {
            'DESKTOP': '#0B6CD9',
            'MOBILE': '#11845B',
            'TABLET': '#D5691B'
        };

        this.charts.searchConsoleDevices = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: devices.map(d => d.device),
                datasets: [{
                    data: devices.map(d => d.clicks),
                    backgroundColor: devices.map(d => deviceColors[d.device] || '#6b7280')
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed.toLocaleString('fr-FR')} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    populateSearchConsoleDevicesTable(devices) {
        const tbody = document.querySelector('#searchConsoleDevicesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        devices.forEach(device => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${device.device}</td>
                <td class="number">${this.formatNumber(device.clicks || 0)}</td>
                <td class="number">${this.formatNumber(device.impressions || 0)}</td>
                <td class="number">${(device.ctr || 0).toFixed(2)}%</td>
                <td class="number">${(device.position || 0).toFixed(1)}</td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#searchConsoleDevicesTable');
    }

    populateSearchConsoleQueriesTable(queries) {
        const tbody = document.querySelector('#searchConsoleQueriesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        queries.forEach(query => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${query.query}</td>
                <td class="number">${this.formatNumber(query.clicks || 0)}</td>
                <td class="number">${this.formatNumber(query.impressions || 0)}</td>
                <td class="number">${(query.ctr || 0).toFixed(2)}%</td>
                <td class="number">${(query.position || 0).toFixed(1)}</td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#searchConsoleQueriesTable');
    }

    populateSearchConsolePagesTable(pages) {
        const tbody = document.querySelector('#searchConsolePagesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        pages.forEach(page => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${page.page}">
                    ${page.page}
                </td>
                <td class="number">${this.formatNumber(page.clicks || 0)}</td>
                <td class="number">${this.formatNumber(page.impressions || 0)}</td>
                <td class="number">${(page.ctr || 0).toFixed(2)}%</td>
                <td class="number">${(page.position || 0).toFixed(1)}</td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#searchConsolePagesTable');
    }

    formatNumber(num) {
        return new Intl.NumberFormat('fr-FR').format(num);
    }

    formatCurrency(num) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    showAccountSelectionPanel(accounts) {
        const panel = document.getElementById('analyticsAccountSelection');
        const checkboxContainer = document.getElementById('analyticsAccountCheckboxes');

        if (!panel || !checkboxContainer) {
            console.error('[Analytics] Account selection panel elements not found');
            return;
        }

        // Initialize selectedAccounts to all accounts by default
        this.selectedAccounts = [];

        // Build checkboxes
        checkboxContainer.innerHTML = `
            <label class="account-checkbox-item">
                <input type="checkbox" class="account-checkbox-all" checked>
                <span class="account-checkbox-label">
                    <strong>Tous les domaines</strong>
                    <span class="account-checkbox-count">(${accounts.length} domaines)</span>
                </span>
            </label>
            <div class="account-checkbox-separator"></div>
            ${accounts.map(account => `
                <label class="account-checkbox-item">
                    <input type="checkbox" class="account-checkbox-individual" value="${account}" checked>
                    <span class="account-checkbox-label">${account}</span>
                </label>
            `).join('')}
        `;

        // Handle "All accounts" checkbox
        const allCheckbox = checkboxContainer.querySelector('.account-checkbox-all');
        const individualCheckboxes = checkboxContainer.querySelectorAll('.account-checkbox-individual');

        allCheckbox.addEventListener('change', (e) => {
            individualCheckboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
            this.updateSelectedAccounts();
        });

        individualCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const allChecked = Array.from(individualCheckboxes).every(cb => cb.checked);
                allCheckbox.checked = allChecked;
                this.updateSelectedAccounts();
            });
        });

        // Show the panel
        panel.style.display = 'block';
    }

    hideAccountSelectionPanel() {
        const panel = document.getElementById('analyticsAccountSelection');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    updateSelectedAccounts() {
        const checkboxContainer = document.getElementById('analyticsAccountCheckboxes');
        if (!checkboxContainer) return;

        const individualCheckboxes = checkboxContainer.querySelectorAll('.account-checkbox-individual');
        const allCheckbox = checkboxContainer.querySelector('.account-checkbox-all');

        const selected = Array.from(individualCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        // If all are selected, use empty array to indicate "all domains"
        // If specific ones selected, use the array of selected domains
        this.selectedAccounts = allCheckbox?.checked ? [] : selected;

        // Auto-reload the report with new selection
        console.log('[Analytics] Selected accounts updated:', this.selectedAccounts);

        // Re-render the report with updated selection
        if (this.currentClient && this.currentSource === 'search-console') {
            const scClientSelect = document.getElementById('analyticsClient');
            if (scClientSelect) {
                const scSelectedOption = scClientSelect.options[scClientSelect.selectedIndex];
                const scClientName = scSelectedOption.textContent;
                const scClientId = scSelectedOption.value;

                this.renderSearchConsoleReport(scClientId, scClientName, this.currentDateFrom, this.currentDateTo);
            }
        }
    }
}

// Initialize when tab becomes active
let analyticsManager = null;

// Listen for tab changes
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab') && e.target.dataset.tab === 'analytics') {
        if (!analyticsManager) {
            analyticsManager = new AnalyticsManager();
            setTimeout(() => {
                analyticsManager.init();
            }, 100);
        }
    }
});
