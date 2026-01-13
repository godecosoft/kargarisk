const logger = require('../utils/logger');

/**
 * Risk Service
 * Analyzes player behavior for potential risks like Spin Hoarding
 */
const riskService = {

    /**
     * Check for Spin Hoarding (FreeSpin Gömme/Stoklama) - TRANSACTION LEVEL
     * 
     * Mantık: Her kazanç (win) işleminden ÖNCE aynı oyunda en az bir bahis (bet) olmalı.
     * Eğer bir kazanç işlemi var ama o oyunda daha önce (yatırım sonrası) bahis yoksa → ŞÜPHELİ
     * 
     * Örnek Senaryo:
     * - 10:00 Yatırım
     * - 10:05 Sweet Bonanza WIN 500₺ → ŞÜPHELİ (öncesinde bet yok!)
     * - 10:10 Gates of Olympus BET 100₺ 
     * - 10:15 Gates of Olympus WIN 300₺ → Normal (öncesinde bet var)
     * 
     * Karmaşık Senaryo (spin açıp sonra biraz oynama):
     * - 10:00 Yatırım
     * - 10:02 Sweet Bonanza WIN 500₺ → ŞÜPHELİ (öncesinde bet yok!)
     * - 10:05 Sweet Bonanza BET 50₺
     * - 10:08 Sweet Bonanza WIN 60₺ → Normal (artık öncesinde bet var)
     * 
     * @param {Object} snapshot - Withdrawal snapshot containing turnover data
     * @returns {Object} { hasRisk: boolean, riskLevel: 'LOW'|'MEDIUM'|'HIGH', details: string[], suspiciousWins: array }
     */
    checkSpinHoarding(snapshot) {
        const result = {
            hasRisk: false,
            riskLevel: 'LOW',
            details: [],
            suspiciousWins: []
        };

        try {
            // Transaction bazlı veriler
            const transactions = snapshot?.turnover?.turnover?.casino?.transactions || [];

            if (!Array.isArray(transactions) || transactions.length === 0) {
                // Fallback: Eski toplam-bazlı kontrol (geriye uyumluluk)
                return this.checkSpinHoardingLegacy(snapshot);
            }

            // Her oyun için "ilk bahis zamanını" takip et
            const firstBetTimeByGame = {};
            const suspiciousWins = [];

            // Transaction'ları kronolojik sırayla işle
            for (const tx of transactions) {
                const game = tx.game;
                const time = tx.timestamp || new Date(tx.time).getTime();

                if (tx.type === 'bet') {
                    // Bu oyunda ilk bahis mi?
                    if (!firstBetTimeByGame[game]) {
                        firstBetTimeByGame[game] = time;
                    }
                } else if (tx.type === 'win') {
                    // Kazanç işlemi: Bu oyunda daha önce bahis var mı?
                    const firstBetTime = firstBetTimeByGame[game];

                    if (!firstBetTime || firstBetTime > time) {
                        // ŞÜPHELİ: Bu oyunda öncesinde bahis yok!
                        suspiciousWins.push({
                            game,
                            amount: tx.amount,
                            time: tx.time,
                            reason: 'Kazanç öncesinde bu oyunda bahis bulunamadı'
                        });
                    }
                }
            }

            // Şüpheli kazançları değerlendir
            if (suspiciousWins.length > 0) {
                result.hasRisk = true;
                result.suspiciousWins = suspiciousWins;

                // Toplam şüpheli kazanç
                const totalSuspiciousWin = suspiciousWins.reduce((sum, w) => sum + w.amount, 0);

                // Risk seviyesi belirle
                if (totalSuspiciousWin > 500) {
                    result.riskLevel = 'HIGH';
                } else if (totalSuspiciousWin > 100) {
                    result.riskLevel = 'MEDIUM';
                } else {
                    result.riskLevel = 'LOW';
                }

                // Her şüpheli kazanç için detay ekle
                for (const sw of suspiciousWins) {
                    result.details.push(
                        `🚨 Spin Gömme Şüphesi: ${sw.game} oyununda ₺${sw.amount} kazanç ancak öncesinde bahis yok!`
                    );
                }
            }

            return result;

        } catch (error) {
            logger.error('Error checking spin hoarding (transaction-level)', { error: error.message });
            return { hasRisk: false, riskLevel: 'LOW', details: ['Risk analizi hatası'], suspiciousWins: [] };
        }
    },

    /**
     * Legacy check - Toplam bazlı kontrol (geriye uyumluluk)
     * Eski snapshot'lar transaction verisi içermeyebilir
     */
    checkSpinHoardingLegacy(snapshot) {
        const result = {
            hasRisk: false,
            riskLevel: 'LOW',
            details: [],
            suspiciousWins: []
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

                // Koşul: Bahis 0 ama kazanç var
                if (bet === 0 && win > 0) {
                    result.hasRisk = true;
                    result.suspiciousWins.push({ game: gameName, amount: win, reason: 'Toplam bahis 0, kazanç var' });

                    if (win > 100) {
                        result.riskLevel = 'HIGH';
                        result.details.push(`Spin Gömme Şüphesi: ${gameName} (Bet: 0, Win: ₺${win})`);
                    } else {
                        result.riskLevel = result.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';
                        result.details.push(`Spin Gömme Şüphesi (Düşük): ${gameName} (Bet: 0, Win: ₺${win})`);
                    }
                }
            }

            return result;

        } catch (error) {
            logger.error('Error checking spin hoarding (legacy)', { error: error.message });
            return { hasRisk: false, riskLevel: 'LOW', details: ['Risk analizi hatası'], suspiciousWins: [] };
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
            isRisky: hoardingCheck.hasRisk,
            suspiciousWins: hoardingCheck.suspiciousWins || []
        };
    }
};

module.exports = riskService;
