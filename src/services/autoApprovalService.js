/**
 * Auto Approval Service
 * Evaluates withdrawal requests against configurable rules and auto-approves if all pass
 */

const db = require('../db/mysql');
const bcClient = require('./bcClient');
const logger = require('../utils/logger');

/**
 * Get all auto-approval rules from DB
 */
async function getRules() {
    const pool = db.getPool();
    if (!pool) {
        logger.warn('[AutoApproval] No database pool available');
        return {};
    }

    try {
        const [rows] = await pool.query('SELECT * FROM auto_approval_rules');
        logger.info(`[AutoApproval] Loaded ${rows.length} rules from DB`);

        const rules = {};
        for (const row of rows) {
            rules[row.rule_key] = {
                name: row.rule_name,
                value: row.rule_value,
                enabled: Boolean(row.is_enabled), // Convert to boolean properly
                description: row.description
            };
        }
        return rules;
    } catch (error) {
        logger.error('[AutoApproval] getRules error:', error.message);
        return {};
    }
}

/**
 * Update a rule
 */
async function updateRule(ruleKey, value, enabled) {
    const pool = db.getPool();
    if (!pool) return false;

    try {
        await pool.query(
            'UPDATE auto_approval_rules SET rule_value = ?, is_enabled = ? WHERE rule_key = ?',
            [value, enabled, ruleKey]
        );
        logger.info(`[AutoApproval] Updated rule ${ruleKey}:`, { value, enabled });
        return true;
    } catch (error) {
        logger.error('[AutoApproval] updateRule error:', error.message);
        return false;
    }
}

/**
 * Check if deposit was made today
 */
function isDepositToday(depositTime) {
    if (!depositTime) return false;
    const deposit = new Date(depositTime);
    const today = new Date();
    return deposit.toDateString() === today.toDateString();
}

/**
 * Check for forbidden games in casino data
 */
function hasForbiddenGames(casinoGames, forbiddenPatterns) {
    if (!casinoGames || casinoGames.length === 0) return false;
    const patterns = forbiddenPatterns.split(',').map(p => p.trim().toLowerCase());

    for (const game of casinoGames) {
        const gameName = (game.game || game.name || '').toLowerCase();
        for (const pattern of patterns) {
            if (gameName.includes(pattern)) {
                logger.info(`[AutoApproval] Forbidden game found: ${gameName} matches ${pattern}`);
                return true;
            }
        }
    }
    return false;
}

/**
 * Evaluate all rules for a withdrawal
 * @param {Object} withdrawal - BC withdrawal object
 * @param {Object} snapshot - Snapshot data from DB
 * @param {Object} rules - Rules from DB
 * @returns {Object} { passed: boolean, failedRules: string[], passedRules: string[] }
 */
function evaluateRules(withdrawal, snapshot, rules) {
    const result = {
        passed: true,
        failedRules: [],
        passedRules: []
    };

    // 1. MAX_AMOUNT - Check withdrawal amount
    if (rules.MAX_AMOUNT?.enabled) {
        const maxAmount = parseFloat(rules.MAX_AMOUNT.value) || 5000;
        if (withdrawal.Amount <= maxAmount) {
            result.passedRules.push(`MAX_AMOUNT: ₺${withdrawal.Amount} <= ₺${maxAmount}`);
        } else {
            result.passed = false;
            result.failedRules.push(`MAX_AMOUNT: ₺${withdrawal.Amount} > ₺${maxAmount}`);
        }
    }

    // Check for fake deposit (Bonus/FreeSpin turnover reference)
    const withdrawalType = snapshot?.turnover?.withdrawalType?.type;
    const isBonusWithdrawal = withdrawalType === 'BONUS' || withdrawalType === 'FREESPIN';

    // 2. MAX_WITHDRAWAL_RATIO - Check if withdrawal > Nx deposit amount
    if (rules.MAX_WITHDRAWAL_RATIO?.enabled) {
        // If it's a Bonus/FreeSpin withdrawal, there is NO deposit, so ratio is invalid/infinite.
        // Or if it's Cashback, ratio check is not applicable (or handled differently).

        if (isBonusWithdrawal) {
            result.passed = false;
            result.failedRules.push('MAX_WITHDRAWAL_RATIO: Bonus/FreeSpin çekimi - Yatırım bulunamadı (Oran hesaplanamaz)');
        } else if (withdrawalType === 'CASHBACK') {
            // Cashback usually implies no recent huge deposit, but let's skip ratio check or check against cashback amount?
            // For now, let's skip ratio check for Cashback as it has its own logic in turnover
            result.passedRules.push('MAX_WITHDRAWAL_RATIO: Cashback çekimi - Oran kontrolü atlandı');
        } else {
            const maxRatio = parseFloat(rules.MAX_WITHDRAWAL_RATIO.value) || 30;
            const depositAmount = snapshot?.turnover?.deposit?.amount || snapshot?.deposit?.amount || 0;

            if (depositAmount > 0) {
                const actualRatio = withdrawal.Amount / depositAmount;
                if (actualRatio <= maxRatio) {
                    result.passedRules.push(`MAX_WITHDRAWAL_RATIO: ${actualRatio.toFixed(1)}x <= ${maxRatio}x`);
                } else {
                    result.passed = false;
                    result.failedRules.push(`MAX_WITHDRAWAL_RATIO: ₺${withdrawal.Amount} > ${maxRatio}x yatırım (₺${depositAmount})`);
                }
            } else {
                result.passed = false;
                result.failedRules.push('MAX_WITHDRAWAL_RATIO: Yatırım bulunamadı');
            }
        }
    }

    // 3. REQUIRE_DEPOSIT_TODAY - Check if deposit was made today
    if (rules.REQUIRE_DEPOSIT_TODAY?.enabled) {
        // If it's a Bonus withdrawal, do we allow it without deposit today?
        // User said: "Bu üye deneme bonusuyla çekim gelmiş, yatırımı yok, neden onaylıyor".
        // So for Bonus withdrawals, if there is NO Real Deposit, this rule should FAIL.

        if (isBonusWithdrawal) {
            result.passed = false;
            result.failedRules.push('REQUIRE_DEPOSIT_TODAY: Bonus/FreeSpin çekimi - Bugün yatırım yok');
        } else {
            const depositTime = snapshot?.turnover?.deposit?.time || snapshot?.deposit?.time;
            if (isDepositToday(depositTime)) {
                result.passedRules.push('REQUIRE_DEPOSIT_TODAY: Bugün yatırım var');
            } else {
                result.passed = false;
                result.failedRules.push('REQUIRE_DEPOSIT_TODAY: Bugün yatırım yok');
            }
        }
    }

    // 4. NO_BONUS_AFTER_DEPOSIT - Check bonuses AFTER deposit
    if (rules.NO_BONUS_AFTER_DEPOSIT?.enabled) {
        const bonuses = snapshot?.bonuses || [];
        const depositTime = snapshot?.turnover?.deposit?.time || snapshot?.deposit?.time;

        // Filter bonuses that were given AFTER the deposit
        let bonusesAfterDeposit = bonuses;
        if (depositTime) {
            const depositDate = new Date(depositTime);
            bonusesAfterDeposit = bonuses.filter(b => {
                const bonusDate = new Date(b.time || b.createdTime || b.CreateTime || 0);
                return bonusDate > depositDate;
            });
        }

        if (bonusesAfterDeposit.length === 0) {
            result.passedRules.push('NO_BONUS_AFTER_DEPOSIT: Yatırım sonrası bonus yok');
        } else {
            result.passed = false;
            result.failedRules.push(`NO_BONUS_AFTER_DEPOSIT: Yatırım sonrası ${bonusesAfterDeposit.length} bonus bulundu`);
        }
    }

    // 5. NO_FREESPIN_BONUS - Check FreeSpin/PayClientBonus transactions AFTER deposit
    if (rules.NO_FREESPIN_BONUS?.enabled) {
        const bonusTx = snapshot?.bonusTransactions?.data || snapshot?.bonusTransactions || [];
        const depositTime = snapshot?.turnover?.deposit?.time || snapshot?.deposit?.time;

        // Filter transactions that occurred AFTER the deposit
        let txAfterDeposit = bonusTx;
        if (depositTime) {
            const depositDate = new Date(depositTime);
            txAfterDeposit = bonusTx.filter(tx => {
                const txDate = new Date(tx.time || tx.CreateTime || tx.createdTime || 0);
                return txDate > depositDate;
            });
        }

        if (txAfterDeposit.length === 0) {
            result.passedRules.push('NO_FREESPIN_BONUS: Yatırım sonrası FreeSpin/Bonus işlemi yok');
        } else {
            result.passed = false;
            result.failedRules.push(`NO_FREESPIN_BONUS: Yatırım sonrası ${txAfterDeposit.length} işlem bulundu`);
        }
    }

    // 5. NO_SPORTS_BETS - Check sports bets
    if (rules.NO_SPORTS_BETS?.enabled) {
        const sportsBets = snapshot?.sports?.bets?.length || snapshot?.sports?.totalBets || 0;
        if (sportsBets === 0) {
            result.passedRules.push('NO_SPORTS_BETS: Spor bahisi yok');
        } else {
            result.passed = false;
            result.failedRules.push(`NO_SPORTS_BETS: ${sportsBets} spor bahisi bulundu`);
        }
    }

    // 6. FORBIDDEN_GAMES - Check casino games for forbidden patterns
    if (rules.FORBIDDEN_GAMES?.enabled) {
        const casinoGames = snapshot?.turnover?.turnover?.casino?.games || [];
        const forbiddenPatterns = rules.FORBIDDEN_GAMES.value || '';
        if (!hasForbiddenGames(casinoGames, forbiddenPatterns)) {
            result.passedRules.push('FORBIDDEN_GAMES: Yasaklı oyun yok');
        } else {
            result.passed = false;
            result.failedRules.push('FORBIDDEN_GAMES: Yasaklı oyun tespit edildi');
        }
    }

    // 7. TURNOVER_COMPLETE - Check turnover percentage
    if (rules.TURNOVER_COMPLETE?.enabled) {
        const minPercentage = parseFloat(rules.TURNOVER_COMPLETE.value) || 100;
        const currentPercentage = snapshot?.turnover?.turnover?.total?.percentage || 0;
        if (currentPercentage >= minPercentage) {
            result.passedRules.push(`TURNOVER_COMPLETE: %${currentPercentage} >= %${minPercentage}`);
        } else {
            result.passed = false;
            result.failedRules.push(`TURNOVER_COMPLETE: %${currentPercentage} < %${minPercentage}`);
        }
    }

    return result;
}

/**
 * Log auto-approval to database
 */
async function logApproval(withdrawal, ruleResult, bcResponse) {
    const pool = db.getPool();
    if (!pool) return;

    try {
        await pool.query(`
            INSERT INTO auto_approvals (withdrawal_id, client_id, client_login, amount, rules_passed, bc_response)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            withdrawal.Id,
            withdrawal.ClientId,
            withdrawal.ClientLogin,
            withdrawal.Amount,
            JSON.stringify(ruleResult.passedRules),
            JSON.stringify(bcResponse)
        ]);
        logger.info(`[AutoApproval] Logged approval for ${withdrawal.Id}`);
    } catch (error) {
        logger.error('[AutoApproval] logApproval error:', error.message);
    }
}

/**
 * Process auto-approval for a withdrawal
 * @param {Object} withdrawal - BC withdrawal object
 * @param {Object} snapshot - Snapshot data from DB
 * @returns {Object} { approved: boolean, reason: string, ruleResult: Object }
 */
async function processAutoApproval(withdrawal, snapshot) {
    try {
        // Get current rules
        const rules = await getRules();

        // Check master toggle first
        if (!rules.AUTO_APPROVAL_ENABLED?.enabled) {
            logger.info(`[AutoApproval] System disabled, skipping withdrawal ${withdrawal.Id}`);
            return {
                approved: false,
                reason: 'Otomatik onay sistemi kapalı',
                ruleResult: { passed: false, failedRules: ['AUTO_APPROVAL_ENABLED: Sistem kapalı'] }
            };
        }

        // Evaluate rules
        const ruleResult = evaluateRules(withdrawal, snapshot, rules);

        if (!ruleResult.passed) {
            logger.info(`[AutoApproval] Withdrawal ${withdrawal.Id} failed rules:`, ruleResult.failedRules);
            return {
                approved: false,
                reason: ruleResult.failedRules.join(', '),
                ruleResult
            };
        }

        // All rules passed - call BC API to approve
        logger.info(`[AutoApproval] Approving withdrawal ${withdrawal.Id}...`);
        const bcResponse = await bcClient.payWithdrawalRequest(withdrawal);

        // Log to DB
        await logApproval(withdrawal, ruleResult, bcResponse);

        return {
            approved: true,
            reason: 'Tüm kurallar geçti, otomatik onaylandı',
            ruleResult,
            bcResponse
        };

    } catch (error) {
        logger.error(`[AutoApproval] processAutoApproval error:`, error.message);
        return {
            approved: false,
            reason: `Hata: ${error.message}`,
            ruleResult: { passed: false, failedRules: [error.message] }
        };
    }
}

/**
 * Get auto-approval history
 */
async function getApprovalHistory(limit = 50) {
    const pool = db.getPool();
    if (!pool) return [];

    try {
        const [rows] = await pool.query(
            'SELECT * FROM auto_approvals ORDER BY approved_at DESC LIMIT ?',
            [limit]
        );
        return rows;
    } catch (error) {
        logger.error('[AutoApproval] getApprovalHistory error:', error.message);
        return [];
    }
}

module.exports = {
    getRules,
    updateRule,
    evaluateRules,
    processAutoApproval,
    logApproval,
    getApprovalHistory
};
