const logger = require('../utils/logger');

/**
 * Risk Service
 * Analyzes player behavior for potential risks like Spin Hoarding
 */
const riskService = {

    /**
     * Check for Spin Hoarding (FreeSpin Gömme/Stoklama)
     * Logic: If there is a WIN amount but NO BET amount for a specific game in the current turnover period,
     * it implies the bet was placed in a previous session (e.g. while using a bonus) to hide the win.
     * 
     * @param {Object} snapshot - Withdrawal snapshot containing turnover data
     * @returns {Object} { hasRisk: boolean, riskLevel: 'LOW'|'MEDIUM'|'HIGH', details: string[] }
     */
    checkSpinHoarding(snapshot) {
        const result = {
            hasRisk: false,
            riskLevel: 'LOW',
            details: []
        };

        try {
            const casinoGames = snapshot?.turnover?.turnover?.casino?.games || [];

            if (!Array.isArray(casinoGames) || casinoGames.length === 0) {
                return result;
            }

            for (const game of casinoGames) {
                const bet = parseFloat(game.betAmount) || 0;
                const win = parseFloat(game.winAmount) || 0;
                const gameName = game.game || 'Bilinmeyen Oyun';

                // Condition for Hoarding: Significant Win with Zero Bet in current period
                if (bet === 0 && win > 0) {
                    result.hasRisk = true;
                    // If win is substantial (> 100 TL), mark as HIGH risk
                    if (win > 100) {
                        result.riskLevel = 'HIGH';
                        result.details.push(`Spin Gömme Şüphesi: ${gameName} oyununda güncel bahis yok (0 TL) ancak kazanç var (${win} TL)`);
                    } else {
                        // Small wins might be negligible or leftovers
                        result.riskLevel = result.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';
                        result.details.push(`Spin Gömme Şüphesi (Düşük): ${gameName} (Bet: 0, Win: ${win})`);
                    }
                }
            }

            return result;

        } catch (error) {
            logger.error('Error checking spin hoarding', { error: error.message });
            return { hasRisk: false, riskLevel: 'LOW', details: ['Risk analizi hatası'] };
        }
    },

    /**
     * Perform full risk analysis
     */
    analyzeRisk(withdrawal, snapshot) {
        const hoardingCheck = this.checkSpinHoarding(snapshot);

        return {
            hoarding: hoardingCheck,
            totalRiskLevel: hoardingCheck.riskLevel,
            isRisky: hoardingCheck.hasRisk
        };
    }
};

module.exports = riskService;
