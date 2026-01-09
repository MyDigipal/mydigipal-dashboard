// MyDigipal Dashboard - Export Module (Phase 3.1)
// Handles CSV and PDF export functionality

class ExportManager {
  /**
   * Export data to CSV
   * @param {Array} data - Array of objects to export
   * @param {string} filename - Output filename
   */
  exportToCSV(data, filename = 'export.csv') {
    if (!data || data.length === 0) {
      window.toastManager.warning('Aucune donnée à exporter');
      return;
    }

    try {
      // Get headers from first object
      const headers = Object.keys(data[0]);

      // Create CSV content
      const csv = [
        headers.join(','), // Header row
        ...data.map(row =>
          headers.map(header => {
            const value = row[header];
            // Handle values with commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
          }).join(',')
        )
      ].join('\n');

      // Create blob and download
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.toastManager.success('Export CSV réussi');
    } catch (error) {
      console.error('CSV export error:', error);
      window.toastManager.error('Erreur lors de l\'export CSV');
    }
  }

  /**
   * Export current dashboard view to PDF
   * Note: Requires html2pdf.js library loaded via CDN
   */
  exportToPDF() {
    if (typeof html2pdf === 'undefined') {
      window.toastManager.error('Librairie PDF non chargée');
      return;
    }

    try {
      const element = document.getElementById('dashboard');
      const opt = {
        margin: 10,
        filename: `mydigipal-dashboard-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      window.toastManager.success('Génération du PDF en cours...');
      html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('PDF export error:', error);
      window.toastManager.error('Erreur lors de l\'export PDF');
    }
  }

  /**
   * Export specific table to CSV
   * @param {string} tableId - ID of the table element
   * @param {string} filename - Output filename
   */
  exportTableToCSV(tableId, filename = 'table.csv') {
    const table = document.getElementById(tableId);
    if (!table) {
      window.toastManager.warning('Table introuvable');
      return;
    }

    try {
      const rows = Array.from(table.querySelectorAll('tr'));
      const csv = rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map(cell => {
          const text = cell.textContent.trim();
          if (text.includes(',') || text.includes('"')) {
            return `"${text.replace(/"/g, '""')}"`;
          }
          return text;
        }).join(',');
      }).join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.toastManager.success('Export CSV réussi');
    } catch (error) {
      console.error('Table CSV export error:', error);
      window.toastManager.error('Erreur lors de l\'export CSV');
    }
  }
}

// Create global export manager instance
window.exportManager = new ExportManager();
