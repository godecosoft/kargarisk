// Evaluator: TURNOVER_MULTIPLIER
// Çevrim katı kontrolü (yatırım * multiplier kadar çevrim yapılmış olmalı)

module.exports = async function (config, withdrawal, snapshot) {
    const multiplier = config.multiplier || 1;

    const deposit = snapshot?.turnover?.deposit?.amount || 0;
    const totalTurnover = snapshot?.turnover?.total?.amount || snapshot?.turnover?.turnover?.total?.amount || 0;

    if (deposit === 0) {
        return { passed: false, detail: 'Yatırım verisi bulunamadı' };
    }

    const required = deposit * multiplier;
    const percentage = Math.round((totalTurnover / required) * 100);
    const passed = percentage >= 100;

    return {
        passed,
        detail: passed
            ? `%${percentage} >= %100 (${multiplier}x çevrim tamamlandı)`
            : `%${percentage} < %100 (${multiplier}x çevrim gerekli)`
    };
};
