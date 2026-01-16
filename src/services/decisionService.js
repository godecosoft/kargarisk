/**
 * Decision Service
 * Manages auto-control decisions with database persistence
 * Now aligned with autoApprovalService logic (Rule Engine + Bonus Rules + Risk)
 */

const db = require('../db/mysql');
const turnoverService = require('./turnoverService');
const sportsService = require('./sportsService');
const autoApprovalService = require('./autoApprovalService');
const bonusRulesService = require('./bonusRulesService');
const riskService = require('./riskService');

/**
 * Get decision for a withdrawal
 * Returns cached decision if exists and deposit hasn't changed
 */
async function getDecision(withdrawalId, clientId) {
    try {
        const pool = db.getPool();
        if (!pool) {
            // No database - calculate on the fly
            return await calculateDecision(clientId, null);
        }

        // Check if decision exists
        const [rows] = await pool.query(
            'SELECT * FROM decisions WHERE withdrawal_id = ?',
            [withdrawalId]
        );

        if (rows.length > 0) {
            const existing = rows[0];

            // Check if deposit changed (would require recalculation)
            const currentDeposit = await turnoverService.getLastDeposit(clientId);
            const depositChanged = currentDeposit &&
                existing.deposit_time &&
                new Date(currentDeposit.time).getTime() !== new Date(existing.deposit_time).getTime();

            if (!depositChanged) {
                // Return cached decision
                return {
                    decision: existing.decision,
                    reason: existing.decision_reason,
                    fromCache: true,
                    checkedAt: existing.checked_at
                };
            }
        }

        // Calculate new decision
        // Note: We don't have full withdrawal object here easily, passing null for now
        // Ideally getDecision should take full withdrawal object too, but for backward compat
        // we'll fetch details if needed, or simply let batch API handle the main flow.
        return await calculateAndSaveDecision(withdrawalId, clientId, null, null);
    } catch (error) {
        console.error('[DecisionService] getDecision error:', error.message || error);
        // Fallback to calculation without saving
        return await calculateDecision(clientId, null);
    }
}

/**
 * Get decisions for multiple withdrawals in batch
 */
async function getDecisionsBatch(withdrawals) {
    const results = {};

    try {
        const pool = db.getPool();

        if (!pool) {
            // No database - calculate all
            for (const w of withdrawals) {
                if (w.State === 0) { // Only for "New" status
                    const decision = await calculateDecision(w.ClientId, w.Amount);
                    results[w.Id] = decision;
                }
            }
            return results;
        }

        // Get all requested IDs to check against DB (regardless of state)
        // This ensures we return historical decisions for Paid/Rejected items
        const withdrawalIds = withdrawals.map(w => w.Id);

        if (withdrawalIds.length === 0) {
            return results;
        }

        const [existingRows] = await pool.query(
            'SELECT * FROM decisions WHERE withdrawal_id IN (?)',
            [withdrawalIds]
        );

        const existingMap = new Map(existingRows.map(r => [r.withdrawal_id, r]));

        // Process each withdrawal
        for (const w of withdrawals) {
            const existing = existingMap.get(w.Id);

            if (existing) {
                // If decision exists in DB, ALWAYS return it (persistence)
                // We do NOT check for deposit changes or recalculate for non-New items
                // This preserves the "snapshot" of the decision at the time it was made

                // Optional: For 'New' items only, we might want to check if data is stale,
                // but user emphasized "bir kere yazıldıktan sonra...". 
                // So we favor the DB record.

                results[w.Id] = {
                    decision: existing.decision,
                    reason: existing.decision_reason,
                    fromCache: true,
                    checkedAt: existing.checked_at
                };
                continue;
            }

            // If NOT in DB, only calculate if State is 'New' (0)
            // We do not waste API calls on finished items
            if (w.State === 0) {
                // Calculate and save new decision
                // Pass full withdrawal object for audit logging
                const decision = await calculateAndSaveDecision(w.Id, w.ClientId, w.Amount, w);
                results[w.Id] = decision;
            }
        }

        return results;
    } catch (error) {
        console.error('[DecisionService] getDecisionsBatch error:', error.message || error);
        return results;
    }
}

/**
 * Calculate decision based on turnover, sports data, Rule Engine and Bonus Rules
 * This simulates the full auto-approval logic WITHOUT actually calling BC API
 */
async function calculateDecision(clientId, withdrawalAmount, withdrawalObject = null) {
    try {
        // Get turnover report
        const turnoverReport = await turnoverService.getTurnoverReport(clientId);
        turnoverReport.fullReport = true;

        // Get sports report for pre-deposit winning check
        let sportsReport = null;
        try {
            sportsReport = await sportsService.getSportsReport(
                clientId,
                turnoverReport.deposit?.time
            );
        } catch (e) {
            console.log('[DecisionService] Sports check skipped:', e.message);
        }

        // Start with turnover decision
        let decision = turnoverReport.decision || 'MANUEL';
        let reason = turnoverReport.decisionReason || 'Hesaplanamadı';
        let ruleDetails = [];

        // Override to MANUEL if pre-deposit winning found
        if (sportsReport?.hasPreDepositWinning) {
            decision = 'MANUEL';
            reason = 'Yatırım öncesi kazançlı spor kuponu tespit edildi';
        }

        // If turnover says ONAY, run full auto-approval simulation
        // NOTE: We evaluate rules REGARDLESS of AUTO_APPROVAL_ENABLED toggle
        // This lets us see what decision WOULD be, even if auto-approval is off
        if (decision === 'ONAY') {
            try {
                // Get auto-approval rules
                const rules = await autoApprovalService.getRules();

                // Fetch bonus data for complete rule evaluation
                let bonuses = [];
                let bonusTransactions = { data: [] };

                try {
                    // Get last bonuses (for NO_BONUS_AFTER_DEPOSIT rule)
                    const bonusService = require('./bonusService');
                    bonuses = await bonusService.getLastBonuses(clientId, 5) || [];

                    // Get transactions to extract FreeSpin/Bonus transactions
                    const transactions = await turnoverService.getClientTransactions(clientId, 2);
                    const depositTime = turnoverReport.deposit?.time
                        ? new Date(turnoverReport.deposit.time)
                        : new Date(0);

                    // Filter FreeSpin, Bonus, and Correction transactions after deposit
                    const bonusTx = transactions.filter(tx => {
                        const txTime = new Date(tx.CreatedLocal);
                        if (txTime <= depositTime) return false;
                        // FreeSpin (DocumentTypeId 15 with 'freespin' in Game)
                        if (tx.DocumentTypeId === 15 && tx.Game?.toLowerCase().includes('freespin')) return true;
                        // Pay Client Bonus (DocumentTypeId 83)
                        if (tx.DocumentTypeId === 83) return true;
                        // Correction Up (DocumentTypeId 301)
                        if (tx.DocumentTypeId === 301) return true;
                        // Correction Down (DocumentTypeId 302)
                        if (tx.DocumentTypeId === 302) return true;
                        return false;
                    }).map(tx => {
                        let type = 'UNKNOWN';
                        if (tx.DocumentTypeId === 83) type = 'BONUS';
                        else if (tx.DocumentTypeId === 15) type = 'FREESPIN';
                        else if (tx.DocumentTypeId === 301) type = 'CORRECTION_UP';
                        else if (tx.DocumentTypeId === 302) type = 'CORRECTION_DOWN';

                        return {
                            type,
                            game: tx.Game,
                            amount: tx.Amount,
                            time: tx.CreatedLocal,
                            CreatedLocal: tx.CreatedLocal,
                            userName: tx.UserName,
                            note: tx.Note
                        };
                    });

                    bonusTransactions = { data: bonusTx };
                } catch (bonusErr) {
                    console.log('[DecisionService] Bonus fetch skipped:', bonusErr.message);
                }

                // Build snapshot-like object for rule evaluation
                const snapshotData = {
                    turnover: turnoverReport,
                    bonuses: bonuses,
                    bonusTransactions: bonusTransactions,
                    sports: sportsReport
                };

                // Build withdrawal-like object
                const withdrawal = withdrawalObject || {
                    Id: 0,
                    ClientId: clientId,
                    Amount: withdrawalAmount || 0
                };

                // RISK ANALYSIS
                const riskAnalysis = riskService.analyzeRisk(withdrawal, snapshotData);
                if (riskAnalysis.isRisky && riskAnalysis.totalRiskLevel === 'HIGH') {
                    decision = 'MANUEL';
                    reason = `RISK TESPİT: ${riskAnalysis.details?.join(', ') || 'Spin gömme şüphesi'}`;
                    ruleDetails.push(`RISK: ${riskAnalysis.totalRiskLevel}`);
                } else {
                    // CHECK BONUS RULES (if applicable)
                    const withdrawalType = turnoverReport.withdrawalType?.type;
                    const isBonusOrFreeSpin = withdrawalType === 'BONUS' || withdrawalType === 'FREESPIN';
                    let matchedBonusRule = null;

                    if (isBonusOrFreeSpin) {
                        const bonusTransaction = turnoverReport.deposit || {};
                        matchedBonusRule = await bonusRulesService.findMatchingRule(bonusTransaction);

                        if (!matchedBonusRule) {
                            decision = 'MANUEL';
                            reason = 'Tanımlı bonus kuralı bulunamadı';
                            ruleDetails.push('BONUS_RULE: Eşleşen kural yok');
                        }
                    }

                    // EVALUATE RULES (only if still ONAY)
                    if (decision === 'ONAY') {
                        const ruleResult = autoApprovalService.evaluateRules(
                            withdrawal,
                            snapshotData,
                            rules,
                            matchedBonusRule
                        );

                        if (!ruleResult.passed) {
                            decision = 'MANUEL';
                            reason = ruleResult.failedRules.join(', ');
                            ruleDetails = ruleResult.failedRules;
                        } else {
                            ruleDetails = ruleResult.passedRules;
                        }
                    }
                }
            } catch (ruleError) {
                console.error('[DecisionService] Rule evaluation error:', ruleError.message);
                // Don't change decision on rule error, just log
                ruleDetails.push(`RULE_ERROR: ${ruleError.message}`);
            }
        }

        return {
            decision,
            reason,
            fromCache: false,
            turnover: turnoverReport.turnover,
            deposit: turnoverReport.deposit,
            hasPreDepositWin: sportsReport?.hasPreDepositWinning || false,
            ruleDetails,
            turnoverReport: turnoverReport,
            sportsReport: sportsReport
        };
    } catch (error) {
        console.error('[DecisionService] calculateDecision error:', error.message);
        return {
            decision: 'MANUEL',
            reason: 'Hesaplama hatası: ' + error.message,
            fromCache: false
        };
    }
}

/**
 * Calculate and save decision to database
 */
/**
 * Calculate and save decision to database
 */
async function calculateAndSaveDecision(withdrawalId, clientId, withdrawalAmount, withdrawalObject = null) {
    const result = await calculateDecision(clientId, withdrawalAmount);

    try {
        const pool = db.getPool();
        if (!pool) return result;

        await pool.query(`
            INSERT INTO decisions (
                withdrawal_id, client_id, decision, decision_reason,
                deposit_amount, deposit_time,
                turnover_casino, turnover_sports, turnover_required, turnover_percentage,
                has_pre_deposit_win, withdrawal_amount, 
                withdrawal_data, turnover_data,
                checked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                decision = VALUES(decision),
                decision_reason = VALUES(decision_reason),
                deposit_amount = VALUES(deposit_amount),
                deposit_time = VALUES(deposit_time),
                turnover_casino = VALUES(turnover_casino),
                turnover_sports = VALUES(turnover_sports),
                turnover_required = VALUES(turnover_required),
                turnover_percentage = VALUES(turnover_percentage),
                has_pre_deposit_win = VALUES(has_pre_deposit_win),
                withdrawal_amount = VALUES(withdrawal_amount),
                withdrawal_data = VALUES(withdrawal_data),
                turnover_data = VALUES(turnover_data),
                checked_at = NOW()
        `, [
            withdrawalId,
            clientId,
            result.decision,
            result.reason,
            result.deposit?.amount || null,
            result.deposit?.time ? new Date(result.deposit.time) : null,
            result.turnover?.casino?.amount || 0,
            result.turnover?.sports?.amount || 0,
            result.turnover?.required || 0,
            result.turnover?.total?.percentage || 0,
            result.hasPreDepositWin || false,
            withdrawalAmount,
            withdrawalObject ? JSON.stringify(withdrawalObject) : null,
            JSON.stringify({ turnover: result.turnoverReport, sports: result.sportsReport })
        ]);

        console.log(`[DecisionService] Karar kaydedildi: withdrawal=${withdrawalId}, decision=${result.decision}`);
    } catch (error) {
        console.error('[DecisionService] Save error:', error.message);
    }

    return result;
}

/**
 * Get decision history for a client
 */
async function getClientHistory(clientId, limit = 20) {
    try {
        const pool = db.getPool();
        if (!pool) return [];

        const [rows] = await pool.query(`
            SELECT * FROM decisions 
            WHERE client_id = ? 
            ORDER BY checked_at DESC 
            LIMIT ?
        `, [clientId, limit]);

        return rows;
    } catch (error) {
        console.error('[DecisionService] getClientHistory error:', error.message);
        return [];
    }
}

module.exports = {
    getDecision,
    getDecisionsBatch,
    calculateDecision,
    getClientHistory
};
