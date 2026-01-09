/**
 * IP Control Service
 * Analyzes login IP addresses and detects multi-account usage
 */

const bcClient = require('./bcClient');
const logger = require('../utils/logger');

/**
 * Get comprehensive IP analysis for a client
 * @param {number} clientId - Client ID to analyze
 * @param {number} days - Number of days to look back (default 7)
 * @returns {Object} IP analysis with multi-account detection
 */
async function getIPAnalysis(clientId, days = 7) {
    try {
        // 1. Get login history for the client
        const logins = await bcClient.getClientLogins(clientId, days);

        if (!logins || logins.length === 0) {
            return {
                success: true,
                totalLogins: 0,
                uniqueIPs: 0,
                hasMultiAccount: false,
                analysis: []
            };
        }

        // 2. Extract unique IPs
        const uniqueIPs = [...new Set(logins.map(l => l.LoginIP))];

        logger.info(`[IPControl] Client ${clientId}: ${logins.length} logins, ${uniqueIPs.length} unique IPs`);

        // 3. For each unique IP, check other accounts
        const analysis = [];

        for (const ip of uniqueIPs) {
            try {
                const clients = await bcClient.getClientsByIP(ip);

                // Filter out the current client
                const otherClients = clients.filter(c => c.ClientId !== clientId);

                // Get login count for this IP
                const ipLogins = logins.filter(l => l.LoginIP === ip);
                const lastLogin = ipLogins[0]; // Most recent

                analysis.push({
                    ip,
                    loginCount: ipLogins.length,
                    lastLoginTime: lastLogin?.StartTimeLocal,
                    source: lastLogin?.SourceName || 'Unknown',
                    otherAccounts: otherClients.map(c => ({
                        clientId: c.ClientId,
                        login: c.Login,
                        loginCount: c.Count,
                        registrationDate: c.RegistrationDate,
                        email: c.Email
                    }))
                });
            } catch (err) {
                logger.warn(`[IPControl] Failed to check IP ${ip}:`, err.message);
                analysis.push({
                    ip,
                    loginCount: logins.filter(l => l.LoginIP === ip).length,
                    error: err.message,
                    otherAccounts: []
                });
            }
        }

        // 4. Check if any multi-account detected
        const hasMultiAccount = analysis.some(a => a.otherAccounts.length > 0);
        const totalOtherAccounts = analysis.reduce((sum, a) => sum + a.otherAccounts.length, 0);

        return {
            success: true,
            totalLogins: logins.length,
            uniqueIPs: uniqueIPs.length,
            hasMultiAccount,
            totalOtherAccounts,
            analysis
        };

    } catch (error) {
        logger.error('[IPControl] Analysis failed:', error.message);
        return {
            success: false,
            error: error.message,
            totalLogins: 0,
            uniqueIPs: 0,
            hasMultiAccount: false,
            analysis: []
        };
    }
}

module.exports = {
    getIPAnalysis
};
