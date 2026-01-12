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

        container.innerHTML = `
            <!-- KPI Cards -->
            <div class="analytics-kpi-grid">
                <div class="analytics-kpi-card">
                    <div class="kpi-label">Total Dépense</div>
                    <div class="kpi-value">${this.formatCurrency(summary.total_spend || 0)}</div>
                </div>
                <div class="analytics-kpi-card">
                    <div class="kpi-label">Total Leads</div>
                    <div class="kpi-value">${this.formatNumber(totalLeads)}</div>
                </div>
                <div class="analytics-kpi-card">
                    <div class="kpi-label">Total Conversions</div>
                    <div class="kpi-value">${this.formatNumber(totalConversions)}</div>
                </div>
                <div class="analytics-kpi-card">
                    <div class="kpi-label">CTR moyen</div>
                    <div class="kpi-value">${(summary.avg_ctr || 0).toFixed(2)}%</div>
                </div>
            </div>

            <!-- Charts Section -->
            <div class="analytics-section">
                <h3>Dépense et Conversions dans le temps</h3>
                <div class="chart-container">
                    <canvas id="metaTimelineChart"></canvas>
                </div>
            </div>

            <!-- Conversions by Type Section -->
            <div class="analytics-section">
                <h3>Conversions par type</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
                    <div class="chart-container" style="height: 300px;">
                        <canvas id="metaConversionsChart"></canvas>
                    </div>
                    <div>
                        <table class="analytics-table" id="metaConversionsTable">
                            <thead>
                                <tr>
                                    <th>Type de conversion</th>
                                    <th class="number">Total</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Campaigns Table -->
            <div class="analytics-section">
                <h3>Performance par campagne</h3>
                <div class="table-container">
                    <table class="analytics-table" id="metaCampaignsTable">
                        <thead>
                            <tr>
                                <th class="sortable" data-col="0">Campagne</th>
                                <th class="sortable" data-col="1">Impressions</th>
                                <th class="sortable" data-col="2">Clics</th>
                                <th class="sortable" data-col="3">Dépense (€)</th>
                                <th class="sortable" data-col="4">CTR (%)</th>
                                <th class="sortable" data-col="5">CPC (€)</th>
                                <th class="sortable" data-col="6">Leads</th>
                                <th class="sortable" data-col="7">Conversions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `;

        // Render timeline chart
        if (timeline && timeline.length > 0) {
            this.renderMetaTimelineChart(timeline);
        }

        // Populate campaigns table
        if (campaigns && campaigns.length > 0) {
            this.populateCampaignsTable(campaigns);
        }

        // Render conversions chart
        if (conversions_by_type && conversions_by_type.length > 0) {
            this.renderConversionsChart(conversions_by_type);
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

        const s = data.summary;
        const conversions_by_type = data.conversions_by_type || [];

        // Calculate leads and conversions
        const { totalLeads, totalConversions } = this.calculateLeadsAndConversions(conversions_by_type);

        container.innerHTML = `
            <div class="analytics-report">
                <div class="analytics-report-header">
                    <h2>📊 Google Ads - ${data.accounts.join(', ')}</h2>
                </div>

                <!-- KPIs -->
                <div class="analytics-kpi-grid">
                    <div class="analytics-kpi-card">
                        <div class="kpi-label">Total Dépense</div>
                        <div class="kpi-value">${this.formatCurrency(s.total_cost || 0)}</div>
                    </div>
                    <div class="analytics-kpi-card">
                        <div class="kpi-label">Total Leads</div>
                        <div class="kpi-value">${this.formatNumber(totalLeads)}</div>
                    </div>
                    <div class="analytics-kpi-card">
                        <div class="kpi-label">Total Conversions</div>
                        <div class="kpi-value">${this.formatNumber(totalConversions)}</div>
                    </div>
                    <div class="analytics-kpi-card">
                        <div class="kpi-label">CTR moyen</div>
                        <div class="kpi-value">${(s.avg_ctr || 0).toFixed(2)}%</div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="analytics-section">
                    <h3>Dépense et Conversions dans le temps</h3>
                    <div class="chart-container" style="height: 300px;">
                        <canvas id="googleAdsTimelineChart"></canvas>
                    </div>
                </div>

                <!-- Conversions by Type Section -->
                <div class="analytics-section">
                    <h3>Conversions par type</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
                        <div class="chart-container" style="height: 300px;">
                            <canvas id="googleAdsConversionsChart"></canvas>
                        </div>
                        <div>
                            <table class="analytics-table" id="googleAdsConversionsTable">
                                <thead>
                                    <tr>
                                        <th>Type de conversion</th>
                                        <th class="number">Total</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Campaigns Table -->
                <div class="analytics-section">
                    <h3>Performance par campagne</h3>
                    <div class="analytics-table-container">
                        <table id="googleAdsCampaignsTable" class="analytics-table">
                            <thead>
                                <tr>
                                    <th>Campagne</th>
                                    <th>Impressions</th>
                                    <th>Clics</th>
                                    <th>Coût</th>
                                    <th>CTR</th>
                                    <th>CPC</th>
                                    <th>Leads</th>
                                    <th>Conversions</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>

                <!-- Keywords Table -->
                <div class="analytics-section">
                    <h3>Mots-clés</h3>
                    <div class="analytics-table-container">
                        <table id="googleAdsKeywordsTable" class="analytics-table">
                            <thead>
                                <tr>
                                    <th>Mot-clé</th>
                                    <th>Impressions</th>
                                    <th>Clics</th>
                                    <th>CTR</th>
                                    <th>Coût</th>
                                    <th>CPC</th>
                                    <th>Conversions</th>
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
            this.populateGoogleAdsCampaignsTable(data.campaigns);
            this.populateGoogleAdsKeywordsTable(data.keywords);
            this.renderGoogleAdsConversionsChart(data.conversions_by_type);
        }, 100);
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

        // Calculate leads and conversions from conversions_by_type
        const { totalLeads, totalConversions } = this.calculateLeadsAndConversions(conversions_by_type);

        container.innerHTML = `
            <div class="analytics-report">
                <h2 class="report-title">📘 LinkedIn Ads - Rapport de Performance</h2>
                <p class="report-accounts">Comptes: ${accounts.join(', ')}</p>

                <!-- KPIs Summary -->
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-icon">💰</div>
                        <div class="kpi-value">${this.formatCurrency(summary.total_spend || 0)}</div>
                        <div class="kpi-label">Total Dépense</div>
                        <div class="kpi-change ${(summary.spend_change || 0) >= 0 ? 'positive' : 'negative'}">
                            ${(summary.spend_change || 0) >= 0 ? '↗' : '↘'} ${Math.abs(summary.spend_change || 0)}%
                        </div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon">🎯</div>
                        <div class="kpi-value">${this.formatNumber(totalLeads)}</div>
                        <div class="kpi-label">Total Leads</div>
                        <div class="kpi-change ${(summary.leads_change || 0) >= 0 ? 'positive' : 'negative'}">
                            ${(summary.leads_change || 0) >= 0 ? '↗' : '↘'} ${Math.abs(summary.leads_change || 0)}%
                        </div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon">✅</div>
                        <div class="kpi-value">${this.formatNumber(totalConversions)}</div>
                        <div class="kpi-label">Total Conversions</div>
                        <div class="kpi-change ${(summary.conversions_change || 0) >= 0 ? 'positive' : 'negative'}">
                            ${(summary.conversions_change || 0) >= 0 ? '↗' : '↘'} ${Math.abs(summary.conversions_change || 0)}%
                        </div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon">📊</div>
                        <div class="kpi-value">${(summary.avg_ctr || 0).toFixed(2)}%</div>
                        <div class="kpi-label">CTR moyen</div>
                        <div class="kpi-change ${(summary.ctr_change || 0) >= 0 ? 'positive' : 'negative'}">
                            ${(summary.ctr_change || 0) >= 0 ? '↗' : '↘'} ${Math.abs(summary.ctr_change || 0)}%
                        </div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="chart-section">
                    <h3>📈 Évolution dans le temps</h3>
                    <div class="chart-container" style="height: 400px;">
                        <canvas id="linkedInAdsTimelineChart"></canvas>
                    </div>
                </div>

                <!-- Conversions by Type -->
                <div class="chart-section">
                    <h3>🎯 Conversions par Type</h3>
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
                        <div class="chart-container" style="height: 300px;">
                            <canvas id="linkedInAdsConversionsChart"></canvas>
                        </div>
                        <div>
                            <table class="data-table" id="linkedInAdsConversionsTable">
                                <thead>
                                    <tr>
                                        <th>Type de Conversion</th>
                                        <th class="number">Nombre</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Campaigns Table -->
                <div class="chart-section">
                    <h3>📋 Performance par Campagne</h3>
                    <table class="data-table" id="linkedInAdsCampaignsTable">
                        <thead>
                            <tr>
                                <th>Campagne</th>
                                <th class="number">Impressions</th>
                                <th class="number">Clics</th>
                                <th class="number">Dépense</th>
                                <th class="number">CTR</th>
                                <th class="number">CPC</th>
                                <th class="number">Leads</th>
                                <th class="number">Conversions</th>
                                <th class="number">Engagements</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `;

        // Populate charts and tables
        this.renderLinkedInAdsTimelineChart(timeline);
        this.renderLinkedInAdsConversionsChart(conversions_by_type);
        this.populateLinkedInAdsConversionsTable(conversions_by_type);
        this.populateLinkedInAdsCampaignsTable(campaigns);
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

        // Determine which platforms are available
        const availablePlatforms = [];
        if (platforms_available.meta) availablePlatforms.push('Meta Ads');
        if (platforms_available.google) availablePlatforms.push('Google Ads');
        if (platforms_available.linkedin) availablePlatforms.push('LinkedIn Ads');

        container.innerHTML = `
            <div class="analytics-report">
                <h2 class="report-title">📊 Paid Media - Vue Globale</h2>
                <p class="report-accounts">Plateformes: ${availablePlatforms.join(' + ')}</p>

                <!-- KPIs Summary -->
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-icon">💰</div>
                        <div class="kpi-value">${this.formatCurrency(summary.total_spend || 0)}</div>
                        <div class="kpi-label">Total Dépense</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon">👁️</div>
                        <div class="kpi-value">${this.formatNumber(summary.total_impressions || 0)}</div>
                        <div class="kpi-label">Total Impressions</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon">👆</div>
                        <div class="kpi-value">${this.formatNumber(summary.total_clicks || 0)}</div>
                        <div class="kpi-label">Total Clics</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon">🎯</div>
                        <div class="kpi-value">${this.formatNumber(summary.total_leads || 0)}</div>
                        <div class="kpi-label">Total Leads</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon">✅</div>
                        <div class="kpi-value">${this.formatNumber(summary.total_conversions || 0)}</div>
                        <div class="kpi-label">Total Conversions</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon">📊</div>
                        <div class="kpi-value">${(summary.avg_ctr || 0).toFixed(2)}%</div>
                        <div class="kpi-label">CTR moyen</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-icon">💵</div>
                        <div class="kpi-value">${this.formatCurrency(summary.avg_cpc || 0)}</div>
                        <div class="kpi-label">CPC moyen</div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="chart-section">
                    <h3>📈 Évolution dans le temps</h3>
                    <div class="chart-container" style="height: 400px;">
                        <canvas id="paidMediaTimelineChart"></canvas>
                    </div>
                </div>

                <!-- Platform Breakdown -->
                <div class="chart-section">
                    <h3>📊 Performance par Plateforme</h3>
                    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem;">
                        <div class="chart-container" style="height: 300px;">
                            <canvas id="paidMediaPlatformChart"></canvas>
                        </div>
                        <div>
                            <table class="data-table" id="paidMediaPlatformTable">
                                <thead>
                                    <tr>
                                        <th>Plateforme</th>
                                        <th class="number">Impressions</th>
                                        <th class="number">Clics</th>
                                        <th class="number">Dépense</th>
                                        <th class="number">CTR</th>
                                        <th class="number">Leads</th>
                                        <th class="number">Conversions</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Populate charts and tables
        this.renderPaidMediaTimelineChart(timeline);
        this.renderPaidMediaPlatformChart(platform_breakdown);
        this.populatePaidMediaPlatformTable(platform_breakdown);
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

        container.innerHTML = `
            <div class="analytics-report">
                <!-- Summary Cards -->
                <div class="analytics-summary">
                    <div class="summary-card">
                        <h4>Sessions</h4>
                        <div class="metric-value">${this.formatNumber(data.summary.sessions)}</div>
                    </div>
                    <div class="summary-card">
                        <h4>Utilisateurs</h4>
                        <div class="metric-value">${this.formatNumber(data.summary.users)}</div>
                    </div>
                    <div class="summary-card">
                        <h4>Pages vues</h4>
                        <div class="metric-value">${this.formatNumber(data.summary.pageviews)}</div>
                    </div>
                    <div class="summary-card">
                        <h4>Conversions</h4>
                        <div class="metric-value">${this.formatNumber(data.summary.conversions)}</div>
                    </div>
                    <div class="summary-card">
                        <h4>Taux rebond</h4>
                        <div class="metric-value">${(data.summary.bounce_rate || 0).toFixed(1)}%</div>
                    </div>
                    <div class="summary-card">
                        <h4>Engagement</h4>
                        <div class="metric-value">${(data.summary.engagement_rate || 0).toFixed(1)}%</div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="analytics-section">
                    <h3>Évolution dans le temps</h3>
                    <div class="chart-container" style="height: 300px;">
                        <canvas id="ga4TimelineChart"></canvas>
                    </div>
                </div>

                <!-- Channels Chart & Table -->
                <div class="analytics-section">
                    <h3>Acquisition par canal</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div class="chart-container" style="height: 300px;">
                            <canvas id="ga4ChannelsChart"></canvas>
                        </div>
                        <div style="overflow-x: auto;">
                            <table class="analytics-table" id="ga4ChannelsTable">
                                <thead>
                                    <tr>
                                        <th>Canal</th>
                                        <th>Sessions</th>
                                        <th>Utilisateurs</th>
                                        <th>Conversions</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Landing Pages -->
                <div class="analytics-section">
                    <h3>Pages d'atterrissage principales</h3>
                    <div style="overflow-x: auto;">
                        <table class="analytics-table" id="ga4LandingPagesTable">
                            <thead>
                                <tr>
                                    <th>Page</th>
                                    <th>Sessions</th>
                                    <th>Utilisateurs</th>
                                    <th>Taux rebond</th>
                                    <th>Engagement</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>

                <!-- Demographics -->
                <div class="analytics-section">
                    <h3>Audience (Pays & Appareil)</h3>
                    <div style="overflow-x: auto;">
                        <table class="analytics-table" id="ga4DemographicsTable">
                            <thead>
                                <tr>
                                    <th>Pays</th>
                                    <th>Appareil</th>
                                    <th>Sessions</th>
                                    <th>Utilisateurs</th>
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
            this.renderGA4TimelineChart(data.timeline);
            this.renderGA4ChannelsChart(data.channels);
            this.populateGA4ChannelsTable(data.channels);
            this.populateGA4LandingPagesTable(data.landing_pages);
            this.populateGA4DemographicsTable(data.demographics);
        }, 100);
    }

    renderGA4TimelineChart(timeline) {
        const ctx = document.getElementById('ga4TimelineChart');
        if (!ctx) return;

        this.charts.ga4Timeline = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: timeline.map(d => {
                    const dateStr = d.date;
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
                        backgroundColor: 'rgba(11, 108, 217, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Utilisateurs',
                        data: timeline.map(d => d.users),
                        borderColor: '#11845B',
                        backgroundColor: 'rgba(17, 132, 91, 0.1)',
                        tension: 0.4,
                        fill: true
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
                        title: { display: true, text: 'Nombre' }
                    }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }

    renderGA4ChannelsChart(channels) {
        const ctx = document.getElementById('ga4ChannelsChart');
        if (!ctx) return;

        this.charts.ga4Channels = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: channels.map(c => c.channel),
                datasets: [{
                    data: channels.map(c => c.sessions),
                    backgroundColor: ['#0B6CD9', '#11845B', '#D5691B', '#8b5cf6', '#DC2626', '#ec4899', '#14b8a6', '#f59e0b']
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
                            font: { family: 'Inter', size: 12 }
                        }
                    }
                }
            }
        });
    }

    populateGA4ChannelsTable(channels) {
        const tbody = document.querySelector('#ga4ChannelsTable tbody');
        if (!tbody) return;

        channels.forEach(channel => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${channel.channel || 'N/A'}</td>
                <td class="number">${this.formatNumber(channel.sessions || 0)}</td>
                <td class="number">${this.formatNumber(channel.users || 0)}</td>
                <td class="number">${this.formatNumber(channel.conversions || 0)}</td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#ga4ChannelsTable');
    }

    populateGA4LandingPagesTable(pages) {
        const tbody = document.querySelector('#ga4LandingPagesTable tbody');
        if (!tbody) return;

        pages.slice(0, 20).forEach(page => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${page.page || 'N/A'}</td>
                <td class="number">${this.formatNumber(page.sessions || 0)}</td>
                <td class="number">${this.formatNumber(page.users || 0)}</td>
                <td class="number">${(page.bounce_rate || 0).toFixed(1)}%</td>
                <td class="number">${(page.engagement_rate || 0).toFixed(1)}%</td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#ga4LandingPagesTable');
    }

    populateGA4DemographicsTable(demographics) {
        const tbody = document.querySelector('#ga4DemographicsTable tbody');
        if (!tbody) return;

        demographics.slice(0, 20).forEach(demo => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${demo.country || 'N/A'}</td>
                <td>${demo.device || 'N/A'}</td>
                <td class="number">${this.formatNumber(demo.sessions || 0)}</td>
                <td class="number">${this.formatNumber(demo.users || 0)}</td>
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#ga4DemographicsTable');
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

            const reportSection = document.getElementById('analyticsReportContainer');
            if (!reportSection) {
                console.error('[Analytics] Report container not found');
                return;
            }
            reportSection.innerHTML = `
                <div class="report-header">
                    <h2>📊 Search Console - ${clientName}</h2>
                    <p class="report-subtitle">
                        ${data.domain_name || 'Domain not found'} •
                        ${new Date(dateFrom).toLocaleDateString('fr-FR')} - ${new Date(dateTo).toLocaleDateString('fr-FR')}
                    </p>
                </div>

                <!-- Summary KPIs -->
                <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 30px;">
                    <div class="kpi-card">
                        <div class="kpi-label">Total Clicks</div>
                        <div class="kpi-value">${this.formatNumber(data.summary.total_clicks || 0)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Total Impressions</div>
                        <div class="kpi-value">${this.formatNumber(data.summary.total_impressions || 0)}</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Avg. CTR</div>
                        <div class="kpi-value">${(data.summary.avg_ctr || 0).toFixed(2)}%</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Avg. Position</div>
                        <div class="kpi-value">${(data.summary.avg_position || 0).toFixed(1)}</div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="chart-container" style="margin-bottom: 30px;">
                    <h3 style="margin-bottom: 15px;">Performance Timeline</h3>
                    <canvas id="searchConsoleTimelineChart" height="80"></canvas>
                </div>

                <!-- Devices Chart & Table -->
                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 30px; margin-bottom: 30px;">
                    <div class="chart-container">
                        <h3 style="margin-bottom: 15px;">Clicks by Device</h3>
                        <canvas id="searchConsoleDevicesChart"></canvas>
                    </div>
                    <div>
                        <h3 style="margin-bottom: 15px;">Device Performance</h3>
                        <table class="analytics-table" id="searchConsoleDevicesTable">
                            <thead>
                                <tr>
                                    <th>Device</th>
                                    <th class="number">Clicks</th>
                                    <th class="number">Impressions</th>
                                    <th class="number">CTR</th>
                                    <th class="number">Avg. Position</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </div>

                <!-- Top Queries Table -->
                <div style="margin-bottom: 30px;">
                    <h3 style="margin-bottom: 15px;">Top 100 Search Queries</h3>
                    <table class="analytics-table" id="searchConsoleQueriesTable">
                        <thead>
                            <tr>
                                <th>Query</th>
                                <th class="number">Clicks</th>
                                <th class="number">Impressions</th>
                                <th class="number">CTR</th>
                                <th class="number">Avg. Position</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>

                <!-- Top Pages Table -->
                <div>
                    <h3 style="margin-bottom: 15px;">Top 100 Pages</h3>
                    <table class="analytics-table" id="searchConsolePagesTable">
                        <thead>
                            <tr>
                                <th>Page URL</th>
                                <th class="number">Clicks</th>
                                <th class="number">Impressions</th>
                                <th class="number">CTR</th>
                                <th class="number">Avg. Position</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;

            // Render charts
            this.renderSearchConsoleTimelineChart(data.timeline);
            this.renderSearchConsoleDevicesChart(data.devices);

            // Populate tables
            this.populateSearchConsoleDevicesTable(data.devices);
            this.populateSearchConsoleQueriesTable(data.top_queries);
            this.populateSearchConsolePagesTable(data.top_pages);

        } catch (error) {
            console.error('Search Console error:', error);
            const container = document.getElementById('analyticsReportContainer');
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <h3>⚠️ Error Loading Search Console Data</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }
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
