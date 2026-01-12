/**
 * AI Reports Manager
 * Gère l'interface de chat avec Claude pour générer des rapports
 */

class AIReportsManager {
    constructor() {
        this.conversationHistory = [];
        this.currentConversationId = null;
        this.isLoading = false;
    }

    async init() {
        console.log('[AI Reports] Initializing...');
        this.attachEventListeners();
        this.loadConversationHistory();
    }

    attachEventListeners() {
        const sendBtn = document.getElementById('aiSendMessage');
        const input = document.getElementById('aiMessageInput');

        if (!sendBtn || !input) {
            console.error('[AI Reports] Required elements not found');
            return;
        }

        sendBtn.addEventListener('click', () => this.sendMessage());

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    async sendMessage() {
        const input = document.getElementById('aiMessageInput');
        const message = input.value.trim();

        if (!message || this.isLoading) return;

        // Afficher message utilisateur
        this.addMessageToChat('user', message);
        input.value = '';
        this.isLoading = true;

        // Désactiver l'input pendant le chargement
        input.disabled = true;
        document.getElementById('aiSendMessage').disabled = true;

        try {
            // Appel API
            const response = await fetch(`${window.CONFIG.API_URL}/api/ai-reports/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    conversation_id: this.currentConversationId,
                    history: this.conversationHistory
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'API error');
            }

            const data = await response.json();

            // Afficher réponse assistant
            this.addMessageToChat('assistant', data.response, data.sql_executed, data.conversation_id);

            // Mettre à jour l'historique
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: data.response }
            );

            this.currentConversationId = data.conversation_id;

        } catch (error) {
            console.error('[AI Reports] Error:', error);
            this.addMessageToChat('error', `Erreur: ${error.message}`);
        } finally {
            this.isLoading = false;
            input.disabled = false;
            document.getElementById('aiSendMessage').disabled = false;
            input.focus();
        }
    }

    addMessageToChat(role, content, sqlQuery = null, conversationId = null) {
        const chatContainer = document.getElementById('aiChatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ai-message-${role}`;

        if (role === 'user') {
            messageDiv.innerHTML = `
                <div class="ai-message-content">${this.escapeHtml(content)}</div>
            `;
        } else if (role === 'assistant') {
            const formattedContent = this.renderMarkdown(content);
            let sqlSection = '';
            let downloadSection = '';

            if (sqlQuery) {
                sqlSection = `
                    <details class="ai-sql-details">
                        <summary>🔍 Requête SQL exécutée</summary>
                        <pre><code>${this.escapeHtml(sqlQuery)}</code></pre>
                    </details>
                `;
            }

            if (conversationId) {
                downloadSection = `
                    <div class="ai-download-section">
                        <button class="ai-download-btn" onclick="aiReportsManager.downloadHTML('${conversationId}', \`${this.escapeHtml(content)}\`)">
                            📥 Télécharger le rapport HTML
                        </button>
                    </div>
                `;
            }

            messageDiv.innerHTML = `
                <div class="ai-message-content">${formattedContent}</div>
                ${sqlSection}
                ${downloadSection}
            `;
        } else if (role === 'error') {
            messageDiv.innerHTML = `
                <div class="ai-message-content ai-error">${this.escapeHtml(content)}</div>
            `;
        }

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    renderMarkdown(text) {
        // Simple markdown renderer (bold, italic, code blocks, lists)
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '<br><br>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadConversationHistory() {
        // Optionnel: charger les conversations précédentes
        try {
            const response = await fetch(`${window.CONFIG.API_URL}/api/ai-reports/history`);
            if (!response.ok) return;

            const data = await response.json();
            console.log('[AI Reports] Conversation history loaded:', data.length);
            // TODO: Afficher liste des conversations passées dans sidebar
        } catch (error) {
            console.error('[AI Reports] Failed to load history:', error);
        }
    }

    async downloadHTML(conversationId, reportContent) {
        try {
            // Extract client name and period from report content
            const clientMatch = reportContent.match(/(?:pour|de|du client)\s+([A-Za-zÀ-ÿ\s&]+?)(?:\s+en|\s+sur|\s+du|\s+à|$)/i);
            const periodMatch = reportContent.match(/(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);

            const clientName = clientMatch ? clientMatch[1].trim() : 'Client';
            const period = periodMatch ? `${periodMatch[1]} ${periodMatch[2]}` : new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

            // Convert client name to ID (lowercase, no spaces)
            const clientId = clientName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

            const response = await fetch(`${window.CONFIG.API_URL}/api/ai-reports/export-html`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: conversationId,
                    client_name: clientName,
                    client_id: clientId,
                    period: period,
                    report_content: reportContent
                })
            });

            if (!response.ok) throw new Error('Export failed');

            const data = await response.json();

            // Télécharger HTML
            const blob = new Blob([data.html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename;
            a.click();
            URL.revokeObjectURL(url);

            console.log('[AI Reports] Rapport téléchargé:', data.filename);
        } catch (error) {
            console.error('[AI Reports] Download error:', error);
            this.addMessageToChat('error', 'Erreur lors du téléchargement du rapport');
        }
    }

    async shareReport(conversationId, htmlContent) {
        try {
            const response = await fetch(`${window.CONFIG.API_URL}/api/ai-reports/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: conversationId,
                    html: htmlContent
                })
            });

            if (!response.ok) throw new Error('Share failed');

            const data = await response.json();

            // Afficher modal avec lien
            this.showShareModal(data.share_url, data.expires_at);
        } catch (error) {
            console.error('[AI Reports] Share error:', error);
            this.addMessageToChat('error', 'Erreur lors du partage du rapport');
        }
    }

    showShareModal(shareUrl, expiresAt) {
        const modal = document.createElement('div');
        modal.className = 'ai-share-modal';
        modal.innerHTML = `
            <div class="ai-share-modal-content">
                <h3>🔗 Lien de partage généré</h3>
                <p>Ce lien public expire le ${expiresAt}</p>
                <div class="ai-share-url">
                    <input type="text" value="${shareUrl}" readonly id="aiShareUrlInput">
                    <button onclick="document.getElementById('aiShareUrlInput').select(); document.execCommand('copy'); this.textContent='Copié!'">
                        Copier
                    </button>
                </div>
                <button class="ai-modal-close" onclick="this.closest('.ai-share-modal').remove()">
                    Fermer
                </button>
            </div>
        `;
        document.body.appendChild(modal);

        // Fermer au clic en dehors
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}

// Initialize when tab becomes active
let aiReportsManager = null;

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab') && e.target.dataset.tab === 'ai-reports') {
        if (!aiReportsManager) {
            aiReportsManager = new AIReportsManager();
            setTimeout(() => {
                aiReportsManager.init();
            }, 100);
        }
    }
});
