const db = require('../db/mysql');
const logger = require('../utils/logger');

/**
 * Unified Rules API Service
 * Full CRUD operations for the new rules table
 */

async function getRules(filters = {}) {
    const pool = db.getPool();
    if (!pool) return [];

    try {
        let query = 'SELECT * FROM unified_rules WHERE 1=1';
        const params = [];

        if (filters.category) {
            query += ' AND category = ?';
            params.push(filters.category);
        }

        if (filters.siteId) {
            query += ' AND site_id = ?';
            params.push(filters.siteId);
        }

        if (filters.isEnabled !== undefined) {
            query += ' AND is_enabled = ?';
            params.push(filters.isEnabled);
        }

        query += ' ORDER BY category, priority ASC';

        const [rows] = await pool.query(query, params);
        return rows.map(formatRule);
    } catch (error) {
        logger.error('[UnifiedRulesService] getRules error:', error.message);
        return [];
    }
}

async function getRule(id) {
    const pool = db.getPool();
    if (!pool) return null;

    try {
        const [rows] = await pool.query('SELECT * FROM unified_rules WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return formatRule(rows[0]);
    } catch (error) {
        logger.error('[UnifiedRulesService] getRule error:', error.message);
        return null;
    }
}

async function createRule(data) {
    const pool = db.getPool();
    if (!pool) throw new Error('Database not available');

    try {
        const config = typeof data.config === 'string' ? data.config : JSON.stringify(data.config || {});

        const [result] = await pool.query(
            `INSERT INTO unified_rules (rule_key, rule_name, rule_description, category, bonus_rule_id, config, is_enabled, is_critical, priority, site_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.rule_key,
                data.rule_name || data.rule_key,
                data.rule_description || '',
                data.category || 'GENERAL',
                data.bonus_rule_id || null,
                config,
                data.is_enabled !== false,
                data.is_critical || false,
                data.priority || 100,
                data.site_id || 1
            ]
        );

        return await getRule(result.insertId);
    } catch (error) {
        logger.error('[UnifiedRulesService] createRule error:', error.message);
        throw error;
    }
}

async function updateRule(id, data) {
    const pool = db.getPool();
    if (!pool) throw new Error('Database not available');

    try {
        const updates = [];
        const params = [];

        if (data.rule_name !== undefined) {
            updates.push('rule_name = ?');
            params.push(data.rule_name);
        }
        if (data.rule_description !== undefined) {
            updates.push('rule_description = ?');
            params.push(data.rule_description);
        }
        if (data.config !== undefined) {
            updates.push('config = ?');
            params.push(typeof data.config === 'string' ? data.config : JSON.stringify(data.config));
        }
        if (data.is_enabled !== undefined) {
            updates.push('is_enabled = ?');
            params.push(data.is_enabled);
        }
        if (data.is_critical !== undefined) {
            updates.push('is_critical = ?');
            params.push(data.is_critical);
        }
        if (data.priority !== undefined) {
            updates.push('priority = ?');
            params.push(data.priority);
        }

        if (updates.length === 0) {
            return await getRule(id);
        }

        params.push(id);
        await pool.query(`UPDATE unified_rules SET ${updates.join(', ')} WHERE id = ?`, params);

        return await getRule(id);
    } catch (error) {
        logger.error('[UnifiedRulesService] updateRule error:', error.message);
        throw error;
    }
}

async function deleteRule(id) {
    const pool = db.getPool();
    if (!pool) throw new Error('Database not available');

    try {
        await pool.query('DELETE FROM unified_rules WHERE id = ?', [id]);
        return true;
    } catch (error) {
        logger.error('[UnifiedRulesService] deleteRule error:', error.message);
        throw error;
    }
}

async function toggleRule(id) {
    const pool = db.getPool();
    if (!pool) throw new Error('Database not available');

    try {
        await pool.query('UPDATE unified_rules SET is_enabled = NOT is_enabled WHERE id = ?', [id]);
        return await getRule(id);
    } catch (error) {
        logger.error('[UnifiedRulesService] toggleRule error:', error.message);
        throw error;
    }
}

function formatRule(row) {
    return {
        id: row.id,
        rule_key: row.rule_key,
        rule_name: row.rule_name,
        rule_description: row.rule_description,
        category: row.category,
        bonus_rule_id: row.bonus_rule_id,
        config: parseConfig(row.config),
        is_enabled: Boolean(row.is_enabled),
        is_critical: Boolean(row.is_critical),
        priority: row.priority,
        site_id: row.site_id,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
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

module.exports = {
    getRules,
    getRule,
    createRule,
    updateRule,
    deleteRule,
    toggleRule
};
