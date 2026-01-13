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
 * AcceptanceType adı
 */
function getAcceptanceTypeName(type) {
    const types = {
        0: 'Beklemede',
        2: 'Aktif'
    };
    return types[type] || 'Bilinmiyor';
}

/**
 * ResultType adı
 */
function getResultTypeName(type) {
    const types = {
        0: 'Aktif',
        1: 'Ödendi',
        2: 'Tamamlandı',
        3: 'İptal'
    };
    return types[type] || 'Bilinmiyor';
}

/**
 * Bonus türü adı
 */
function getBonusTypeName(type) {
    const types = {
        1: 'Hoşgeldin',
        2: 'Çevrimli Bonus',
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
    // ResultType: 0=Aktif, 1=Ödendi, 2=Tamamlandı, 3=İptal
    if (bonus.ResultType === 1) return 'paid';
    if (bonus.ResultType === 2) return 'completed';
    if (bonus.ResultType === 3) return 'cancelled';
    if (bonus.AcceptanceType === 2) return 'active';
    if (bonus.AcceptanceType === 0) return 'pending';
    return 'unknown';
}

/**
 * Son N bonusu getir (tarihe göre sıralı) - GELİŞTİRİLMİŞ
 * WageringBonus (BonusType=2) için çevrim bilgisi de getirir
 */
async function getLastBonuses(clientId, count = 5) {
    try {
        const bonuses = await getClientBonuses(clientId);

        // Tarihe göre sırala (en yeni önce)
        const sorted = bonuses.sort((a, b) =>
            new Date(b.CreatedLocal) - new Date(a.CreatedLocal)
        );

        // İlk N tane al ve formatla
        const formattedBonuses = sorted.slice(0, count).map(bonus => ({
            id: bonus.Id,
            name: bonus.Name,
            amount: bonus.Amount,
            // Type bilgileri
            type: bonus.BonusType,
            typeName: getBonusTypeName(bonus.BonusType),
            isWageringBonus: bonus.BonusType === 2,
            isFreeSpin: bonus.BonusType === 5,
            // Kabul durumu
            acceptanceType: bonus.AcceptanceType,
            acceptanceTypeName: getAcceptanceTypeName(bonus.AcceptanceType),
            // Sonuç durumu
            resultType: bonus.ResultType,
            resultTypeName: getResultTypeName(bonus.ResultType),
            status: getBonusStatus(bonus),
            // Tarihler
            createdAt: bonus.CreatedLocal,
            acceptedAt: bonus.AcceptanceDateLocal,
            resultAt: bonus.ResultDateLocal,
            expiresAt: bonus.ClientBonusExpirationDateLocal,
            // Tutarlar
            paidAmount: bonus.PaidAmount || 0,
            wageredAmount: bonus.WageredAmount || 0,
            toWagerAmount: bonus.ToWagerAmount || 0,
            // Çevrim bilgisi için gerekli ID'ler (WageringBonus için)
            externalId: bonus.ExternalId,  // BonusDefId için
            clientId: bonus.ClientId
        }));

        // WageringBonus (BonusType=2) olanlar için çevrim bilgisi getir
        for (const bonus of formattedBonuses) {
            if (bonus.isWageringBonus && bonus.externalId) {
                try {
                    const wageringInfo = await bcClient.getWageringBonusInfo(
                        bonus.clientId,
                        bonus.externalId,  // BonusDefId
                        bonus.id           // BonusPlayerExternalId
                    );

                    if (wageringInfo) {
                        bonus.wageringInfo = {
                            amountToWager: wageringInfo.AmountToWager || 0,
                            wageredAmount: wageringInfo.WageredAmount || 0,
                            percentage: wageringInfo.AmountToWager > 0
                                ? Math.round((wageringInfo.WageredAmount / wageringInfo.AmountToWager) * 100)
                                : 0
                        };
                    }
                } catch (err) {
                    logger.debug('Wagering info fetch failed for bonus', { bonusId: bonus.id, error: err.message });
                }
            }
        }

        return formattedBonuses;

    } catch (error) {
        logger.error('Get bonuses error', { clientId, error: error.message });
        return [];
    }
}

module.exports = {
    getClientBonuses,
    getLastBonuses
};
