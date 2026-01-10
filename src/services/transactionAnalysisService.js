/**
 * Transaction Analysis Service
 * Analyzes transaction history to determine withdrawal type and last financial transaction
 */

const logger = require('../utils/logger');

// Document Type IDs from BC API
const DOC_TYPES = {
    WITHDRAWAL: 1,
    DEPOSIT: 3,
    WITHDRAWAL_REJECTION: 8,
    BET: 10,
    BET_CASHOUT: 14,
    BET_WIN: 15,         // Check Game field: "SportsBook" = sports, "FreeSpin" = freespin, else = casino
    PAY_CLIENT_BONUS: 83,
    CASHBACK: 309
};

/**
 * Identify the type of withdrawal based on last financial transaction
 * @param {Array} transactions - Transaction history (sorted newest first)
 * @param {number} withdrawalAmount - The withdrawal amount being requested
 * @param {number} currentBalance - Current balance at withdrawal time
 * @returns {Object} Withdrawal type analysis
 */
function analyzeWithdrawalType(transactions, withdrawalAmount, currentBalance) {
    if (!transactions || transactions.length === 0) {
        return { type: 'UNKNOWN', reason: 'No transactions found' };
    }

    // Find the last "financial" transaction: Deposit, Cashback, FreeSpin, or Bonus
    for (const tx of transactions) {
        // Cashback
        if (tx.DocumentTypeId === DOC_TYPES.CASHBACK) {
            const isCashbackWithdrawal = checkCashbackWithdrawal(tx, withdrawalAmount, currentBalance);
            if (isCashbackWithdrawal.valid) {
                return {
                    type: 'CASHBACK',
                    amount: tx.Amount,
                    time: tx.CreatedLocal,
                    decision: isCashbackWithdrawal.decision,
                    reason: isCashbackWithdrawal.reason
                };
            }
        }

        // FreeSpin (DocType 15 OR 3 + Game contains "FreeSpin")
        if ((tx.DocumentTypeId === DOC_TYPES.BET_WIN || tx.DocumentTypeId === DOC_TYPES.DEPOSIT) && tx.Game?.toLowerCase().includes('freespin')) {
            const isFsWithdrawal = checkFreeSpinWithdrawal(tx);
            if (isFsWithdrawal) {
                return {
                    type: 'FREESPIN',
                    amount: tx.Amount,
                    time: tx.CreatedLocal,
                    game: tx.Game,
                    balanceBefore: tx.Balance - tx.Amount
                };
            }
        }

        // Pay Client Bonus (DocType 83)
        if (tx.DocumentTypeId === DOC_TYPES.PAY_CLIENT_BONUS) {
            const isBonusWithdrawal = checkBonusWithdrawal(tx);
            if (isBonusWithdrawal) {
                return {
                    type: 'BONUS',
                    amount: tx.Amount,
                    time: tx.CreatedLocal,
                    balanceBefore: tx.Balance - tx.Amount
                };
            }
        }

        // Deposit
        if (tx.DocumentTypeId === DOC_TYPES.DEPOSIT) {
            return {
                type: 'DEPOSIT',
                amount: tx.Amount,
                time: tx.CreatedLocal
            };
        }
    }

    return { type: 'UNKNOWN', reason: 'No financial transaction found' };
}

/**
 * Check if this is a valid Cashback withdrawal
 * Cashback withdrawal: No turnover required, must withdraw full balance
 */
function checkCashbackWithdrawal(tx, withdrawalAmount, currentBalance) {
    // Balance must be < 5 TL (full balance withdrawal)
    if (currentBalance >= 5) {
        return {
            valid: true,
            decision: 'MANUEL',
            reason: `Cashback çekimi - Bakiye 5₺'nin üzerinde (${currentBalance}₺). Tüm bakiye ile gelinmeli.`
        };
    }

    // Check 20x rule: withdrawal amount should not exceed cashback × 20
    const maxAllowed = tx.Amount * 20;
    if (withdrawalAmount > maxAllowed) {
        return {
            valid: true,
            decision: 'MANUEL',
            reason: `Cashback çekimi - Çekim tutarı (${withdrawalAmount}₺) cashback'in 20 katını (${maxAllowed}₺) aşıyor.`
        };
    }

    return {
        valid: true,
        decision: 'ONAY',
        reason: `Cashback çekimi - Tüm bakiye ile gelinmiş, çevrim şartı yok.`
    };
}

/**
 * Check if this is a FreeSpin withdrawal
 * FreeSpin withdrawal: Balance before FreeSpin was < 10 TL
 */
function checkFreeSpinWithdrawal(tx) {
    const balanceBefore = tx.Balance - tx.Amount;
    return balanceBefore < 10;
}

/**
 * Check if this is a Bonus withdrawal
 * Bonus withdrawal: Balance before Bonus was < 10 TL
 */
function checkBonusWithdrawal(tx) {
    const balanceBefore = tx.Balance - tx.Amount;
    return balanceBefore < 10;
}

/**
 * Filter out bet cashouts from transactions for turnover calculation
 * @param {Array} transactions - All transactions
 * @returns {Array} Transactions without cashouts
 */
function excludeBetCashouts(transactions) {
    return transactions.filter(tx => tx.DocumentTypeId !== DOC_TYPES.BET_CASHOUT);
}

/**
 * Get reference point for turnover calculation based on withdrawal type
 * @param {Object} withdrawalType - Result from analyzeWithdrawalType
 * @param {Object} deposit - Last deposit info
 * @returns {Object} Reference point for turnover
 */
function getTurnoverReference(withdrawalType, deposit) {
    switch (withdrawalType.type) {
        case 'CASHBACK':
            // No turnover required for cashback
            return { skipTurnover: true, reason: 'Cashback çekimi - çevrim şartı yok' };
        case 'FREESPIN':
            // Use FreeSpin time as reference
            return { time: withdrawalType.time, type: 'FREESPIN', amount: withdrawalType.amount };
        case 'BONUS':
            // Use Bonus time as reference (or may need custom logic)
            return { time: withdrawalType.time, type: 'BONUS', amount: withdrawalType.amount };
        case 'DEPOSIT':
        default:
            // Standard deposit reference
            return deposit ? { time: deposit.time, type: 'DEPOSIT', amount: deposit.amount } : null;
    }
}

module.exports = {
    DOC_TYPES,
    analyzeWithdrawalType,
    checkCashbackWithdrawal,
    checkFreeSpinWithdrawal,
    checkBonusWithdrawal,
    excludeBetCashouts,
    getTurnoverReference
};
