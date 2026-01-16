/**
 * Auto Approval Service
 * Evaluates withdrawal requests against configurable rules and auto-approves if all pass
 */

const db = require('../db/mysql');
const bcClient = require('./bcClient');
const logger = require('../utils/logger');
const bonusRulesService = require('./bonusRulesService');
const riskService = require('./riskService');

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
/**
 * Evaluate all rules for a withdrawal
 * @param {Object} withdrawal - BC withdrawal object
 * @param {Object} snapshot - Snapshot data from DB
 * @param {Object} rules - Rules from DB
 * @param {Object|null} bonusRule - Matched bonus rule (if any)
 * @returns {Object} { passed: boolean, failedRules: string[], passedRules: string[] }
 */
function evaluateRules(withdrawal, snapshot, rules, bonusRule = null) {
    const result = {
        passed: true,
        failedRules: [],
        passedRules: []
    };

    // Check for fake deposit (Bonus/FreeSpin turnover reference)
    const withdrawalType = snapshot?.turnover?.withdrawalType?.type;
    const isBonusWithdrawal = withdrawalType === 'BONUS' || withdrawalType === 'FREESPIN';

    // SPECIAL HANDLING FOR BONUS RULES
    if (bonusRule) {
        result.passedRules.push(`BONUS_RULE_MATCH: ${bonusRule.name}`);

        // 1. Check if auto-approval is enabled for this specific bonus
        if (!bonusRule.auto_approval_enabled) {
            result.passed = false;
            result.failedRules.push(`BONUS_RULE: Bu bonus (${bonusRule.name}) için otomatik onay KAPALI`);
        }

        // 2. Check Max Amount from Bonus Rule
        if (bonusRule.max_amount > 0 && withdrawal.Amount > bonusRule.max_amount) {
            result.passed = false;
            result.failedRules.push(`BONUS_LIMIT: ₺${withdrawal.Amount} > Max ₺${bonusRule.max_amount}`);
        }

        // 3. Check Fixed Withdrawal Amount
        if (bonusRule.fixed_withdrawal_amount > 0 && withdrawal.Amount > bonusRule.fixed_withdrawal_amount) {
            result.passed = false;
            result.failedRules.push(`BONUS_FIXED: ₺${withdrawal.Amount} > Sabit Limit ₺${bonusRule.fixed_withdrawal_amount}`);
        }

        // 4. Check Min Balance Limit (balance + withdrawal must be >= limit)
        if (bonusRule.min_balance_limit > 0) {
            // Note: We need clientDetails for this - will be checked at approval time
            // For now, add a marker that this check is required
            result.passedRules.push(`MIN_BALANCE_CHECK: Onay sırasında ₺${bonusRule.min_balance_limit} bakiye kontrolü yapılacak`);
        }

        // 5. Check max_remaining_balance (snapshot'tan mevcut bakiye kontrolü)
        if (bonusRule.max_remaining_balance !== undefined && bonusRule.max_remaining_balance >= 0) {
            // This will be checked at approval time with fresh balance
            result.passedRules.push(`MAX_REMAINING_CHECK: Onay sırasında max ₺${bonusRule.max_remaining_balance} kalan bakiye kontrolü yapılacak`);
        }

        // 6. Check require_deposit_id (bonus notlarında yatırım ID olmalı)
        if (bonusRule.require_deposit_id) {
            const bonusNotes = snapshot?.turnover?.deposit?.Notes || snapshot?.turnover?.deposit?.Warning || '';
            // Look for deposit ID pattern (typically a long number)
            const hasDepositId = /\d{10,}/.test(bonusNotes);
            if (hasDepositId) {
                result.passedRules.push('DEPOSIT_ID: Bonus notlarında yatırım ID bulundu');
            } else {
                result.passed = false;
                result.failedRules.push('DEPOSIT_ID: Bonus notlarında yatırım ID bulunamadı');
            }
        }
    } else if (isBonusWithdrawal) {
        // If it's a bonus withdrawal but NO rule matched -> REJECT
        result.passed = false;
        result.failedRules.push('BONUS_RULE: Tanımlı bonus kuralı bulunamadı (Default Reject)');
    } else if (withdrawalType === 'CASHBACK') {
        // CASHBACK also requires a matching rule (until cashback rules are defined)
        if (!bonusRule) {
            result.passed = false;
            result.failedRules.push('CASHBACK_RULE: Tanımlı cashback kuralı bulunamadı (Default Reject)');
        }
    }

    // 1. MAX_AMOUNT - Check withdrawal amount (Global)
    if (rules.MAX_AMOUNT?.enabled) {
        const maxAmount = parseFloat(rules.MAX_AMOUNT.value) || 5000;
        if (withdrawal.Amount <= maxAmount) {
            result.passedRules.push(`MAX_AMOUNT: ₺${withdrawal.Amount} <= ₺${maxAmount}`);
        } else {
            result.passed = false;
            result.failedRules.push(`MAX_AMOUNT: ₺${withdrawal.Amount} > ₺${maxAmount}`);
        }
    }

    // 2. MAX_WITHDRAWAL_RATIO - Check if withdrawal > Nx deposit amount
    if (rules.MAX_WITHDRAWAL_RATIO?.enabled) {
        const ignoreDeposit = bonusRule?.ignore_deposit_rule;

        if (isBonusWithdrawal) {
            if (!ignoreDeposit) {
                result.passed = false;
                result.failedRules.push('MAX_WITHDRAWAL_RATIO: Bonus/FreeSpin çekimi - Yatırım bulunamadı (Oran hesaplanamaz)');
            } else {
                result.passedRules.push('MAX_WITHDRAWAL_RATIO: Bonus kuralı nedeniyle yoksayıldı');
            }
        } else if (withdrawalType === 'CASHBACK') {
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
        const ignoreDeposit = bonusRule?.ignore_deposit_rule;
        const depositTime = snapshot?.turnover?.deposit?.time || snapshot?.deposit?.time;

        if (isDepositToday(depositTime)) {
            result.passedRules.push('REQUIRE_DEPOSIT_TODAY: Bugün yatırım mevcut');
        } else {
            if (isBonusWithdrawal && ignoreDeposit) {
                result.passedRules.push('REQUIRE_DEPOSIT_TODAY: Bonus kuralı nedeniyle yoksayıldı');
            } else {
                result.passed = false;
                result.failedRules.push('REQUIRE_DEPOSIT_TODAY: Bugün yatırım bulunamadı');
            }
        }
    }

    // 4. NO_BONUS_AFTER_DEPOSIT - Check bonuses AFTER deposit
    if (rules.NO_BONUS_AFTER_DEPOSIT?.enabled) {
        const bonuses = snapshot?.bonuses || [];
        const depositTime = snapshot?.turnover?.deposit?.time || snapshot?.deposit?.time;

        // Filter bonuses that were given AFTER or AT THE SAME TIME as the deposit
        let bonusesAfterDeposit = bonuses;
        if (depositTime) {
            const depositDate = new Date(depositTime);
            // Subtract 1 minute to handle slight sync issues or same-minute transactions
            const thresholdDate = new Date(depositDate.getTime() - 60000);

            bonusesAfterDeposit = bonuses.filter(b => {
                // Check all possible date fields
                const bonusDate = new Date(b.time || b.createdTime || b.CreateTime || b.AwardedDateLocal || 0);
                return bonusDate >= thresholdDate;
            });
        }

        if (bonusesAfterDeposit.length === 0) {
            result.passedRules.push('NO_BONUS_AFTER_DEPOSIT: Yatırım sonrası bonus yok');
        } else {
            result.passed = false;
            // Add details about found tokens
            const bonusNames = bonusesAfterDeposit.map(b => b.Name || b.name || 'Bilinmeyen Bonus').join(', ');
            result.failedRules.push(`NO_BONUS_AFTER_DEPOSIT: Yatırım sonrası bonus bulundu: ${bonusNames}`);
        }
    }

    // 5. NO_FREESPIN_BONUS - Check for FreeSpin/PayClient transactions AFTER deposit
    if (rules.NO_FREESPIN_BONUS?.enabled) {
        const bonusTx = snapshot?.bonusTransactions?.data || []; // Note: getBonusTransactions returns { data: [] } structure in snapshot?
        // Actually snapshotService puts: bonusTransactions: bonusTxRes (which is { data: [...] })

        // Ensure we access the array
        const transactions = Array.isArray(bonusTx) ? bonusTx : (bonusTx.data || []);

        const depositTime = snapshot?.turnover?.deposit?.time || snapshot?.deposit?.time;

        let relevantTx = transactions;
        if (depositTime) {
            const depositDate = new Date(depositTime);
            // Subtract 1 minute buffer
            const thresholdDate = new Date(depositDate.getTime() - 60000);

            relevantTx = transactions.filter(tx => {
                const txDate = new Date(tx.CreatedLocal || tx.time || 0);
                return txDate >= thresholdDate;
            });
        }

        if (relevantTx.length === 0) {
            result.passedRules.push('NO_FREESPIN_BONUS: Yatırım sonrası FreeSpin/Bonus işlemi yok');
        } else {
            result.passed = false;
            result.failedRules.push(`NO_FREESPIN_BONUS: Yatırım sonrası ${relevantTx.length} adet FreeSpin/Bonus işlemi bulundu`);
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

        // NOTE: We evaluate ALL rules regardless of AUTO_APPROVAL_ENABLED toggle
        // This is SIMULATION MODE - shows what decision WOULD be if system was on
        // Actual BC API approval only happens if toggle is enabled (checked later)
        const isSystemEnabled = rules.AUTO_APPROVAL_ENABLED?.enabled || false;

        // Check for Bonus Rule Match (Dynamic Bonus Management)
        let matchedBonusRule = null;
        const withdrawalType = snapshot?.turnover?.withdrawalType?.type;
        const isBonusOrFreeSpin = withdrawalType === 'BONUS' || withdrawalType === 'FREESPIN';

        // 0. RISK ANALYSIS (Spin Hoarding Detection)
        // Perform risk analysis before rules
        const riskAnalysis = riskService.analyzeRisk(withdrawal, snapshot);
        if (riskAnalysis.isRisky) {
            logger.info(`[AutoApproval] RISK DETECTED for ${withdrawal.Id}:`, riskAnalysis.details);

            // If HIGH risk (significant win without bet), fail immediately
            if (riskAnalysis.totalRiskLevel === 'HIGH') {
                return {
                    approved: false,
                    reason: `RISK TESPİT EDİLDİ: ${riskAnalysis.details.join(', ')}`,
                    ruleResult: {
                        passed: false,
                        failedRules: [`RISK: ${riskAnalysis.details.join(', ')}`],
                        passedRules: []
                    },
                    riskAnalysis,
                    matchedBonusRule
                };
            }
        }

        if (isBonusOrFreeSpin) {
            // Use the "fake" deposit object which contains bonus details (Game, PaymentSystemName, Notes)
            // turnoverService logic puts this info in snapshot.turnover.deposit for bonuses.
            const bonusTransaction = snapshot?.turnover?.deposit || {};
            matchedBonusRule = await bonusRulesService.findMatchingRule(bonusTransaction);

            if (matchedBonusRule) {
                logger.info(`[AutoApproval] Matched Bonus Rule: ${matchedBonusRule.name} (ID: ${matchedBonusRule.id}) for withdrawal ${withdrawal.Id}`);
            } else {
                logger.info(`[AutoApproval] Bonus/FreeSpin withdrawal but NO matching rule found for ${withdrawal.Id}`);
            }
        }

        // Evaluate rules with bonus context
        const ruleResult = evaluateRules(withdrawal, snapshot, rules, matchedBonusRule);

        if (!ruleResult.passed) {
            logger.info(`[AutoApproval] Withdrawal ${withdrawal.Id} failed rules:`, ruleResult.failedRules);
            return {
                approved: false,
                reason: ruleResult.failedRules.join(', '),
                ruleResult,
                matchedBonusRule
            };
        }

        // ALL RULES PASSED!
        // Now check if we should actually call BC API to approve
        if (!isSystemEnabled) {
            logger.info(`[AutoApproval] SIMULATION: Withdrawal ${withdrawal.Id} would be approved, but system is DISABLED`);
            return {
                approved: true,  // Simulation result - shows ONAY in dashboard
                reason: 'Tüm kurallar geçti (Simülasyon - Sistem kapalı, gerçek onay yapılmadı)',
                ruleResult,
                matchedBonusRule,
                simulationOnly: true  // Flag to indicate no actual approval happened
            };
        }

        // System is enabled - proceed with actual approval
        logger.info(`[AutoApproval] Approving withdrawal ${withdrawal.Id}...`);


        // STEP: Handle balance-based bonus rules BEFORE approval
        if (matchedBonusRule) {
            try {
                // Get fresh client balance for balance-based checks
                const clientDetails = await bcClient.getClientById(withdrawal.ClientId);
                const currentBalance = clientDetails?.Balance || 0;
                const totalBalance = currentBalance + withdrawal.Amount;

                logger.info(`[AutoApproval] Client ${withdrawal.ClientId} balance check: current=₺${currentBalance}, withdrawal=₺${withdrawal.Amount}, total=₺${totalBalance}`);

                // Check min_balance_limit (total balance must be >= min_balance_limit)
                if (matchedBonusRule.min_balance_limit > 0) {
                    if (totalBalance < matchedBonusRule.min_balance_limit) {
                        logger.info(`[AutoApproval] Min balance check FAILED: ₺${totalBalance} < ₺${matchedBonusRule.min_balance_limit}`);
                        return {
                            approved: false,
                            reason: `MIN_BALANCE: Toplam bakiye ₺${totalBalance} < Gerekli ₺${matchedBonusRule.min_balance_limit}`,
                            ruleResult: { passed: false, failedRules: [`MIN_BALANCE: ₺${totalBalance} < ₺${matchedBonusRule.min_balance_limit}`] }
                        };
                    }
                    logger.info(`[AutoApproval] Min balance check PASSED: ₺${totalBalance} >= ₺${matchedBonusRule.min_balance_limit}`);
                }

                // Check max_remaining_balance (remaining balance after withdrawal must be <= limit)
                if (matchedBonusRule.max_remaining_balance > 0) {
                    if (currentBalance > matchedBonusRule.max_remaining_balance && !matchedBonusRule.delete_excess_balance) {
                        logger.info(`[AutoApproval] Max remaining check FAILED: ₺${currentBalance} > ₺${matchedBonusRule.max_remaining_balance}`);
                        return {
                            approved: false,
                            reason: `MAX_REMAINING: Kalan bakiye ₺${currentBalance} > Max izin verilen ₺${matchedBonusRule.max_remaining_balance}`,
                            ruleResult: { passed: false, failedRules: [`MAX_REMAINING: ₺${currentBalance} > ₺${matchedBonusRule.max_remaining_balance}`] }
                        };
                    }
                }

                // Handle delete_excess_balance
                if (matchedBonusRule.delete_excess_balance && currentBalance > 0) {
                    logger.info(`[AutoApproval] Deleting excess balance: ₺${currentBalance} for client ${withdrawal.ClientId}`);

                    await bcClient.createClientPaymentDocument({
                        ClientId: withdrawal.ClientId,
                        CurrencyId: 'TRY',
                        DocTypeInt: 4,
                        Amount: currentBalance,
                        Info: `Bonus Fazlası - ${matchedBonusRule.name}`
                    });

                    logger.info(`[AutoApproval] Balance deleted successfully for client ${withdrawal.ClientId}`);
                }
            } catch (balanceError) {
                logger.error(`[AutoApproval] Balance check/deletion failed:`, balanceError.message);
                return {
                    approved: false,
                    reason: `Bakiye işlem hatası: ${balanceError.message}`,
                    ruleResult: { passed: false, failedRules: [`BALANCE_ERROR: ${balanceError.message}`] }
                };
            }
        }

        const bcResponse = await bcClient.payWithdrawalRequest(withdrawal);

        // Log to DB
        await logApproval(withdrawal, ruleResult, bcResponse);

        return {
            approved: true,
            reason: matchedBonusRule?.delete_excess_balance
                ? 'Tüm kurallar geçti, bakiye silindi, otomatik onaylandı'
                : 'Tüm kurallar geçti, otomatik onaylandı',
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
