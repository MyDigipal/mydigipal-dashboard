// MyDigipal Dashboard - Charts Module (Phase 3.3)
// Handles Chart.js rendering with caching to avoid unnecessary redraws

class ChartManager {
  constructor() {
    this.charts = {};
    this.chartCache = {}; // Cache to prevent unnecessary redraws (Phase 3.3)
    this.currentTab = null;
  }

  /**
   * Destroy a chart instance
   * @param {string} chartId - Chart canvas ID
   */
  destroyChart(chartId) {
    if (this.charts[chartId]) {
      this.charts[chartId].destroy();
      delete this.charts[chartId];
    }
  }

  /**
   * Clear chart cache (call when filters change)
   */
  clearCache() {
    this.chartCache = {};
  }

  /**
   * Check if we should skip redrawing (Phase 3.3 optimization)
   * @param {string} cacheKey - Unique cache key for the chart
   * @returns {boolean} True if we can skip redraw
   */
  shouldSkipRedraw(cacheKey) {
    return this.chartCache[cacheKey] === true;
  }

  /**
   * Mark chart as cached
   * @param {string} cacheKey - Unique cache key
   */
  markCached(cacheKey) {
    this.chartCache[cacheKey] = true;
  }

  /**
   * Render clients chart (horizontal bar chart)
   * @param {Array} data - Client data
   */
  renderClientsChart(data) {
    const cacheKey = 'clients-' + JSON.stringify(data.map(c => c.client_id));

    // Phase 3.3: Skip if already drawn with same data
    if (this.shouldSkipRedraw(cacheKey)) return;

    this.destroyChart('clientsChart');

    const ctx = document.getElementById('clientsChart');
    if (!ctx) return;

    const top15 = data.slice(0, 15);

    this.charts.clientsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top15.map(c => c.client_name),
        datasets: [
          {
            label: 'Revenue',
            data: top15.map(c => c.revenue),
            backgroundColor: CONFIG.COLORS.SUCCESS
          },
          {
            label: 'Coût',
            data: top15.map(c => c.cost),
            backgroundColor: CONFIG.COLORS.DANGER
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(33, 31, 84, 0.95)',
            borderColor: '#666',
            borderWidth: 1,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            padding: 12,
            callbacks: {
              label: ctx => {
                const label = ctx.dataset.label || '';
                const value = '£' + ctx.raw.toLocaleString('en-GB');
                return `${label}: ${value}`;
              }
            }
          },
          datalabels: { display: false }
        }
      }
    });

    this.markCached(cacheKey);
  }

  /**
   * Render monthly evolution chart (line chart)
   * @param {Array} data - Monthly data
   */
  renderMonthlyChart(data) {
    const cacheKey = 'monthly-' + data.length;
    if (this.shouldSkipRedraw(cacheKey)) return;

    this.destroyChart('monthlyChart');

    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

    this.charts.monthlyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.month),
        datasets: [
          {
            label: 'Revenue',
            data: data.map(d => d.revenue),
            borderColor: CONFIG.COLORS.SUCCESS,
            backgroundColor: CONFIG.COLORS.SUCCESS + '20',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Coût',
            data: data.map(d => d.cost),
            borderColor: CONFIG.COLORS.DANGER,
            backgroundColor: CONFIG.COLORS.DANGER + '20',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Profit',
            data: data.map(d => d.profit),
            borderColor: CONFIG.COLORS.PRIMARY,
            backgroundColor: CONFIG.COLORS.PRIMARY + '20',
            tension: 0.3,
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
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(33, 31, 84, 0.95)',
            borderColor: '#666',
            borderWidth: 1,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            padding: 12,
            callbacks: {
              label: ctx => {
                const label = ctx.dataset.label || '';
                const value = '£' + ctx.raw.toLocaleString('en-GB');
                return `${label}: ${value}`;
              }
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: value => '£' + value.toLocaleString('en-GB')
            }
          }
        }
      }
    });

    this.markCached(cacheKey);
  }

  /**
   * Render employee hours chart (doughnut)
   * @param {Array} data - Employee data
   */
  renderEmployeesChart(data) {
    const cacheKey = 'employees-' + data.length;
    if (this.shouldSkipRedraw(cacheKey)) return;

    this.destroyChart('employeesChart');

    const ctx = document.getElementById('employeesChart');
    if (!ctx) return;

    const colors = Object.values(CONFIG.COLORS.EMPLOYEES);

    this.charts.employeesChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(e => e.employee_name),
        datasets: [{
          data: data.map(e => e.total_hours),
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: ctx => ctx.label + ': ' + ctx.raw.toLocaleString('en-GB') + 'h'
            }
          },
          datalabels: {
            formatter: (value, ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const percent = ((value / total) * 100).toFixed(0);
              return percent + '%';
            },
            color: '#fff',
            font: { weight: 'bold', size: 12 }
          }
        }
      }
    });

    this.markCached(cacheKey);
  }

  /**
   * Render client timeline chart (stacked bar for daily hours by employee)
   * @param {Array} dailyData - Daily hours data
   * @param {Array} employeeList - List of unique employees
   */
  renderClientTimelineChart(dailyData, employeeList) {
    const cacheKey = 'timeline-' + dailyData.length;
    if (this.shouldSkipRedraw(cacheKey)) return;

    this.destroyChart('clientTimelineChart');

    const ctx = document.getElementById('clientTimelineChart');
    if (!ctx) return;

    // Group by date and employee
    const dateMap = {};
    dailyData.forEach(d => {
      if (!dateMap[d.date]) dateMap[d.date] = {};
      dateMap[d.date][d.employee_name] = d.hours;
    });

    const dates = Object.keys(dateMap).sort();
    const datasets = employeeList.map((emp, idx) => ({
      label: emp,
      data: dates.map(date => dateMap[date][emp] || 0),
      backgroundColor: Object.values(CONFIG.COLORS.EMPLOYEES)[idx % Object.values(CONFIG.COLORS.EMPLOYEES).length]
    }));

    this.charts.clientTimelineChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(33, 31, 84, 0.95)',
            borderColor: '#666',
            borderWidth: 1,
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            padding: 12,
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.raw}h`
            }
          },
          datalabels: { display: false }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true }
        }
      }
    });

    this.markCached(cacheKey);
  }

  /**
   * Render client employees doughnut chart
   * @param {Array} totals - Employee totals data
   */
  renderClientEmployeesDoughnut(totals) {
    const cacheKey = 'client-employees-' + totals.length;
    if (this.shouldSkipRedraw(cacheKey)) return;

    this.destroyChart('clientEmployeesChart');

    const ctx = document.getElementById('clientEmployeesChart');
    if (!ctx) return;

    const sortedTotals = [...totals].sort((a, b) => b.total_hours - a.total_hours);
    const colors = sortedTotals.map((t, idx) =>
      CONFIG.COLORS.EMPLOYEES[t.employee_name] ||
      Object.values(CONFIG.COLORS.EMPLOYEES)[idx % Object.values(CONFIG.COLORS.EMPLOYEES).length]
    );

    this.charts.clientEmployeesChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: sortedTotals.map(t => t.employee_name),
        datasets: [{
          data: sortedTotals.map(t => t.total_hours),
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: ctx => ctx.label + ': ' + ctx.raw.toFixed(1) + 'h'
            }
          },
          datalabels: {
            formatter: (value, ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const percent = ((value / total) * 100).toFixed(0);
              return percent + '%';
            },
            color: '#fff',
            font: { weight: 'bold', size: 12 }
          }
        }
      }
    });

    this.markCached(cacheKey);
  }

  /**
   * Destroy all charts (useful for cleanup)
   */
  destroyAll() {
    Object.keys(this.charts).forEach(chartId => this.destroyChart(chartId));
    this.clearCache();
  }
}

// Create global chart manager instance
window.chartManager = new ChartManager();
