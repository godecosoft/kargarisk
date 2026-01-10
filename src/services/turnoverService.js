/**
 * Turnover Service
 * Çevrim hesaplama servisi
 */

const bcClient = require('./bcClient');
const logger = require('../utils/logger');

/**
 * Tarih formatla (BC API formatı: DD-MM-YY)
 */
function formatDate(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
}

/**
 * Oyuncu işlemlerini getir
 */
async function getClientTransactions(clientId, days = 2) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const payload = {
        StartTimeLocal: formatDate(startDate),
        EndTimeLocal: formatDate(endDate),
        ClientId: clientId,
        CurrencyId: 'TRY',
        SkeepRows: 0,
        MaxRows: 500,
        PaymentSystemId: null,
        GameId: null,
        DocumentTypeIds: [],
        ByPassTotals: false
    };

    logger.info('Fetching client transactions', { clientId, days });

    const response = await bcClient.post('/Client/GetClientTransactionsV1', payload);
    return response.Data?.Objects || [];
}

/**
 * Son yatırımı bul (DocumentTypeId: 3)
 */
function findLastDeposit(transactions) {
    const deposits = transactions
        .filter(t => t.DocumentTypeId === 3)
        // STRICT FILTER: Exclude anything that mentions FreeSpin or Bonus in Game, PaymentSystem, or Notes
        .filter(t => {
            const game = t.Game?.toLowerCase() || '';
            const payment = t.PaymentSystemName?.toLowerCase() || '';
            const notes = t.Notes?.toLowerCase() || '';

            // Check for FreeSpin or Bonus keywords
            if (game.includes('freespin') || game.includes('bonus') || game.includes('deneme')) return false;
            if (payment.includes('freespin') || payment.includes('bonus') || payment.includes('deneme')) return false;
            if (notes.includes('freespin') || notes.includes('bonus') || notes.includes('deneme')) return false;

            return true;
        })
        .sort((a, b) => new Date(b.CreatedLocal) - new Date(a.CreatedLocal));

    if (deposits.length > 0) {
        logger.info('Found last deposit', {
            amount: deposits[0].Amount,
            time: deposits[0].CreatedLocal,
            game: deposits[0].Game,
            payment: deposits[0].PaymentSystemName
        });
    }

    return deposits[0] || null;
}

/**
 * Cashout edilen bahis ID'lerini bul (DocumentTypeId: 14)
 */
function getCashoutBetIds(transactions) {
    return new Set(
        transactions
            .filter(t => t.DocumentTypeId === 14 && t.BetId)
            .map(t => t.BetId)
    );
}

/**
 * Çevrim hesapla
 * @param {Array} transactions - İşlem listesi
 * @param {Date} afterTime - Bu tarihten sonraki işlemler
 * @param {number} multiplier - Çevrim katı (varsayılan 1)
 * @returns {Object} - Casino ve Spor çevrim bilgisi
 */
function calculateTurnover(transactions, afterTime, requiredAmount, multiplier = 1) {
    // Cashout edilen bahisleri hariç tut
    const cashoutBetIds = getCashoutBetIds(transactions);

    // Yatırım sonrası bahisleri filtrele (DocumentTypeId: 10)
    const bets = transactions.filter(t => {
        // Sadece bahisler
        if (t.DocumentTypeId !== 10) return false;

        // Yatırım sonrası
        if (new Date(t.CreatedLocal) < afterTime) return false;

        // Cashout edilmiş bahisleri hariç tut
        if (t.BetId && cashoutBetIds.has(t.BetId)) return false;

        return true;
    });

    // Kazançları filtrele (DocumentTypeId: 15)
    const wins = transactions.filter(t => {
        if (t.DocumentTypeId !== 15) return false;
        if (new Date(t.CreatedLocal) < afterTime) return false;
        return true;
    });

    // Oyun bazlı grupla
    const casinoGames = {};
    const casinoWins = {};
    let sportsTurnover = 0;
    let sportsWins = 0;

    // Bahisleri grupla
    bets.forEach(bet => {
        const amount = bet.Amount || 0;
        if (bet.Game === 'SportsBook') {
            sportsTurnover += amount;
        } else {
            const gameName = bet.Game || 'Bilinmeyen';
            casinoGames[gameName] = (casinoGames[gameName] || 0) + amount;
        }
    });

    // Kazançları grupla
    wins.forEach(win => {
        const amount = win.Amount || 0;
        if (win.Game === 'SportsBook') {
            sportsWins += amount;
        } else {
            const gameName = win.Game || 'Bilinmeyen';
            casinoWins[gameName] = (casinoWins[gameName] || 0) + amount;
        }
    });

    // Casino toplam
    const casinoTurnover = Object.values(casinoGames).reduce((a, b) => a + b, 0);
    const totalCasinoWins = Object.values(casinoWins).reduce((a, b) => a + b, 0);

    const requiredTurnover = requiredAmount * multiplier;
    const totalTurnover = casinoTurnover + sportsTurnover;

    // Oyun dökümü oluştur (en çok oynanan önce)
    const gameBreakdown = Object.entries(casinoGames)
        .map(([game, betAmount]) => ({
            game,
            betAmount,
            winAmount: casinoWins[game] || 0
        }))
        .sort((a, b) => b.betAmount - a.betAmount);

    return {
        casino: {
            amount: casinoTurnover,
            percentage: requiredTurnover > 0 ? Math.round((casinoTurnover / requiredTurnover) * 100) : 0,
            winAmount: totalCasinoWins,
            games: gameBreakdown
        },
        sports: {
            amount: sportsTurnover,
            percentage: requiredTurnover > 0 ? Math.round((sportsTurnover / requiredTurnover) * 100) : 0,
            winAmount: sportsWins
        },
        total: {
            amount: totalTurnover,
            percentage: requiredTurnover > 0 ? Math.round((totalTurnover / requiredTurnover) * 100) : 0
        },
        required: requiredTurnover,
        isComplete: totalTurnover >= requiredTurnover
    };
}

const rulesService = require('./rulesService');
const txAnalysis = require('./transactionAnalysisService');

/**
 * Tam çevrim raporu al
 * @param {number} clientId - Client ID
 * @param {number} multiplier - Çevrim katı
 * @param {number} withdrawalAmount - Çekim tutarı (withdrawal type detection için)
 * @param {number} currentBalance - Mevcut bakiye (cashback kontrolü için)
 */
async function getTurnoverReport(clientId, multiplier = null, withdrawalAmount = null, currentBalance = null) {
    try {
        // Get multiplier from rules if not provided
        if (multiplier === null) {
            multiplier = await rulesService.getRule('turnover_multiplier', 1);
            // Ensure it's a number (in case stored as string)
            multiplier = parseFloat(multiplier);
        }
        // Son 2 günlük işlemleri al
        const transactions = await getClientTransactions(clientId, 2);

        if (transactions.length === 0) {
            logger.warn('No transactions found', { clientId });
            return {
                success: false,
                error: 'İşlem bulunamadı',
                deposit: null,
                turnover: null,
                withdrawalType: null
            };
        }

        // Analyze withdrawal type (Cashback/FreeSpin/Bonus/Deposit)
        const withdrawalType = txAnalysis.analyzeWithdrawalType(
            transactions,
            withdrawalAmount || 0,
            currentBalance || 0
        );

        logger.info('Withdrawal type analysis', { clientId, type: withdrawalType.type });

        // Handle Cashback withdrawals - no turnover required
        if (withdrawalType.type === 'CASHBACK') {
            return {
                success: true,
                withdrawalType,
                deposit: null,
                turnover: {
                    isComplete: true,
                    required: 0,
                    total: { amount: 0, percentage: 100 }
                },
                decision: withdrawalType.decision || 'MANUEL',
                decisionReason: withdrawalType.reason || 'Cashback çekimi',
                multiplier,
                skipTurnover: true
            };
        }

        // For FreeSpin/Bonus/Deposit - find reference point
        let referenceTime;
        let requiredAmount;

        if (withdrawalType.type === 'FREESPIN' || withdrawalType.type === 'BONUS') {
            // Use freespin/bonus time as reference
            referenceTime = new Date(withdrawalType.time);
            requiredAmount = withdrawalType.amount;
            logger.info('Using FreeSpin/Bonus as reference', { type: withdrawalType.type, time: withdrawalType.time });
        } else {
            // Standard deposit-based turnover
            const lastDeposit = findLastDeposit(transactions);

            if (!lastDeposit) {
                logger.warn('No deposit found', { clientId });
                return {
                    success: false,
                    error: 'Yatırım bulunamadı',
                    deposit: null,
                    turnover: null,
                    withdrawalType
                };
            }

            referenceTime = new Date(lastDeposit.CreatedLocal);
            requiredAmount = lastDeposit.Amount;

            // Store deposit info for response
            withdrawalType.deposit = {
                amount: lastDeposit.Amount,
                time: lastDeposit.CreatedLocal,
                paymentSystem: lastDeposit.PaymentSystemName
            };
        }

        // Çevrimi hesapla
        const turnover = calculateTurnover(
            transactions,
            referenceTime,
            requiredAmount,
            multiplier
        );

        // Karar ver
        let decision = 'MANUEL';
        let decisionReason = '';

        if (turnover.isComplete) {
            decision = 'ONAY';
            decisionReason = `Çevrim tamamlandı (%${turnover.total.percentage})`;
        } else {
            decision = 'RET';
            decisionReason = `Çevrim eksik (%${turnover.total.percentage})`;
        }

        // Add withdrawal type context to reason
        if (withdrawalType.type === 'FREESPIN') {
            decisionReason = `[FreeSpin Çekimi] ${decisionReason}`;
        } else if (withdrawalType.type === 'BONUS') {
            decisionReason = `[Bonus Çekimi] ${decisionReason}`;
        }

        return {
            success: true,
            withdrawalType,
            deposit: withdrawalType.deposit || {
                amount: requiredAmount,
                time: referenceTime.toISOString(),
                paymentSystem: null
            },
            turnover,
            decision,
            decisionReason,
            multiplier
        };

    } catch (error) {
        logger.error('Turnover report error', { clientId, error: error.message });
        return {
            success: false,
            error: error.message,
            deposit: null,
            turnover: null,
            withdrawalType: null
        };
    }
}

/**
 * Get last deposit for a client (for cache validation)
 */
async function getLastDeposit(clientId) {
    try {
        const transactions = await getClientTransactions(clientId, 7);
        const deposit = findLastDeposit(transactions);
        if (!deposit) return null;

        return {
            amount: deposit.Amount,
            time: deposit.CreatedLocal
        };
    } catch (error) {
        logger.error('getLastDeposit error', { clientId, error: error.message });
        return null;
    }
}

module.exports = {
    getClientTransactions,
    findLastDeposit,
    calculateTurnover,
    getTurnoverReport,
    getLastDeposit
};
