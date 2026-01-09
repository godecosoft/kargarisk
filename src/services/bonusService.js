/**
 * Bonus Service
 * Oyuncu bonus bilgilerini getir
 */

const bcClient = require('./bcClient');
const logger = require('../utils/logger');

/**
 * Oyuncu bonuslarını getir
 */
async function getClientBonuses(clientId) {
    const payload = {
        StartDateLocal: null,
        EndDateLocal: null,
        BonusType: null,
        AcceptanceType: null,
        ClientBonusId: '',
        PartnerBonusId: '',
        PartnerExternalBonusId: '',
        ClientId: clientId
    };

    logger.info('Fetching client bonuses', { clientId });

    const response = await bcClient.post('/Client/GetClientBonuses', payload);
    return response.Data || [];
}

/**
 * Son N bonusu getir (tarihe göre sıralı)
 */
async function getLastBonuses(clientId, count = 5) {
    try {
        const bonuses = await getClientBonuses(clientId);

        // Tarihe göre sırala (en yeni önce)
        const sorted = bonuses.sort((a, b) =>
            new Date(b.CreatedLocal) - new Date(a.CreatedLocal)
        );

        // İlk N tane al ve formatla
        return sorted.slice(0, count).map(bonus => ({
            id: bonus.Id,
            name: bonus.Name,
            amount: bonus.Amount,
            type: bonus.BonusType,
            typeName: getBonusTypeName(bonus.BonusType),
            status: getBonusStatus(bonus),
            createdAt: bonus.CreatedLocal,
            acceptedAt: bonus.AcceptanceDateLocal,
            expiresAt: bonus.ClientBonusExpirationDateLocal,
            wageredAmount: bonus.WageredAmount,
            toWagerAmount: bonus.ToWagerAmount,
            paidAmount: bonus.PaidAmount
        }));

    } catch (error) {
        logger.error('Get bonuses error', { clientId, error: error.message });
        return [];
    }
}

/**
 * Bonus türü adı
 */
function getBonusTypeName(type) {
    const types = {
        1: 'Hoşgeldin',
        2: 'Yatırım Bonusu',
        3: 'Kayıp Bonusu',
        4: 'Cashback',
        5: 'FreeSpin',
        6: 'Freebet'
    };
    return types[type] || 'Bonus';
}

/**
 * Bonus durumu
 */
function getBonusStatus(bonus) {
    // ResultType: 0=Aktif, 1=Tamamlandı, 2=İptal, 3=Reddedildi
    if (bonus.ResultType === 1) return 'Tamamlandı';
    if (bonus.ResultType === 2) return 'İptal';
    if (bonus.ResultType === 3) return 'Reddedildi';
    if (bonus.AcceptanceType === 2) return 'Aktif';
    if (bonus.AcceptanceType === 0) return 'Beklemede';
    return 'Bilinmiyor';
}

module.exports = {
    getClientBonuses,
    getLastBonuses
};
