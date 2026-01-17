// Evaluator: REQUIRE_DEPOSIT_TODAY
// Bugün yatırım yapılmış olmalı

module.exports = async function (config, withdrawal, snapshot) {
    if (!config.required) {
        return { passed: true, detail: 'Günlük yatırım kontrolü kapalı' };
    }

    const deposit = snapshot?.turnover?.deposit;
    if (!deposit || !deposit.time) {
        return {
            passed: false,
            detail: 'Yatırım bulunamadı'
        };
    }

    const depositDate = new Date(deposit.time);
    const today = new Date();
    const isToday = depositDate.toDateString() === today.toDateString();

    if (isToday) {
        return {
            passed: true,
            detail: `Bugün yatırım var: ₺${deposit.amount?.toLocaleString() || '?'}`
        };
    } else {
        const depositDateStr = depositDate.toLocaleDateString('tr-TR');
        return {
            passed: false,
            detail: `Bugün yatırım yok (Son: ${depositDateStr})`
        };
    }
};
