/**
 * Withdrawal Snapshot Service
 * Captures and stores ALL detail page data at the moment of bot analysis
 * Implements the "Snapshot + Sync" architecture
 */

const db = require('../db/mysql');
const logger = require('../utils/logger');
const turnoverService = require('./turnoverService');
const bonusService = require('./bonusService');
const sportsService = require('./sportsService');
const ipControlService = require('./ipControlService');

/**
 * Get a withdrawal snapshot from DB
 * @param {number} withdrawalId - Withdrawal ID
 * @returns {Object|null} Snapshot data or null if not found
 */
async function getSnapshot(withdrawalId) {
    const pool = db.getPool();
    if (!pool) return null;

    try {
        const [rows] = await pool.query(
            'SELECT * FROM withdrawals WHERE id = ?',
            [withdrawalId]
        );

        if (rows.length === 0) return null;

        const row = rows[0];
        return {
            success: true,
            fromDB: true,
            withdrawal: {
                id: row.id,
                clientId: row.client_id,
                clientLogin: row.client_login,
                amount: row.amount,
                status: row.status,
                paymentMethod: row.payment_method,
                requestTime: row.request_time
            },
            botDecision: row.bot_decision,
            decisionReason: row.decision_reason,
            withdrawalType: row.withdrawal_type,
            turnover: row.turnover_data ? JSON.parse(row.turnover_data) : null,
            sports: row.sports_data ? JSON.parse(row.sports_data) : null,
            bonuses: row.bonuses_data ? JSON.parse(row.bonuses_data) : null,
            bonusTransactions: row.bonus_transactions ? JSON.parse(row.bonus_transactions) : null,
            ipAnalysis: row.ip_analysis ? JSON.parse(row.ip_analysis) : null,
            clientData: row.client_data ? JSON.parse(row.client_data) : null,
            checkedAt: row.checked_at
        };
    } catch (error) {
        logger.error('[SnapshotService] getSnapshot error:', error.message);
        return null;
    }
}

/**
 * Check if a snapshot exists for a withdrawal
 * @param {number} withdrawalId - Withdrawal ID
 * @returns {boolean} True if snapshot exists
 */
async function hasSnapshot(withdrawalId) {
    const pool = db.getPool();
    if (!pool) return false;

    try {
        const [rows] = await pool.query(
            'SELECT 1 FROM withdrawals WHERE id = ? LIMIT 1',
            [withdrawalId]
        );
        return rows.length > 0;
    } catch (error) {
        return false;
    }
}

/**
 * Create a full snapshot of withdrawal data
 * Captures ALL detail page data from BC APIs and stores in DB
 * 
 * @param {Object} withdrawal - BC withdrawal object
 * @returns {Object} The created snapshot
 */
async function createSnapshot(withdrawal) {
    const pool = db.getPool();
    if (!pool) {
        logger.warn('[SnapshotService] No database connection');
        return { success: false, error: 'No database' };
    }

    const clientId = withdrawal.ClientId;
    const withdrawalId = withdrawal.Id;

    logger.info(`[SnapshotService] Creating snapshot for withdrawal ${withdrawalId}`);

    try {
        // Get bcClient for client details
        const bcClient = require('./bcClient');

        // Fetch ALL data in parallel (same APIs as detail page)
        const [turnoverRes, bonusesRes, sportsRes, bonusTxRes, ipRes, clientRes, kpiRes] = await Promise.all([
            turnoverService.getTurnoverReport(clientId, null, withdrawal.Amount, withdrawal.Balance),
            bonusService.getLastBonuses(clientId, 5),
            fetchSportsData(clientId),
            fetchBonusTransactions(clientId),
            ipControlService.getIPAnalysis(clientId, 7),
            bcClient.getClientById(clientId),
            bcClient.getClientKpi(clientId)
        ]);

        // Extract initial decision from turnover report
        let botDecision = turnoverRes.decision || 'MANUEL';
        let decisionReason = turnoverRes.decisionReason || '';
        const withdrawalType = turnoverRes.withdrawalType?.type || 'DEPOSIT';

        // Perform RISK ANALYSIS (Spin Hoarding Detection)
        const riskService = require('./riskService');
        const snapshotDataForRisk = { turnover: turnoverRes };
        const riskAnalysis = riskService.analyzeRisk(withdrawal, snapshotDataForRisk);

        // Add risk analysis to turnover data
        turnoverRes.decisionData = {
            riskAnalysis: {
                isRisky: riskAnalysis.isRisky,
                riskLevel: riskAnalysis.totalRiskLevel,
                details: riskAnalysis.hoarding?.details || [],
                suspiciousWins: riskAnalysis.suspiciousWins || []
            }
        };

        // If HIGH risk, update decision
        if (riskAnalysis.isRisky && riskAnalysis.totalRiskLevel === 'HIGH') {
            botDecision = 'MANUEL';
            decisionReason = `RİSK TESPİT: ${riskAnalysis.hoarding?.details?.join(', ') || 'Spin gömme şüphesi'}`;
            logger.info(`[SnapshotService] HIGH RISK detected for ${withdrawalId}:`, riskAnalysis);
        }

        // RULE ENGINE CHECK - Run auto-approval evaluation BEFORE saving to DB
        let autoApprovalResult = null;
        if (botDecision === 'ONAY') {
            try {
                const autoApprovalService = require('./autoApprovalService');
                const snapshotData = {
                    turnover: turnoverRes,
                    bonuses: bonusesRes,
                    bonusTransactions: bonusTxRes,
                    sports: sportsRes,
                    ipAnalysis: ipRes
                };
                autoApprovalResult = await autoApprovalService.processAutoApproval(withdrawal, snapshotData);
                logger.info(`[SnapshotService] Auto-approval result for ${withdrawalId}:`, JSON.stringify(autoApprovalResult));

                // Save rule evaluation details to decisionData for Decision Summary display
                turnoverRes.decisionData = turnoverRes.decisionData || {};
                turnoverRes.decisionData.ruleEvaluation = {
                    approved: autoApprovalResult.approved,
                    reason: autoApprovalResult.reason,
                    passedRules: autoApprovalResult.ruleResult?.passedRules || [],
                    failedRules: autoApprovalResult.ruleResult?.failedRules || [],
                    matchedBonusRule: autoApprovalResult.matchedBonusRule?.name || null
                };

                // CRITICAL: Update botDecision based on rule engine result
                if (!autoApprovalResult.approved) {
                    botDecision = 'MANUEL';
                    decisionReason = autoApprovalResult.reason || 'Kural motoru reddetti';
                    logger.info(`[SnapshotService] Decision changed to MANUEL for ${withdrawalId}: ${decisionReason}`);
                }
            } catch (autoErr) {
                logger.error(`[SnapshotService] Auto-approval error for ${withdrawalId}:`, autoErr.message);
                botDecision = 'MANUEL';
                decisionReason = `Kural kontrolü hatası: ${autoErr.message}`;

                // Save error to decisionData
                turnoverRes.decisionData = turnoverRes.decisionData || {};
                turnoverRes.decisionData.ruleEvaluation = {
                    approved: false,
                    reason: decisionReason,
                    passedRules: [],
                    failedRules: [`ERROR: ${autoErr.message}`],
                    matchedBonusRule: null
                };
            }
        } else {
            // Decision was already MANUEL or RET from turnover check
            turnoverRes.decisionData = turnoverRes.decisionData || {};
            turnoverRes.decisionData.ruleEvaluation = {
                approved: false,
                reason: decisionReason,
                passedRules: [],
                failedRules: [`TURNOVER: ${decisionReason}`],
                matchedBonusRule: null,
                skippedReason: 'Çevrim kontrolü başarısız olduğu için kural motoru atlandı'
            };
        }

        // CRITICAL: Sync turnoverRes.decision with final botDecision
        // This ensures detail page shows same decision as list page
        turnoverRes.decision = botDecision;
        turnoverRes.decisionReason = decisionReason;

        // Prepare client data with full details (including KPI)
        const clientData = {
            balance: withdrawal.Balance,
            clientId,
            // From getClientById response
            currentBalance: clientRes?.Balance,
            isVerified: clientRes?.IsVerified,
            birthDate: clientRes?.BirthDate,
            age: clientRes?.BirthDate ? calculateAge(clientRes.BirthDate) : null,
            firstName: clientRes?.FirstName,
            lastName: clientRes?.LastName,
            btag: clientRes?.BTag,
            isLocked: clientRes?.IsLocked,
            isNoBonus: clientRes?.IsNoBonus,
            // From getClientKpi response
            kpi: {
                depositAmount: kpiRes?.DepositAmount,
                depositCount: kpiRes?.DepositCount,
                withdrawalAmount: kpiRes?.WithdrawalAmount,
                withdrawalCount: kpiRes?.WithdrawalCount,
                lastWithdrawalAmount: kpiRes?.LastWithdrawalAmount,
                lastWithdrawalTime: kpiRes?.LastWithdrawalTimeLocal,
                totalSportBets: kpiRes?.TotalSportBets,
                totalUnsettledBets: kpiRes?.TotalUnsettledBets
            }
        };


        await pool.query(`
            INSERT INTO withdrawals (
                id, client_id, client_login, amount, status, payment_method, request_time,
                bot_decision, decision_reason, withdrawal_type,
                withdrawal_data, client_data, turnover_data, sports_data, 
                bonuses_data, bonus_transactions, ip_analysis, checked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                updated_at = NOW()
        `, [
            withdrawalId,
            clientId,
            withdrawal.ClientLogin || null,
            withdrawal.Amount,
            withdrawal.State,
            withdrawal.PaymentSystemName || null,
            withdrawal.RequestTimeLocal ? new Date(withdrawal.RequestTimeLocal) : null,
            botDecision,
            decisionReason,
            withdrawalType,
            JSON.stringify(withdrawal),
            JSON.stringify(clientData),
            JSON.stringify(turnoverRes),
            JSON.stringify(sportsRes),
            JSON.stringify(bonusesRes),
            JSON.stringify(bonusTxRes),
            JSON.stringify(ipRes)
        ]);

        logger.info(`[SnapshotService] Snapshot created: withdrawal=${withdrawalId}, decision=${botDecision}`);

        return {
            success: true,
            decision: botDecision,
            reason: decisionReason,
            withdrawalType,
            fromCache: false,
            autoApproval: autoApprovalResult
        };
    } catch (error) {
        logger.error('[SnapshotService] createSnapshot error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Sync status for multiple withdrawals from BC to DB
 * Only updates the status column, not the snapshot data
 * 
 * @param {Array} withdrawals - Array of BC withdrawal objects
 */
async function syncStatuses(withdrawals) {
    const pool = db.getPool();
    if (!pool || !withdrawals || withdrawals.length === 0) return;

    try {
        for (const w of withdrawals) {
            await pool.query(
                'UPDATE withdrawals SET status = ?, updated_at = NOW() WHERE id = ?',
                [w.State, w.Id]
            );
        }
        logger.debug(`[SnapshotService] Synced status for ${withdrawals.length} withdrawals`);
    } catch (error) {
        logger.error('[SnapshotService] syncStatuses error:', error.message);
    }
}

/**
 * Get decisions for multiple withdrawals in batch
 * Processes SEQUENTIALLY with rate limit handling
 * Returns from DB if exists, creates snapshot if new
 * 
 * @param {Array} withdrawals - Array of BC withdrawal objects
 * @returns {Object} Map of withdrawalId -> decision data
 */
async function getDecisionsBatch(withdrawals) {
    const results = {};
    const pool = db.getPool();

    if (!pool) {
        logger.warn('[SnapshotService] No database - returning empty');
        return results;
    }

    // Get all withdrawal IDs
    const withdrawalIds = withdrawals.map(w => w.Id);
    if (withdrawalIds.length === 0) return results;

    try {
        // Check which ones exist in DB
        const [existingRows] = await pool.query(
            'SELECT id, bot_decision, decision_reason, withdrawal_type, checked_at FROM withdrawals WHERE id IN (?)',
            [withdrawalIds]
        );

        const existingMap = new Map(existingRows.map(r => [r.id, r]));

        // Process each withdrawal SEQUENTIALLY
        // Sort by request time (oldest first)
        const sortedWithdrawals = [...withdrawals].sort(
            (a, b) => new Date(a.RequestTimeLocal) - new Date(b.RequestTimeLocal)
        );

        for (const w of sortedWithdrawals) {
            const existing = existingMap.get(w.Id);

            if (existing) {
                // Return existing decision from DB (immutable snapshot)
                results[w.Id] = {
                    decision: existing.bot_decision,
                    reason: existing.decision_reason,
                    withdrawalType: existing.withdrawal_type,
                    fromCache: true,
                    checkedAt: existing.checked_at
                };
                continue;
            }

            // Only create snapshot for "New" state items
            if (w.State !== 0) continue;

            // Create snapshot with retry logic for rate limits
            logger.info(`[SnapshotService] Processing withdrawal ${w.Id} (${w.ClientLogin})`);

            const snapshot = await createSnapshotWithRetry(w, 3);

            if (snapshot.success) {
                results[w.Id] = {
                    decision: snapshot.decision,
                    reason: snapshot.reason,
                    withdrawalType: snapshot.withdrawalType,
                    fromCache: false,
                    autoApproved: snapshot.autoApproval?.approved || false
                };
            } else {
                // Failed to create snapshot - save MANUEL decision with error message
                const errorReason = `Kontrol başarısız: ${snapshot.error || 'Bilinmeyen hata'}`;
                logger.warn(`[SnapshotService] Saving MANUEL for ${w.Id}: ${errorReason}`);

                // Save to DB so it doesn't stay loading forever
                await saveFailedSnapshot(w, errorReason);

                results[w.Id] = {
                    decision: 'MANUEL',
                    reason: errorReason,
                    withdrawalType: 'UNKNOWN',
                    fromCache: false,
                    failed: true
                };
            }

            // Small delay between API calls to avoid rate limiting
            await sleep(500);
        }

        return results;
    } catch (error) {
        logger.error('[SnapshotService] getDecisionsBatch error:', error.message);
        return results;
    }
}

/**
 * Create snapshot with retry logic for rate limits
 * @param {Object} withdrawal - BC withdrawal object
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Object} Snapshot result
 */
async function createSnapshotWithRetry(withdrawal, maxRetries = 3) {
    const tokenService = require('./tokenService');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await createSnapshot(withdrawal);
            return result;
        } catch (error) {
            const isRateLimit = error.message?.includes('rate') ||
                error.message?.includes('429') ||
                error.message?.includes('Too Many') ||
                error.response?.status === 429;

            const isAuthError = error.response?.status === 401 ||
                error.response?.status === 403;

            if (isRateLimit || isAuthError) {
                logger.warn(`[SnapshotService] Rate limit or auth error on attempt ${attempt}/${maxRetries}`);

                if (isAuthError) {
                    // Refresh token and retry
                    logger.info('[SnapshotService] Refreshing token...');
                    await tokenService.refreshToken();
                }

                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    const waitTime = Math.min(5000 * attempt, 15000);
                    logger.info(`[SnapshotService] Waiting ${waitTime}ms before retry...`);
                    await sleep(waitTime);
                    continue;
                }
            }

            // Non-retryable error or max retries reached
            logger.error(`[SnapshotService] createSnapshotWithRetry failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    return { success: false, error: 'Max retries reached' };
}

/**
 * Save a failed snapshot as MANUEL decision
 * This ensures the item doesn't stay in loading state forever
 */
async function saveFailedSnapshot(withdrawal, errorReason) {
    const pool = db.getPool();
    if (!pool) return;

    try {
        await pool.query(`
            INSERT INTO withdrawals (
                id, client_id, client_login, amount, status, payment_method, request_time,
                bot_decision, decision_reason, withdrawal_type,
                withdrawal_data, checked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'MANUEL', ?, 'UNKNOWN', ?, NOW())
            ON DUPLICATE KEY UPDATE
                bot_decision = 'MANUEL',
                decision_reason = VALUES(decision_reason),
                updated_at = NOW()
        `, [
            withdrawal.Id,
            withdrawal.ClientId,
            withdrawal.ClientLogin || null,
            withdrawal.Amount,
            withdrawal.State,
            withdrawal.PaymentSystemName || null,
            withdrawal.RequestTimeLocal ? new Date(withdrawal.RequestTimeLocal) : null,
            errorReason,
            JSON.stringify(withdrawal)
        ]);

        logger.info(`[SnapshotService] Saved failed snapshot for ${withdrawal.Id}`);
    } catch (error) {
        logger.error(`[SnapshotService] saveFailedSnapshot error: ${error.message}`);
    }
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate) {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// Helper: Fetch sports data
async function fetchSportsData(clientId) {
    try {
        const transactions = await turnoverService.getClientTransactions(clientId, 2);
        const deposit = turnoverService.findLastDeposit(transactions);
        if (!deposit) return { success: false, bets: [] };
        return await sportsService.getSportsReport(clientId, deposit.CreatedLocal);
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Helper: Fetch bonus transactions (FreeSpin + Pay Client Bonus + Corrections after deposit)
async function fetchBonusTransactions(clientId) {
    try {
        const transactions = await turnoverService.getClientTransactions(clientId, 2);
        const deposit = turnoverService.findLastDeposit(transactions);
        const depositTime = deposit ? new Date(deposit.CreatedLocal) : new Date(0);

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
                balance: tx.Balance,
                time: tx.CreatedLocal,
                balanceBefore: tx.Balance - tx.Amount,
                userName: tx.UserName,
                note: tx.Note
            };
        });

        return { success: true, data: bonusTx };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    getSnapshot,
    hasSnapshot,
    createSnapshot,
    syncStatuses,
    getDecisionsBatch
};
