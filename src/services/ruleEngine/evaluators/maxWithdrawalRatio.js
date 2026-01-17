// Evaluator: MAX_WITHDRAWAL_RATIO
// Çekim tutarının yatırıma oranı kontrolü

module.exports = async function (config, withdrawal, snapshot) {
    const maxRatio = config.max_ratio || 30;

    const deposit = snapshot?.turnover?.deposit?.amount || 0;
    const withdrawalAmount = withdrawal.Amount || 0;

    if (deposit === 0) {
        return { passed: false, detail: 'Yatırım verisi bulunamadı' };
    }

    const ratio = withdrawalAmount / deposit;
    const passed = ratio <= maxRatio;

    return {
        passed,
        detail: passed
            ? `${ratio.toFixed(1)}x <= ${maxRatio}x`
            : `${ratio.toFixed(1)}x > ${maxRatio}x`
    };
};
