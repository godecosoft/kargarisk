// Evaluator: CASHBACK_NO_TURNOVER
// Cashback çekimlerinde çevrim kontrolü atlandı mı

module.exports = async function (config, withdrawal, snapshot) {
    if (config.skip_turnover) {
        return {
            passed: true,
            detail: 'Cashback çevrim kontrolü atlandı'
        };
    }

    // Çevrim kontrolü yapılacaksa standart kontrol
    const deposit = snapshot?.turnover?.deposit?.amount || 0;
    const totalTurnover = snapshot?.turnover?.total?.amount || 0;

    if (deposit === 0) {
        return { passed: true, detail: 'Yatırım verisi yok (cashback)' };
    }

    const percentage = Math.round((totalTurnover / deposit) * 100);
    const passed = percentage >= 100;

    return {
        passed,
        detail: passed
            ? `%${percentage} >= %100`
            : `%${percentage} < %100`
    };
};
