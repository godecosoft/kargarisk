// Evaluator: NO_BONUS_AFTER_DEPOSIT
// Yatırımdan sonra bonus alınmamış olmalı

module.exports = async function (config, withdrawal, snapshot) {
    const timeWindow = config.time_window_minutes || 60;

    const deposit = snapshot?.turnover?.deposit;
    if (!deposit || !deposit.time) {
        return { passed: true, detail: 'Yatırım verisi yok, kontrol atlandı' };
    }

    const depositTime = new Date(deposit.time);
    const bonuses = snapshot?.bonuses || [];

    // Yatırımdan sonra alınan bonusları bul
    const bonusesAfterDeposit = bonuses.filter(b => {
        if (!b.createdAt && !b.created) return false;
        const bonusTime = new Date(b.createdAt || b.created);

        // Bonus yatırımdan sonra mı alınmış?
        if (bonusTime <= depositTime) return false;

        // Zaman penceresi içinde mi? (varsayılan 60 dakika)
        const diffMinutes = (bonusTime - depositTime) / (1000 * 60);
        return diffMinutes <= timeWindow;
    });

    if (bonusesAfterDeposit.length > 0) {
        const bonusNames = bonusesAfterDeposit.map(b => b.name).join(', ');
        return {
            passed: false,
            detail: `Yatırım sonrası bonus: ${bonusNames}`
        };
    }

    return {
        passed: true,
        detail: 'Yatırım sonrası bonus yok'
    };
};
