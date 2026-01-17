// Evaluator: CASHBACK_MAX_AMOUNT
// Cashback çekim limiti kontrolü

module.exports = async function (config, withdrawal, snapshot) {
    const maxValue = config.max_value || 1000;
    const amount = withdrawal.Amount || 0;
    const passed = amount <= maxValue;

    return {
        passed,
        detail: passed
            ? `₺${amount.toLocaleString()} <= ₺${maxValue.toLocaleString()}`
            : `₺${amount.toLocaleString()} > ₺${maxValue.toLocaleString()}`
    };
};
