// Evaluator: CASHBACK_AUTO_APPROVE
// Cashback çekimlerinde otomatik onay kontrolü

module.exports = async function (config, withdrawal, snapshot) {
    if (!config.enabled) {
        return {
            passed: false,
            detail: 'Cashback oto-onay kapalı'
        };
    }

    return {
        passed: true,
        detail: 'Cashback oto-onay açık'
    };
};
