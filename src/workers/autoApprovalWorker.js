const logger = require('../utils/logger');
const bcClient = require('../services/bcClient');
const snapshotService = require('../services/withdrawalSnapshotService');

class AutoApprovalWorker {
    constructor() {
        this.interval = null;
        this.isRunning = false;
        // Interval in ms (default 60 seconds)
        this.checkInterval = 60 * 1000;
    }

    start() {
        if (this.interval) {
            logger.warn('[AutoApprovalWorker] Already running');
            return;
        }

        logger.info('[AutoApprovalWorker] Starting worker...', { interval: this.checkInterval });

        // Run immediately on start
        this.checkWithdrawals();

        // Then run periodically
        this.interval = setInterval(() => {
            this.checkWithdrawals();
        }, this.checkInterval);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            logger.info('[AutoApprovalWorker] Stopped worker');
        }
    }

    async checkWithdrawals() {
        if (this.isRunning) {
            logger.debug('[AutoApprovalWorker] Skip check - previous run still in progress');
            return;
        }

        this.isRunning = true;

        try {
            // Fetch only NEW withdrawals (State=0)
            const payload = {
                ClientIds: [],
                DocumentTypeIds: [1], // Withdrawal
                States: [0], // New (Wait)
                StartTimeLocal: null,
                EndTimeLocal: null,
                MaxRows: 50, // Limit per batch
                SkeepRows: 0,
                // Add any other necessary filters
            };

            // Using existing method which supports payload override or custom logic?
            // bcClient.getClientWithdrawalRequests uses specific payload structure.
            // Let's call it with default args which fetches recent ones, but we need specifically STATE=0

            // We can reuse getClientWithdrawalRequests but it might fetch Pending (2) as well.
            // Auto-approval usually applies to NEW (0) requests before they are manually processed.
            // If we process Pending (2), we might double-approve? 
            // BC 'PayWithdrawalRequests' creates a payout. If it's already Pending, it might be waiting for provider?
            // Usually 'New' -> 'Approve' -> 'Payout'.

            // Let's use getClientWithdrawalRequests(1, 50) and filter for State === 0?
            const withdrawals = await bcClient.getClientWithdrawalRequests(1, 50);

            const newWithdrawals = withdrawals.filter(w => w.State === 0);

            if (newWithdrawals.length > 0) {
                logger.info(`[AutoApprovalWorker] Found ${newWithdrawals.length} new withdrawals to process`);

                // This triggers snapshot creation AND auto-approval logic for each
                await snapshotService.getDecisionsBatch(newWithdrawals);

                // Also sync statuses to DB to keep everything fresh
                await snapshotService.syncStatuses(newWithdrawals);
            }

        } catch (error) {
            logger.error('[AutoApprovalWorker] Error checking withdrawals:', error.message);
        } finally {
            this.isRunning = false;
        }
    }
}

const worker = new AutoApprovalWorker();
module.exports = worker;
