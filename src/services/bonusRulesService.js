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
            turnover_multiplier, min_withdrawal_multiplier, max_withdrawal_multiplier,
            min_balance_limit, fixed_withdrawal_amount, max_remaining_balance,
            require_deposit_id, delete_excess_balance
        } = ruleData;

        try {
            const sql = `
                INSERT INTO bonus_rules 
                (name, match_keyword, max_amount, ignore_deposit_rule, auto_approval_enabled, 
                 turnover_multiplier, min_withdrawal_multiplier, max_withdrawal_multiplier,
                 min_balance_limit, fixed_withdrawal_amount, max_remaining_balance,
                 require_deposit_id, delete_excess_balance, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
            `;
            const result = await db.query(sql, [
                name,
                match_keyword.toUpperCase(),
                max_amount || 0,
                ignore_deposit_rule || false,
                auto_approval_enabled || false,
                turnover_multiplier || 0,
                min_withdrawal_multiplier || 0,
                max_withdrawal_multiplier || 0,
                min_balance_limit || 0,
                fixed_withdrawal_amount || 0,
                max_remaining_balance || 0,
                require_deposit_id || false,
                delete_excess_balance || false
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

            // Extended bonus rule fields
            if (updates.min_balance_limit !== undefined) { fields.push('min_balance_limit = ?'); values.push(updates.min_balance_limit); }
            if (updates.fixed_withdrawal_amount !== undefined) { fields.push('fixed_withdrawal_amount = ?'); values.push(updates.fixed_withdrawal_amount); }
            if (updates.max_remaining_balance !== undefined) { fields.push('max_remaining_balance = ?'); values.push(updates.max_remaining_balance); }
            if (updates.require_deposit_id !== undefined) { fields.push('require_deposit_id = ?'); values.push(updates.require_deposit_id); }
            if (updates.delete_excess_balance !== undefined) { fields.push('delete_excess_balance = ?'); values.push(updates.delete_excess_balance); }

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
