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
            // Use getWithdrawalRequests with filters
            // Look back 3 days to catch any missed ones/system downtime
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - 3);

            const formatDate = (date) => {
                const dd = String(date.getDate()).padStart(2, '0');
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const yy = String(date.getFullYear()).slice(-2);
                return `${dd}-${mm}-${yy} - 00:00:00`;
            };

            const filters = {
                stateList: [0], // Only New
                fromDate: formatDate(fromDate) // Override default which is just today
            };

            const data = await bcClient.getWithdrawalRequests(filters);

            // Response has ClientRequests array
            const newWithdrawals = data.ClientRequests || [];

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
