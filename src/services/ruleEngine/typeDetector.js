const logger = require('../../utils/logger');

function detect(snapshot) {
    // Önce turnover servisinden gelen tip kontrolü
    const withdrawalType = snapshot?.turnover?.withdrawalType?.type;

    if (withdrawalType === 'FREESPIN') return 'FREESPIN';
    if (withdrawalType === 'BONUS') return 'BONUS';
    if (withdrawalType === 'CASHBACK') return 'CASHBACK';

    // Eğer tip belirlenemediyse, bonus geçmişine bak
    const bonuses = snapshot?.bonuses || [];

    // Son aktif bonus var mı?
    const activeBonus = bonuses.find(b =>
        b.type === 2 && // Wagering Bonus
        (b.acceptanceType === 0 || b.acceptanceType === 2) && // Pending veya Active
        b.resultType === 0 // Still active
    );

    if (activeBonus) {
        logger.info(`[TypeDetector] Found active bonus: ${activeBonus.name}`);
        return 'BONUS';
    }

    // Cashback kontrolü - son işlem cashback mi?
    const lastTransaction = snapshot?.turnover?.deposit;
    if (lastTransaction?.type === 'CASHBACK' || lastTransaction?.Notes?.toLowerCase().includes('cashback')) {
        return 'CASHBACK';
    }

    // Varsayılan: Normal çekim
    return 'NORMAL';
}

module.exports = { detect };
