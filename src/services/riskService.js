const logger = require('../utils/logger');

/**
 * Risk Service
 * Basit spin gömme tespiti - oyun bazlı bet/win kontrolü
 * 
 * Mantık: Bir oyunda win varsa, bet de olmalı
 * Eğer bet=0 ve win>0 ise → Spin gömme şüphesi
 */
const riskService = {

    /**
     * Anlık spin gömme kontrolü
     * @param {Object} snapshot - turnover verisi içeren snapshot
     * @returns {Object} { isRisky, riskLevel, suspiciousGames }
     */
    checkSpinHoarding(snapshot) {
        const result = {
            isRisky: false,
            riskLevel: 'LOW',
            suspiciousGames: [],
            details: []
        };

        try {
            const games = snapshot?.turnover?.turnover?.casino?.games || [];

            if (!Array.isArray(games) || games.length === 0) {
                return result;
            }

            // Basit kontrol: bet=0 ve win>0 olan oyunları bul
            for (const game of games) {
                const bet = parseFloat(game.betAmount) || 0;
                const win = parseFloat(game.winAmount) || 0;
                const gameName = game.game || 'Bilinmeyen Oyun';

                if (bet === 0 && win > 0) {
                    result.isRisky = true;
                    result.suspiciousGames.push({
                        game: gameName,
                        bet: 0,
                        win: win
                    });
                    result.details.push(`🚨 ${gameName}: Bahis ₺0, Kazanç ₺${win}`);

                    // Risk seviyesi
                    if (win > 100) {
                        result.riskLevel = 'HIGH';
                    } else if (result.riskLevel !== 'HIGH') {
                        result.riskLevel = 'MEDIUM';
                    }
                }
            }

            return result;

        } catch (error) {
            logger.error('Spin hoarding check error', { error: error.message });
            return result;
        }
    },

    /**
     * Risk analizi
     */
    analyzeRisk(withdrawal, snapshot) {
        const hoarding = this.checkSpinHoarding(snapshot);

        return {
            hoarding,
            isRisky: hoarding.isRisky,
            totalRiskLevel: hoarding.riskLevel,
            suspiciousWins: hoarding.suspiciousGames || []
        };
    }
};

module.exports = riskService;
