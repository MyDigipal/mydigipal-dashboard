// MyDigipal Dashboard - Data Health Module
// Handles data quality monitoring and visualization

class HealthManager {
  constructor() {
    this.healthData = null;
    this.timelineChart = null;
  }

  /**
   * Load and display health data
   */
  async loadHealth() {
    try {
      // Fetch latest health check
      const latestData = await this.fetchLatestHealthCheck();

      // Fetch historical data (last 30 days)
      const historicalData = await this.fetchHealthHistory(30);

      // Render table
      this.renderHealthTable(latestData);

      // Render timeline chart
      this.renderHealthTimeline(historicalData);

    } catch (error) {
      console.error('Error loading health data:', error);
      document.getElementById('healthTableBody').innerHTML = `
        <tr>
          <td colspan="6" class="text-center" style="color: #dc2626;">
            Erreur de chargement des données de santé
          </td>
        </tr>
      `;
    }
  }

  /**
   * Fetch latest health check from BigQuery
   */
  async fetchLatestHealthCheck() {
    const response = await fetch(`${CONFIG.API_URL}/api/health/latest`);
    if (!response.ok) throw new Error('Failed to fetch health data');
    return response.json();
  }

  /**
   * Fetch health history from BigQuery
   */
  async fetchHealthHistory(days = 30) {
    const response = await fetch(`${CONFIG.API_URL}/api/health/history?days=${days}`);
    if (!response.ok) throw new Error('Failed to fetch health history');
    return response.json();
  }

  /**
   * Render health status table
   */
  renderHealthTable(data) {
    if (!data || data.length === 0) {
      document.getElementById('healthTableBody').innerHTML = `
        <tr>
          <td colspan="6" class="text-center">Aucune donnée disponible</td>
        </tr>
      `;
      return;
    }

    // Update last check timestamp
    const latestTimestamp = data[0].check_timestamp;
    document.getElementById('healthLastCheck').textContent =
      new Date(latestTimestamp).toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

    // Render rows
    const tbody = document.getElementById('healthTableBody');
    tbody.innerHTML = data.map(source => {
      const statusClass = source.status.toLowerCase();
      const statusEmoji = this.getStatusEmoji(source.status);
      const latestDate = source.latest_data_date
        ? new Date(source.latest_data_date).toLocaleDateString('fr-FR')
        : 'N/A';

      const lagText = source.days_lag === 1 ? '1 jour' : `${source.days_lag} jours`;

      return `
        <tr>
          <td><strong>${source.source_name}</strong></td>
          <td class="text-center">
            <span class="status-badge status-${statusClass}">
              ${statusEmoji} ${source.status}
            </span>
          </td>
          <td class="text-right">${latestDate}</td>
          <td class="text-right">${lagText}</td>
          <td class="text-right">${source.row_count_last_7d.toLocaleString('fr-FR')}</td>
          <td>
            ${source.alert_reason
              ? `<span class="issue-text">${source.alert_reason}</span>`
              : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Get emoji for status
   */
  getStatusEmoji(status) {
    switch (status) {
      case 'OK': return '✅';
      case 'WARNING': return '⚠️';
      case 'CRITICAL': return '🔴';
      default: return '❓';
    }
  }

  /**
   * Render health timeline chart
   */
  renderHealthTimeline(historicalData) {
    // Destroy existing chart
    if (this.timelineChart) {
      this.timelineChart.destroy();
    }

    const ctx = document.getElementById('healthTimelineChart');
    if (!ctx) return;

    // Group data by date and source
    const sources = [...new Set(historicalData.map(d => d.source_name))];
    const dates = [...new Set(historicalData.map(d => d.check_timestamp.split('T')[0]))].sort();

    // Create datasets (one per source)
    const datasets = sources.map((source, idx) => {
      const sourceData = historicalData.filter(d => d.source_name === source);

      // Map status to numeric value for visualization
      const data = dates.map(date => {
        const entry = sourceData.find(d => d.check_timestamp.startsWith(date));
        if (!entry) return null;

        // OK = 1, WARNING = 0.5, CRITICAL = 0
        switch (entry.status) {
          case 'OK': return 1;
          case 'WARNING': return 0.5;
          case 'CRITICAL': return 0;
          default: return null;
        }
      });

      return {
        label: source,
        data: data,
        borderColor: CONFIG.COLORS.CHART_PALETTE[idx % CONFIG.COLORS.CHART_PALETTE.length],
        backgroundColor: CONFIG.COLORS.CHART_PALETTE[idx % CONFIG.COLORS.CHART_PALETTE.length] + '20',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        stepped: true
      };
    });

    this.timelineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates.map(d => new Date(d).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })),
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
            callbacks: {
              label: (ctx) => {
                const source = ctx.dataset.label;
                const value = ctx.raw;
                let status = 'N/A';
                if (value === 1) status = 'OK ✅';
                else if (value === 0.5) status = 'WARNING ⚠️';
                else if (value === 0) status = 'CRITICAL 🔴';
                return `${source}: ${status}`;
              }
            }
          },
          datalabels: { display: false }
        },
        scales: {
          y: {
            min: 0,
            max: 1,
            ticks: {
              callback: (value) => {
                if (value === 1) return 'OK';
                if (value === 0.5) return 'WARNING';
                if (value === 0) return 'CRITICAL';
                return '';
              }
            }
          }
        }
      }
    });
  }
}

// Create global health manager instance
window.healthManager = new HealthManager();
