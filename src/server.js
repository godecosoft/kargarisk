/**
 * Express API Server
 * Dashboard için BC API proxy
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcClient = require('./services/bcClient');
const tokenService = require('./services/tokenService');
const logger = require('./utils/logger');
const db = require('./db/mysql');
const decisionService = require('./services/decisionService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files (production)
app.use(express.static(path.join(__dirname, '../dashboard/dist')));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

/**
 * GET /api/health
 * Sağlık kontrolü
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /api/token/status
 * Token durumu kontrolü
 */
app.get('/api/token/status', async (req, res) => {
    try {
        const token = await tokenService.getToken();
        const isValid = await tokenService.testToken(token);
        res.json({
            hasToken: !!token,
            isValid,
            tokenPreview: token ? token.substring(0, 20) + '...' : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/withdrawals
 * Çekim taleplerini getir
 */
app.post('/api/withdrawals', async (req, res) => {
    try {
        const filters = req.body || {};
        const data = await bcClient.getWithdrawalRequests(filters);

        // İstatistikleri hesapla (State: 0=Yeni, 2=Beklemede, 3=Ödendi, -2=Reddedildi, -1=İptal)
        const requests = data.ClientRequests || [];
        const stats = {
            total: requests.length,
            new: requests.filter(r => r.State === 0).length,
            pending: requests.filter(r => r.State === 2).length,
            paid: requests.filter(r => r.State === 3).length,
            rejected: requests.filter(r => r.State === -2).length,
            cancelled: requests.filter(r => r.State === -1).length,
            totalAmount: requests.reduce((sum, r) => sum + (r.Amount || 0), 0),
            pendingAmount: requests.filter(r => r.State === 0 || r.State === 2).reduce((sum, r) => sum + (r.Amount || 0), 0)
        };

        res.json({
            success: true,
            data: {
                requests,
                stats,
                totals: data.Totals || null
            }
        });

    } catch (error) {
        logger.error('Withdrawals API Error', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/withdrawals/pending
 * Sadece bekleyen çekim taleplerini getir
 */
app.get('/api/withdrawals/pending', async (req, res) => {
    try {
        const data = await bcClient.getWithdrawalRequests({ stateList: [1] });
        res.json({
            success: true,
            data: data.ClientRequests || []
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/withdrawals/new
 * Sadece Yeni (State=0) çekim taleplerini getir
 */
app.get('/api/withdrawals/new', async (req, res) => {
    try {
        const data = await bcClient.getWithdrawalRequests({ stateList: [0] });
        const requests = (data.ClientRequests || [])
            .sort((a, b) => new Date(a.RequestTimeLocal) - new Date(b.RequestTimeLocal));
        res.json({
            success: true,
            data: requests,
            count: requests.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/client/:clientId/turnover
 * Oyuncu çevrim raporu
 */
app.get('/api/client/:clientId/turnover', async (req, res) => {
    try {
        const turnoverService = require('./services/turnoverService');
        const clientId = parseInt(req.params.clientId);
        const multiplier = parseFloat(req.query.multiplier) || 1;

        const report = await turnoverService.getTurnoverReport(clientId, multiplier);
        res.json(report);
    } catch (error) {
        logger.error('Turnover API Error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/client/:clientId/bonuses
 * Oyuncu son 5 bonusu
 */
app.get('/api/client/:clientId/bonuses', async (req, res) => {
    try {
        const bonusService = require('./services/bonusService');
        const clientId = parseInt(req.params.clientId);
        const count = parseInt(req.query.count) || 5;

        const bonuses = await bonusService.getLastBonuses(clientId, count);
        res.json({ success: true, data: bonuses });
    } catch (error) {
        logger.error('Bonuses API Error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/client/:clientId/sports
 * Oyuncu spor bahisleri raporu
 */
app.get('/api/client/:clientId/sports', async (req, res) => {
    try {
        const sportsService = require('./services/sportsService');
        const turnoverService = require('./services/turnoverService');
        const clientId = parseInt(req.params.clientId);

        // Önce yatırım zamanını al
        const transactions = await turnoverService.getClientTransactions(clientId, 2);
        const deposit = turnoverService.findLastDeposit(transactions);

        if (!deposit) {
            return res.json({ success: false, error: 'Yatırım bulunamadı', bets: [] });
        }

        const report = await sportsService.getSportsReport(clientId, deposit.CreatedLocal);
        res.json(report);
    } catch (error) {
        logger.error('Sports API Error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/client/:clientId/ip-analysis
 * IP bazlı çoklu hesap kontrolü
 */
app.get('/api/client/:clientId/ip-analysis', async (req, res) => {
    try {
        const ipControlService = require('./services/ipControlService');
        const clientId = parseInt(req.params.clientId);
        const days = parseInt(req.query.days) || 7;

        const analysis = await ipControlService.getIPAnalysis(clientId, days);
        res.json(analysis);
    } catch (error) {
        logger.error('IP Analysis API Error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/client/:clientId/bonus-transactions
 * Son yatırımdan sonraki FreeSpin ve Bonus işlemleri
 */
app.get('/api/client/:clientId/bonus-transactions', async (req, res) => {
    try {
        const turnoverService = require('./services/turnoverService');
        const clientId = parseInt(req.params.clientId);

        // Get transactions (2 months)
        const transactions = await turnoverService.getClientTransactions(clientId, 2);

        // Find last deposit
        const deposit = turnoverService.findLastDeposit(transactions);
        const depositTime = deposit ? new Date(deposit.CreatedLocal) : new Date(0);

        // Filter FreeSpin (DocType=15, Game contains FreeSpin) and Pay Client Bonus (DocType=83)
        const bonusTransactions = transactions.filter(tx => {
            const txTime = new Date(tx.CreatedLocal);
            if (txTime <= depositTime) return false;

            // FreeSpin
            if (tx.DocumentTypeId === 15 && tx.Game?.toLowerCase().includes('freespin')) {
                return true;
            }
            // Pay Client Bonus
            if (tx.DocumentTypeId === 83) {
                return true;
            }
            return false;
        }).map(tx => ({
            type: tx.DocumentTypeId === 83 ? 'BONUS' : 'FREESPIN',
            game: tx.Game,
            amount: tx.Amount,
            balance: tx.Balance,
            time: tx.CreatedLocal,
            balanceBefore: tx.Balance - tx.Amount
        }));

        res.json({
            success: true,
            depositTime: deposit?.CreatedLocal,
            data: bonusTransactions
        });
    } catch (error) {
        logger.error('Bonus Transactions API Error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/decisions/batch
 * Get decisions for multiple withdrawals (batch)
 */
app.post('/api/decisions/batch', async (req, res) => {
    try {
        const { withdrawals } = req.body;

        if (!withdrawals || !Array.isArray(withdrawals)) {
            return res.status(400).json({ success: false, error: 'withdrawals array required' });
        }

        const decisions = await decisionService.getDecisionsBatch(withdrawals);
        res.json({ success: true, decisions });
    } catch (error) {
        logger.error('Decisions batch error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/decisions/:withdrawalId
 * Get single withdrawal decision
 */
app.get('/api/decisions/:withdrawalId', async (req, res) => {
    try {
        const { withdrawalId } = req.params;
        const { clientId } = req.query;

        if (!clientId) {
            return res.status(400).json({ success: false, error: 'clientId query param required' });
        }

        const decision = await decisionService.getDecision(parseInt(withdrawalId), parseInt(clientId));
        res.json({ success: true, ...decision });
    } catch (error) {
        logger.error('Decision get error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/reports/stats
 * Get comprehensive reports and conflict analysis
 */
app.get('/api/reports/stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const reportsService = require('./services/reportsService');

        const stats = await reportsService.getStats(startDate, endDate);
        res.json({ success: true, stats });
    } catch (error) {
        logger.error('Reports Stats Error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/rules
 * Tüm kuralları getir
 */
app.get('/api/rules', async (req, res) => {
    try {
        const rulesService = require('./services/rulesService');
        const rules = await rulesService.getAllRules();
        res.json({ success: true, rules });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/rules
 * Kural güncelle
 */
app.post('/api/rules', async (req, res) => {
    try {
        const rulesService = require('./services/rulesService');
        const { key, value, description } = req.body;

        if (!key) return res.status(400).json({ error: 'Key required' });

        await rulesService.setRule(key, value, description);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// SPA fallback - serve index.html for non-API routes
app.use((req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Not found' });
    }
    // Serve index.html for all other GET requests
    if (req.method === 'GET') {
        return res.sendFile(path.join(__dirname, '../dashboard/dist/index.html'));
    }
    next();
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled Error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal Server Error' });
});

// Server başlat
async function startServer() {
    try {
        // Önce token al
        logger.info('Token alınıyor...');
        await tokenService.getToken();
        logger.info('Token hazır');

        // Database başlat
        logger.info('Database bağlantısı kuruluyor...');
        await db.initDatabase();

        // Server'ı başlat
        app.listen(PORT, () => {
            logger.info(`API Server running on http://localhost:${PORT}`);
        });

    } catch (error) {
        logger.error('Server startup failed', { error: error.message });
        process.exit(1);
    }
}

startServer();
