const db = require('../db/mysql');
const logger = require('../utils/logger');

/**
 * Bonus Rules Service
 * Manages dynamic rules for different bonus types
 */
const bonusRulesService = {

    /**
     * Get all bonus rules
     */
    async getAllRules() {
        try {
            const sql = 'SELECT * FROM bonus_rules ORDER BY created_at DESC';
            return await db.query(sql);
        } catch (error) {
            logger.error('Error fetching bonus rules', { error: error.message });
            throw error;
        }
    },

    /**
     * Get a specific rule by ID
     */
    async getRuleById(id) {
        try {
            const sql = 'SELECT * FROM bonus_rules WHERE id = ?';
            const results = await db.query(sql, [id]);
            return results[0] || null;
        } catch (error) {
            logger.error('Error fetching bonus rule by id', { id, error: error.message });
            throw error;
        }
    },

    /**
     * Add a new bonus rule
     */
    async addRule(ruleData) {
        const {
            name, match_keyword, max_amount, ignore_deposit_rule, auto_approval_enabled,
            turnover_multiplier, min_withdrawal_multiplier, max_withdrawal_multiplier
        } = ruleData;

        try {
            const sql = `
                INSERT INTO bonus_rules 
                (name, match_keyword, max_amount, ignore_deposit_rule, auto_approval_enabled, 
                 turnover_multiplier, min_withdrawal_multiplier, max_withdrawal_multiplier, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)
            `;
            const result = await db.query(sql, [
                name,
                match_keyword.toUpperCase(),
                max_amount || 0,
                ignore_deposit_rule || false,
                auto_approval_enabled || false,
                turnover_multiplier || 0,
                min_withdrawal_multiplier || 0,
                max_withdrawal_multiplier || 0
            ]);
            return result.insertId;
        } catch (error) {
            logger.error('Error adding bonus rule', { error: error.message });
            throw error;
        }
    },

    /**
     * Update an existing rule
     */
    async updateRule(id, updates) {
        try {
            const fields = [];
            const values = [];

            if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
            if (updates.match_keyword !== undefined) { fields.push('match_keyword = ?'); values.push(updates.match_keyword.toUpperCase()); }
            if (updates.max_amount !== undefined) { fields.push('max_amount = ?'); values.push(updates.max_amount); }
            if (updates.ignore_deposit_rule !== undefined) { fields.push('ignore_deposit_rule = ?'); values.push(updates.ignore_deposit_rule); }
            if (updates.auto_approval_enabled !== undefined) { fields.push('auto_approval_enabled = ?'); values.push(updates.auto_approval_enabled); }
            if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active); }

            // New fields
            if (updates.turnover_multiplier !== undefined) { fields.push('turnover_multiplier = ?'); values.push(updates.turnover_multiplier); }
            if (updates.min_withdrawal_multiplier !== undefined) { fields.push('min_withdrawal_multiplier = ?'); values.push(updates.min_withdrawal_multiplier); }
            if (updates.max_withdrawal_multiplier !== undefined) { fields.push('max_withdrawal_multiplier = ?'); values.push(updates.max_withdrawal_multiplier); }

            if (fields.length === 0) return false;

            const sql = `UPDATE bonus_rules SET ${fields.join(', ')} WHERE id = ?`;
            values.push(id);

            await db.query(sql, values);
            return true;
        } catch (error) {
            logger.error('Error updating bonus rule', { id, error: error.message });
            throw error;
        }
    },

    /**
     * Delete a rule
     */
    async deleteRule(id) {
        try {
            await db.query('DELETE FROM bonus_rules WHERE id = ?', [id]);
            return true;
        } catch (error) {
            logger.error('Error deleting bonus rule', { id, error: error.message });
            throw error;
        }
    },

    /**
     * Find a matching rule for a transaction
     * Checks Game, PaymentSystemName, and Notes for the keyword
     */
    async findMatchingRule(transaction) {
        try {
            const rules = await this.getAllRules();
            const activeRules = rules.filter(r => r.is_active);

            const game = (transaction.Game || '').toUpperCase();
            const payment = (transaction.PaymentSystemName || '').toUpperCase();
            const notes = (transaction.Notes || transaction.Warning || '').toUpperCase();
            const docName = (transaction.DocumentTypeName || '').toUpperCase();

            for (const rule of activeRules) {
                const keyword = rule.match_keyword.toUpperCase();
                if (
                    game.includes(keyword) ||
                    payment.includes(keyword) ||
                    notes.includes(keyword) ||
                    docName.includes(keyword)
                ) {
                    return rule;
                }
            }
            return null;
        } catch (error) {
            logger.error('Error finding matching rule', { error: error.message });
            return null;
        }
    }
};

module.exports = bonusRulesService;
