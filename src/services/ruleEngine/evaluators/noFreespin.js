// Evaluator: NO_FREESPIN_BONUS
// FreeSpin işlemi olmamalı (normal çekimler için)

module.exports = async function (config, withdrawal, snapshot) {
    if (!config.reject_if_found) {
        return { passed: true, detail: 'FreeSpin kontrolü kapalı' };
    }

    const casinoGames = snapshot?.turnover?.turnover?.casino?.games || [];

    // FreeSpin ile başlayan oyunları bul
    const freespinGames = casinoGames.filter(g => {
        const name = (g.game || g.name || '').toLowerCase();
        return name.includes('freespin') || name.includes('free spin') || name.includes('free_spin');
    });

    if (freespinGames.length > 0) {
        const count = freespinGames.length;
        return {
            passed: false,
            detail: `${count} adet FreeSpin işlemi bulundu`
        };
    }

    return {
        passed: true,
        detail: 'FreeSpin işlemi yok'
    };
};
