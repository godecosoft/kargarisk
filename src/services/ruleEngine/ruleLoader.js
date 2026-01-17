const db = require('../../db/mysql');
const logger = require('../../utils/logger');

async function loadRules(siteId = 1) {
    const pool = db.getPool();
    if (!pool) {
        logger.warn('[RuleLoader] No database pool available');
        return [];
    }

    try {
        const [rows] = await pool.query(
            `SELECT * FROM unified_rules 
             WHERE site_id = ? AND is_enabled = TRUE 
             ORDER BY priority ASC`,
            [siteId]
        );

        return rows.map(row => ({
            id: row.id,
            key: row.rule_key,
            name: row.rule_name,
            description: row.rule_description,
            category: row.category,
            bonusRuleId: row.bonus_rule_id,
            config: parseConfig(row.config),
            isEnabled: row.is_enabled,
            isCritical: row.is_critical,
            priority: row.priority,
            siteId: row.site_id
        }));
    } catch (error) {
        logger.error('[RuleLoader] Failed to load rules:', error.message);
        return [];
    }
}

function parseConfig(config) {
    if (!config) return {};
    if (typeof config === 'object') return config;
    try {
        return JSON.parse(config);
    } catch {
        return {};
    }
}

async function loadBonusRules(siteId = 1) {
    const pool = db.getPool();
    if (!pool) return [];

    try {
        const [rows] = await pool.query('SELECT * FROM bonus_rules WHERE is_active = TRUE');
        return rows;
    } catch (error) {
        logger.error('[RuleLoader] Failed to load bonus rules:', error.message);
        return [];
    }
}

module.exports = { loadRules, loadBonusRules };
