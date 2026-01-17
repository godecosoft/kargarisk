// Evaluator: MAX_AMOUNT
// Çekim miktarının maksimum limitin altında olup olmadığını kontrol eder

module.exports = async function (config, withdrawal, snapshot) {
    const maxValue = config.max_value || 5000;
    const amount = withdrawal.Amount || 0;
    const passed = amount <= maxValue;

    return {
        passed,
        detail: passed
            ? `₺${amount.toLocaleString()} <= ₺${maxValue.toLocaleString()}`
            : `₺${amount.toLocaleString()} > ₺${maxValue.toLocaleString()}`
    };
};
