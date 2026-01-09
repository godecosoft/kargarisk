/**
 * Rules Service
 * Rule engine configuration and management
 */

const db = require('../db/mysql');

/**
 * Get a rule value by key
 * @param {string} key - Rule key
 * @param {any} defaultValue - Default value if not found
 */
async function getRule(key, defaultValue) {
    try {
        const pool = db.getPool();
        if (!pool) return defaultValue;

        const [rows] = await pool.query('SELECT rule_value FROM rules WHERE rule_key = ?', [key]);

        if (rows.length > 0) {
            // mysql2 parses JSON column automatically
            return rows[0].rule_value;
        }

        return defaultValue;
    } catch (error) {
        console.error(`[RulesService] getRule error for ${key}:`, error.message);
        return defaultValue;
    }
}

/**
 * Set a rule value
 * @param {string} key - Rule key
 * @param {any} value - Value to store (will be JSON encoded)
 * @param {string} description - Optional description
 */
async function setRule(key, value, description = null) {
    try {
        const pool = db.getPool();
        if (!pool) return false;

        // Ensure value is appropriate for JSON
        // mysql2 handles object->JSON string automatically for JSON columns usually,
        // but explicit stringify is safer if we want to ensure it's stored as JSON
        // Actually, let's rely on mysql2 or pass raw.
        // If value is 1, MySQL JSON accepts '1'.

        await pool.query(`
            INSERT INTO rules (rule_key, rule_value, description)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
            rule_value = VALUES(rule_value),
            description = COALESCE(VALUES(description), description)
        `, [key, value, description]);

        return true;
    } catch (error) {
        console.error(`[RulesService] setRule error for ${key}:`, error.message);
        return false;
    }
}

/**
 * Get all rules (as key-value object)
 */
async function getAllRules() {
    try {
        const pool = db.getPool();
        if (!pool) return {};

        const [rows] = await pool.query('SELECT rule_key, rule_value FROM rules');

        const rules = {};
        rows.forEach(row => {
            rules[row.rule_key] = row.rule_value;
        });

        return rules;
    } catch (error) {
        console.error('[RulesService] getAllRules error:', error.message);
        return {};
    }
}

module.exports = {
    getRule,
    setRule,
    getAllRules
};
