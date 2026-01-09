/**
 * Environment Configuration
 * Credentials buradan yönetilir - production'da environment variables kullanın
 */

const config = {
    // BetConstruct Credentials
    BC_EMAIL: process.env.BC_EMAIL || 'aynurozdekir86322@gmail.com',
    BC_PASSWORD: process.env.BC_PASSWORD || 'cn4TLPXNMMAH@',
    BC_2FA_SECRET: process.env.BC_2FA_SECRET || 'VPLCBHKKXFO6OE2Z7FBKBUU2KMH7LLBM',
    BC_DOMAIN: process.env.BC_DOMAIN || 'www.accounts-bc.com',

    // Token Settings
    TOKEN_REFRESH_INTERVAL: parseInt(process.env.TOKEN_REFRESH_INTERVAL) || 1500000, // 25 dakika
    TOKEN_FILE_PATH: process.env.TOKEN_FILE_PATH || './data/auth_token.txt',

    // API Endpoints
    ENDPOINTS: {
        LOGIN: 'https://api.accounts-bc.com/v1/auth/login',
        TWO_FA: 'https://api.accounts-bc.com/v1/twoFaAuth/verifications/codes',
        AUTHORIZE: 'https://api.accounts-bc.com/connect/authorize',
        SSO_CALLBACK: 'https://backofficewebadmin.betcostatic.com/api/en/account/ssocallback',
        BACKOFFICE: 'https://backoffice.betcostatic.com/',
        TOKEN_EXCHANGE: 'https://backofficewebadmin.betcostatic.com/api/en/Client/GetClientWithdrawalRequestsWithTotals'
    }
};

// Validation
const requiredFields = ['BC_EMAIL', 'BC_PASSWORD', 'BC_2FA_SECRET'];
for (const field of requiredFields) {
    if (!config[field]) {
        throw new Error(`Missing required config: ${field}`);
    }
}

module.exports = config;
