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
                    if (client.alternative_name) {
                        option.textContent += ` (${client.alternative_name})`;
                    }
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
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const dateFromInput = document.getElementById('analyticsDateFrom');
        const dateToInput = document.getElementById('analyticsDateTo');

        if (dateFromInput) {
            dateFromInput.value = thirtyDaysAgo.toISOString().split('T')[0];
        }
        if (dateToInput) {
            dateToInput.value = today.toISOString().split('T')[0];
        }
    }

    async loadReport() {
        const clientId = document.getElementById('analyticsClient').value;
        const source = document.getElementById('analyticsSource').value;
        const dateFrom = document.getElementById('analyticsDateFrom').value;
        const dateTo = document.getElementById('analyticsDateTo').value;

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
        container.innerHTML = '<div class="loading">⏳ Chargement du rapport...</div>';

        try {
            console.log(`[Analytics] Loading ${source} report for ${clientId} (${dateFrom} to ${dateTo})`);

            let data;
            switch (source) {
                case 'meta':
                    data = await this.fetchMetaAdsData(clientId, dateFrom, dateTo);
                    this.renderMetaAdsReport(data);
                    break;
                case 'google-ads':
                    data = await this.fetchGoogleAdsData(clientId, dateFrom, dateTo);
                    this.renderGoogleAdsReport(data);
                    break;
                case 'ga4':
                    container.innerHTML = '<div class="coming-soon">📊 Google Analytics 4 - Bientôt disponible</div>';
                    break;
                case 'search-console':
                    container.innerHTML = '<div class="coming-soon">📊 Search Console - Bientôt disponible</div>';
                    break;
                case 'multi':
                    container.innerHTML = '<div class="coming-soon">📊 Multi-Source - Bientôt disponible</div>';
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

        container.innerHTML = `
            <!-- KPI Cards -->
            <div class="analytics-kpi-grid">
                <div class="analytics-kpi-card">
                    <div class="kpi-label">Impressions</div>
                    <div class="kpi-value">${this.formatNumber(summary.total_impressions || 0)}</div>
                    <div class="kpi-change ${(summary.impressions_change || 0) >= 0 ? 'positive' : 'negative'}">
                        ${(summary.impressions_change || 0) >= 0 ? '↑' : '↓'} ${Math.abs(summary.impressions_change || 0)}%
                    </div>
                </div>
                <div class="analytics-kpi-card">
                    <div class="kpi-label">Clics</div>
                    <div class="kpi-value">${this.formatNumber(summary.total_clicks || 0)}</div>
                    <div class="kpi-change ${(summary.clicks_change || 0) >= 0 ? 'positive' : 'negative'}">
                        ${(summary.clicks_change || 0) >= 0 ? '↑' : '↓'} ${Math.abs(summary.clicks_change || 0)}%
                    </div>
                </div>
                <div class="analytics-kpi-card">
                    <div class="kpi-label">CTR</div>
                    <div class="kpi-value">${(summary.avg_ctr || 0).toFixed(2)}%</div>
                    <div class="kpi-change ${(summary.ctr_change || 0) >= 0 ? 'positive' : 'negative'}">
                        ${(summary.ctr_change || 0) >= 0 ? '↑' : '↓'} ${Math.abs(summary.ctr_change || 0)}%
                    </div>
                </div>
                <div class="analytics-kpi-card">
                    <div class="kpi-label">Dépense</div>
                    <div class="kpi-value">${this.formatCurrency(summary.total_spend || 0)}</div>
                    <div class="kpi-change ${(summary.spend_change || 0) >= 0 ? 'positive' : 'negative'}">
                        ${(summary.spend_change || 0) >= 0 ? '↑' : '↓'} ${Math.abs(summary.spend_change || 0)}%
                    </div>
                </div>
                <div class="analytics-kpi-card">
                    <div class="kpi-label">CPC</div>
                    <div class="kpi-value">${this.formatCurrency(summary.avg_cpc || 0)}</div>
                    <div class="kpi-change ${(summary.cpc_change || 0) <= 0 ? 'positive' : 'negative'}">
                        ${(summary.cpc_change || 0) <= 0 ? '↓' : '↑'} ${Math.abs(summary.cpc_change || 0)}%
                    </div>
                </div>
                <div class="analytics-kpi-card">
                    <div class="kpi-label">Conversions</div>
                    <div class="kpi-value">${this.formatNumber(summary.total_conversions || 0)}</div>
                    <div class="kpi-change ${(summary.conversions_change || 0) >= 0 ? 'positive' : 'negative'}">
                        ${(summary.conversions_change || 0) >= 0 ? '↑' : '↓'} ${Math.abs(summary.conversions_change || 0)}%
                    </div>
                </div>
            </div>

            <!-- Charts Section -->
            <div class="analytics-section">
                <h3>Performance dans le temps</h3>
                <div class="chart-container">
                    <canvas id="metaTimelineChart"></canvas>
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
                                <th class="sortable" data-col="3">CTR (%)</th>
                                <th class="sortable" data-col="4">Dépense (€)</th>
                                <th class="sortable" data-col="5">CPC (€)</th>
                                <th class="sortable" data-col="6">Conv.</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <!-- Conversions Breakdown -->
            <div class="analytics-section">
                <h3>Conversions par type</h3>
                <div class="chart-container" style="height: 300px;">
                    <canvas id="metaConversionsChart"></canvas>
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
            type: 'line',
            data: {
                labels: timeline.map(d => {
                    const date = new Date(d.date);
                    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                }),
                datasets: [
                    {
                        label: 'Impressions',
                        data: timeline.map(d => d.impressions),
                        borderColor: '#0B6CD9',
                        backgroundColor: 'rgba(11, 108, 217, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Clics',
                        data: timeline.map(d => d.clicks),
                        borderColor: '#11845B',
                        backgroundColor: 'rgba(17, 132, 91, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Dépense (€)',
                        data: timeline.map(d => d.spend),
                        borderColor: '#D5691B',
                        backgroundColor: 'rgba(213, 105, 27, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y1'
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
                                size: 12,
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
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 11
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
                                size: 11
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
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${campaign.campaign_name || 'N/A'}</td>
                <td class="number">${this.formatNumber(campaign.impressions || 0)}</td>
                <td class="number">${this.formatNumber(campaign.clicks || 0)}</td>
                <td class="number">${(campaign.ctr || 0).toFixed(2)}%</td>
                <td class="number">${this.formatCurrency(campaign.spend || 0)}</td>
                <td class="number">${this.formatCurrency(campaign.cpc || 0)}</td>
                <td class="number">${this.formatNumber(campaign.conversions || 0)}</td>
            `;
            tbody.appendChild(row);
        });

        // Add sorting functionality
        this.makeSortable('#metaCampaignsTable');
    }

    renderConversionsChart(conversions) {
        const ctx = document.getElementById('metaConversionsChart');
        if (!ctx) return;

        this.charts.metaConversions = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: conversions.map(c => c.type),
                datasets: [{
                    data: conversions.map(c => c.count),
                    backgroundColor: [
                        '#0B6CD9',
                        '#11845B',
                        '#D5691B',
                        '#8b5cf6',
                        '#DC2626'
                    ]
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
                                size: 12
                            }
                        }
                    }
                }
            }
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

        // Destroy existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.charts = {};

        const s = data.summary;

        container.innerHTML = `
            <div class="analytics-report">
                <div class="analytics-report-header">
                    <h2>📊 Google Ads - ${data.accounts.join(', ')}</h2>
                </div>

                <!-- KPIs -->
                <div class="analytics-kpi-grid">
                    <div class="analytics-kpi-card">
                        <div class="kpi-label">Impressions</div>
                        <div class="kpi-value">${this.formatNumber(s.total_impressions || 0)}</div>
                    </div>
                    <div class="analytics-kpi-card">
                        <div class="kpi-label">Clics</div>
                        <div class="kpi-value">${this.formatNumber(s.total_clicks || 0)}</div>
                    </div>
                    <div class="analytics-kpi-card">
                        <div class="kpi-label">Coût</div>
                        <div class="kpi-value">${this.formatCurrency(s.total_cost || 0)}</div>
                    </div>
                    <div class="analytics-kpi-card">
                        <div class="kpi-label">CTR</div>
                        <div class="kpi-value">${(s.avg_ctr || 0).toFixed(2)}%</div>
                    </div>
                    <div class="analytics-kpi-card">
                        <div class="kpi-label">CPC</div>
                        <div class="kpi-value">${this.formatCurrency(s.avg_cpc || 0)}</div>
                    </div>
                    <div class="analytics-kpi-card">
                        <div class="kpi-label">Conversions</div>
                        <div class="kpi-value">${this.formatNumber(s.total_conversions || 0)}</div>
                    </div>
                </div>

                <!-- Timeline Chart -->
                <div class="analytics-section">
                    <h3>Tendance</h3>
                    <div class="chart-container" style="height: 300px;">
                        <canvas id="googleAdsTimelineChart"></canvas>
                    </div>
                </div>

                <!-- Campaigns & Keywords -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div class="analytics-section">
                        <h3>Campagnes</h3>
                        <div class="analytics-table-container">
                            <table id="googleAdsCampaignsTable" class="analytics-table">
                                <thead>
                                    <tr>
                                        <th>Campagne</th>
                                        <th>Impressions</th>
                                        <th>Clics</th>
                                        <th>CTR</th>
                                        <th>Coût</th>
                                        <th>CPC</th>
                                        <th>Conv.</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>

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
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Conversions -->
                <div class="analytics-section">
                    <h3>Conversions par type</h3>
                    <div class="chart-container" style="height: 300px;">
                        <canvas id="googleAdsConversionsChart"></canvas>
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
            type: 'line',
            data: {
                labels: timeline.map(d => new Date(d.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })),
                datasets: [
                    {
                        label: 'Clics',
                        data: timeline.map(d => d.clicks),
                        borderColor: '#0B6CD9',
                        backgroundColor: 'rgba(11, 108, 217, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Coût (€)',
                        data: timeline.map(d => d.cost),
                        borderColor: '#DC2626',
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1'
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
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Clics' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Coût (€)' },
                        grid: { drawOnChartArea: false }
                    }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }

    populateGoogleAdsCampaignsTable(campaigns) {
        const tbody = document.querySelector('#googleAdsCampaignsTable tbody');
        if (!tbody) return;

        campaigns.slice(0, 20).forEach(campaign => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${campaign.campaign_name || 'N/A'}</td>
                <td class="number">${this.formatNumber(campaign.impressions || 0)}</td>
                <td class="number">${this.formatNumber(campaign.clicks || 0)}</td>
                <td class="number">${(campaign.ctr || 0).toFixed(2)}%</td>
                <td class="number">${this.formatCurrency(campaign.cost || 0)}</td>
                <td class="number">${this.formatCurrency(campaign.cpc || 0)}</td>
                <td class="number">${this.formatNumber(campaign.conversions || 0)}</td>
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
            `;
            tbody.appendChild(row);
        });

        this.makeSortable('#googleAdsKeywordsTable');
    }

    renderGoogleAdsConversionsChart(conversions) {
        const ctx = document.getElementById('googleAdsConversionsChart');
        if (!ctx) return;

        this.charts.googleAdsConversions = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: conversions.map(c => c.type),
                datasets: [{
                    data: conversions.map(c => c.count),
                    backgroundColor: ['#0B6CD9', '#11845B', '#D5691B', '#8b5cf6', '#DC2626']
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
