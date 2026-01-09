/**
 * Sports Service
 * Spor bahisleri ve kupon detayları
 */

const bcClient = require('./bcClient');
const logger = require('../utils/logger');

/**
 * Tarih formatla (BC API formatı: DD-MM-YY - HH:mm:ss)
 */
function formatDateTime(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy} - 00:00:00`;
}

/**
 * Bir sonraki günün tarihini al
 */
function getNextDay(date) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    return next;
}

/**
 * Bahis geçmişini getir - Created (oluşturulma tarihi)
 */
async function getBetHistoryByCreated(clientId, startDate, endDate) {
    const payload = {
        State: null,
        SkeepRows: 0,
        MaxRows: 50,
        IsLive: null,
        StartDateLocal: formatDateTime(startDate),
        EndDateLocal: formatDateTime(endDate),
        CalcStartDateLocal: null,
        CalcEndDateLocal: null,
        ClientId: clientId,
        CurrencyId: 'TRY',
        IsBonusBet: null,
        BetId: null,
        ToCurrencyId: 'TRY'
    };

    logger.info('Fetching bet history (Created)', { clientId, startDate, endDate });

    const response = await bcClient.post('/Report/GetBetHistory', payload);
    return response.Data?.BetData?.Objects || [];
}

/**
 * Bahis geçmişini getir - Calculation (sonuçlanma tarihi)
 */
async function getBetHistoryByCalc(clientId, startDate, endDate) {
    const payload = {
        State: null,
        SkeepRows: 0,
        MaxRows: 50,
        IsLive: null,
        StartDateLocal: null,
        EndDateLocal: null,
        CalcStartDateLocal: formatDateTime(startDate),
        CalcEndDateLocal: formatDateTime(endDate),
        ClientId: clientId,
        CurrencyId: 'TRY',
        IsBonusBet: null,
        BetId: null,
        ToCurrencyId: 'TRY'
    };

    logger.info('Fetching bet history (Calculation)', { clientId, startDate, endDate });

    const response = await bcClient.post('/Report/GetBetHistory', payload);
    return response.Data?.BetData?.Objects || [];
}

/**
 * Kupon detaylarını getir
 */
async function getBetSelections(betId, betType = 1) {
    const payload = {
        BetId: betId,
        Type: betType
    };

    logger.info('Fetching bet selections', { betId });

    const response = await bcClient.post('/Sport/GetBetSelections', payload);
    return response.Data || [];
}

/**
 * Kupon durumunu Türkçe'ye çevir
 */
function getBetStateName(state) {
    const states = {
        1: 'Beklemede',
        2: 'Kaybetti',
        3: 'İade',
        4: 'Kazandı',
        5: 'Cashout',
        6: 'İptal'
    };
    return states[state] || 'Bilinmiyor';
}

/**
 * Tam spor raporu al
 * @param {number} clientId 
 * @param {Date} depositTime - Son yatırım zamanı
 */
async function getSportsReport(clientId, depositTime) {
    try {
        const depositDate = new Date(depositTime);
        const endDate = getNextDay(new Date());

        // Her iki sorguyu paralel yap
        const [createdBets, calcBets] = await Promise.all([
            getBetHistoryByCreated(clientId, depositDate, endDate),
            getBetHistoryByCalc(clientId, depositDate, endDate)
        ]);

        // Pre-deposit kazanç kontrolü
        // Calculation sorgusunda, yatırımdan önce oluşturulup kazanç > 0 olan kupon var mı?
        let hasPreDepositWinning = false;
        let preDepositWinningBet = null;

        for (const bet of calcBets) {
            const betCreatedTime = new Date(bet.CreatedLocal);
            if (betCreatedTime < depositDate && bet.WinningAmount > 0) {
                hasPreDepositWinning = true;
                preDepositWinningBet = bet;
                break;
            }
        }

        // Toplam bahis ve kazanç
        const totalBetAmount = createdBets.reduce((sum, b) => sum + (b.Amount || 0), 0);
        const totalWinningAmount = calcBets.reduce((sum, b) => sum + (b.WinningAmount || 0), 0);

        // Kupon detaylarını al (sadece created bets için, max 10)
        const betsWithSelections = [];
        const betsToFetch = createdBets.slice(0, 10);

        for (const bet of betsToFetch) {
            try {
                const selections = await getBetSelections(bet.Id, bet.Type);
                betsWithSelections.push({
                    id: bet.Id,
                    amount: bet.Amount,
                    odds: bet.Price,
                    state: bet.State,
                    stateName: getBetStateName(bet.State),
                    winningAmount: bet.WinningAmount,
                    possibleWin: bet.PossibleWin,
                    type: bet.TypeName,
                    isLive: bet.IsLive,
                    createdAt: bet.CreatedLocal,
                    calcAt: bet.CalcDateLocal,
                    isCashout: bet.State === 5,
                    selections: selections.map(s => ({
                        matchName: s.MatchName,
                        competitionName: s.CompetitionName,
                        sportName: s.SportName,
                        selectionName: s.DisplaySelectionName,
                        marketName: s.DisplayMarketName,
                        odds: s.Price,
                        state: s.State,
                        stateName: getBetStateName(s.State),
                        matchResult: s.MatchResult,
                        startTime: s.StartTimeLocal
                    }))
                });
            } catch (err) {
                logger.warn('Failed to fetch selections for bet', { betId: bet.Id, error: err.message });
                betsWithSelections.push({
                    id: bet.Id,
                    amount: bet.Amount,
                    odds: bet.Price,
                    state: bet.State,
                    stateName: getBetStateName(bet.State),
                    winningAmount: bet.WinningAmount,
                    selections: []
                });
            }
        }

        return {
            success: true,
            totalBets: createdBets.length,
            totalBetAmount,
            totalWinningAmount,
            hasPreDepositWinning,
            preDepositWinningBet: preDepositWinningBet ? {
                id: preDepositWinningBet.Id,
                amount: preDepositWinningBet.Amount,
                winningAmount: preDepositWinningBet.WinningAmount,
                createdAt: preDepositWinningBet.CreatedLocal
            } : null,
            bets: betsWithSelections
        };

    } catch (error) {
        logger.error('Sports report error', { clientId, error: error.message });
        return {
            success: false,
            error: error.message,
            bets: []
        };
    }
}

module.exports = {
    getBetHistoryByCreated,
    getBetHistoryByCalc,
    getBetSelections,
    getSportsReport
};
