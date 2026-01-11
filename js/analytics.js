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
                    // Use client name or alternative name as GA4 property
                    const clientSelect = document.getElementById('analyticsClient');
                    const selectedOption = clientSelect.options[clientSelect.selectedIndex];
                    const clientName = selectedOption.textContent.split('(')[0].trim();

                    data = await this.fetchGA4Data(clientName, dateFrom, dateTo);
                    this.renderGA4Report(data);
                    break;
                case 'search-console':
                    // Use client_id for Search Console
                    const scClientSelect = document.getElementById('analyticsClient');
                    const scSelectedOption = scClientSelect.options[scClientSelect.selectedIndex];
                    const scClientName = scSelectedOption.textContent.split('(')[0].trim();
                    const scClientId = scSelectedOption.value;

                    await this.renderSearchConsoleReport(scClientId, scClientName, dateFrom, dateTo);
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

    async fetchGA4Data(property, dateFrom, dateTo) {
        const url = `${CONFIG.API_URL}/api/analytics/ga4?property=${encodeURIComponent(property)}&date_from=${dateFrom}&date_to=${dateTo}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch GA4 data');
        return await response.json();
    }

    renderGA4Report(data) {
        const container = document.getElementById('analyticsReportContainer');

        // Destroy existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.charts = {};

        const reportContent = document.getElementById('analyticsReportContent');
        reportContent.innerHTML = `
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

        const response = await fetch(`${API_URL}/api/analytics/search-console?${params}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch Search Console data');
        }

        return await response.json();
    }

    async renderSearchConsoleReport(clientId, clientName, dateFrom, dateTo) {
        try {
            const data = await this.fetchSearchConsoleData(clientId, dateFrom, dateTo);

            const reportSection = document.getElementById('analyticsReportSection');
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
            document.getElementById('analyticsReportSection').innerHTML = `
                <div class="error-message">
                    <h3>⚠️ Error Loading Search Console Data</h3>
                    <p>${error.message}</p>
                </div>
            `;
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
