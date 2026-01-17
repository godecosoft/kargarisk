const evaluators = require('./evaluators');
const logger = require('../../utils/logger');

async function execute(rule, withdrawal, snapshot) {
    const evaluator = evaluators[rule.key];

    if (!evaluator) {
        logger.warn(`[RuleExecutor] No evaluator found for: ${rule.key}`);
        return {
            name: rule.key,
            passed: true,
            detail: `Evaluator bulunamadı: ${rule.key} (atlandı)`,
            critical: false
        };
    }

    try {
        const result = await evaluator(rule.config, withdrawal, snapshot);
        return {
            name: rule.key,
            displayName: rule.name || rule.key,
            passed: result.passed,
            detail: result.detail,
            critical: rule.isCritical && !result.passed
        };
    } catch (error) {
        logger.error(`[RuleExecutor] Error executing ${rule.key}:`, error.message);
        return {
            name: rule.key,
            displayName: rule.name || rule.key,
            passed: false,
            detail: `Hata: ${error.message}`,
            critical: false
        };
    }
}

module.exports = { execute };
