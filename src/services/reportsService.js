/**
 * Reports Service
 * Aggregates data from BetConstruct API and Local DB for analytics
 */

const db = require('../db/mysql');
const bcClient = require('./bcClient');

/**
 * Get comprehensive stats for a date range
 * Compares actual BC outcome with Auto-Control decisions
 */
async function getStats(startDate, endDate) {
    try {
        // 1. Fetch all withdrawal requests from BC for the range
        // Format dates for BC API ? Usually it expects 'YYYY-MM-DD HH:mm:ss' or 'DD-MM-YY ...'
        // bcClient.getWithdrawalRequests handles formatting if we pass strings or handle it there.
        // But getWithdrawalRequests usually takes 'fromDateLocal' etc.
        // Let's assume the caller passes formatted strings or we default to Today.

        // We'll fetch a wider range if needed, but for "Reports", usually strict dates.
        const filters = {
            fromDate: startDate, // Client should pass correct format: DD-MM-YY - HH:mm:ss
            toDate: endDate
        };

        const bcData = await bcClient.getWithdrawalRequests(filters);
        const withdrawals = bcData.withdrawals || [];

        // 2. Fetch all decisions from DB for the same period (or just matching IDs)
        // Better to fetch matching IDs to be precise, but if list is huge, map might be better.
        // If we have 1000 withdrawals, fetching DB by ID IN (...) is good.
        const withdrawalIds = withdrawals.map(w => w.Id);

        const decisionsMap = new Map();
        if (withdrawalIds.length > 0) {
            const pool = db.getPool();
            if (pool) {
                const [rows] = await pool.query(
                    'SELECT * FROM decisions WHERE withdrawal_id IN (?)',
                    [withdrawalIds]
                );
                rows.forEach(r => decisionsMap.set(r.withdrawal_id, r));
            }
        }

        // 3. Compute Metrics
        const stats = {
            total: withdrawals.length,
            paid: 0,
            rejected: 0,
            botApproved: 0,
            botRejected: 0,
            botManual: 0,
            conflicts: {
                paidButBotRejected: [], // High Risk: Bot said NO, but it was Paid
                rejectedButBotApproved: [] // Potential Loss: Bot said YES, but it was Rejected
            }
        };

        for (const w of withdrawals) {
            const decision = decisionsMap.get(w.Id);

            // Count Status
            // 3: Paid, -2: Rejected, -1: Cancelled
            if (w.State === 3) stats.paid++;
            if (w.State === -2 || w.State === -1) stats.rejected++;

            // Count Bot Decisions
            if (decision) {
                if (decision.decision === 'ONAY') stats.botApproved++;
                else if (decision.decision === 'RET') stats.botRejected++;
                else if (decision.decision === 'MANUEL') stats.botManual++;

                // Analyze Conflicts (Only if final state is set)
                // Conflict 1: Paid (3) BUT Bot said RET
                if (w.State === 3 && decision.decision === 'RET') {
                    stats.conflicts.paidButBotRejected.push({
                        withdrawal: w,
                        decision: decision
                    });
                }

                // Conflict 2: Rejected (-2 or -1) BUT Bot said ONAY
                if ((w.State === -2 || w.State === -1) && decision.decision === 'ONAY') {
                    stats.conflicts.rejectedButBotApproved.push({
                        withdrawal: w,
                        decision: decision
                    });
                }
            }
        }

        return stats;

    } catch (error) {
        console.error('[ReportsService] getStats error:', error);
        throw error;
    }
}

module.exports = {
    getStats
};
