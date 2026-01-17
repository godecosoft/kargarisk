// Evaluator: FREESPIN_AUTO_APPROVE
// FreeSpin çekimlerinde otomatik onay kontrolü

module.exports = async function (config, withdrawal, snapshot) {
    if (!config.enabled) {
        return {
            passed: false,
            detail: 'FreeSpin oto-onay kapalı (varsayılan MANUEL)'
        };
    }

    return {
        passed: true,
        detail: 'FreeSpin oto-onay açık'
    };
};
