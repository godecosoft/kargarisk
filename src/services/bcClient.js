/**
 * BetConstruct API Client
 * Token Service'i kullanarak BC API'lerine istek atar
 */

const axios = require('axios');
const tokenService = require('./tokenService');
const logger = require('../utils/logger');
const config = require('../config/env');

class BCClient {
    constructor() {
        this.baseUrl = 'https://backofficewebadmin.betcostatic.com/api/en';
    }

    /**
     * BC API'ye authenticated POST isteği at
     */
    async post(endpoint, data = {}) {
        const token = await tokenService.getToken();

        const url = `${this.baseUrl}${endpoint}`;

        logger.debug('BC API Request', { url, data });

        try {
            const response = await axios.post(url, data, {
                headers: {
                    'authentication': token,
                    'Content-Type': 'application/json',
                    'Origin': 'https://backoffice.betcostatic.com',
                    'Referer': 'https://backoffice.betcostatic.com/',
                    'x-requested-with': 'XMLHttpRequest'
                },
                timeout: 30000
            });

            logger.debug('BC API Response', {
                status: response.status,
                hasError: response.data?.HasError
            });

            if (response.data?.HasError) {
                throw new Error(response.data?.AlertMessage || 'BC API Error');
            }

            return response.data;

        } catch (error) {
            // 401/403 durumunda token yenile ve tekrar dene
            if (error.response?.status === 401 || error.response?.status === 403) {
                logger.warn('Token expired, refreshing...');
                await tokenService.refreshToken();
                return this.post(endpoint, data);
            }

            logger.error('BC API Error', {
                endpoint,
                error: error.message,
                status: error.response?.status
            });
            throw error;
        }
    }

    /**
     * Çekim taleplerini getir
     */
    async getWithdrawalRequests(filters = {}) {
        // Bugünün tarihini al (TR formatında)
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const formatDate = (date) => {
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yy = String(date.getFullYear()).slice(-2);
            return `${dd}-${mm}-${yy} - 00:00:00`;
        };

        const payload = {
            ClientId: filters.clientId || '',
            MinAmount: filters.minAmount || null,
            MaxAmount: filters.maxAmount || null,
            ClientLogin: filters.clientLogin || '',
            Email: filters.email || '',
            Id: filters.id || null,
            RegionId: filters.regionId || null,
            BetShopId: '',
            PartnerClientCategoryId: '',
            StateList: filters.stateList || [],
            ByAllowDate: false,
            PaymentTypeIds: filters.paymentTypeIds || [],
            IsTest: '',
            FromDateLocal: filters.fromDate || formatDate(today),
            ToDateLocal: filters.toDate || formatDate(tomorrow),
            CurrencyId: null
        };

        logger.info('Fetching withdrawal requests', { payload });

        const response = await this.post('/Client/GetClientWithdrawalRequestsWithTotals', payload);

        return response.Data;
    }

    /**
     * Get client login history (for IP analysis)
     * @param {number} clientId - Client ID
     * @param {number} days - Number of days to look back (default 7)
     */
    async getClientLogins(clientId, days = 7) {
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);

        const formatDate = (date) => {
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yy = String(date.getFullYear()).slice(-2);
            return `${dd}-${mm}-${yy} - 00:00:00`;
        };

        const payload = {
            ClientId: clientId,
            FromDateLocal: formatDate(fromDate),
            ToDateLocal: formatDate(toDate)
        };

        logger.info('Fetching client logins', { clientId, days });

        const response = await this.post('/Client/GetLogins', payload);
        return response.Data?.Objects || [];
    }

    /**
     * Get clients who logged in from a specific IP
     * @param {string} ip - IP address to check
     */
    async getClientsByIP(ip) {
        const payload = {
            LoginIP: ip,
            SkeepRows: 0,
            MaxRows: 10
        };

        logger.debug('Checking IP for multi-account', { ip });

        const response = await this.post('/Client/GetClientsByIPAddress', payload);
        return response.Data?.Objects || [];
    }

    /**
     * Get client KPI (financial summary)
     * @param {number} clientId - Client ID
     */
    async getClientKpi(clientId) {
        const token = await tokenService.getToken();
        const url = `${this.baseUrl}/Client/GetClientKpi?id=${clientId}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'authentication': token,
                    'Content-Type': 'application/json',
                    'Origin': 'https://backoffice.betcostatic.com',
                    'Referer': 'https://backoffice.betcostatic.com/'
                },
                timeout: 15000
            });

            if (response.data?.HasError) {
                throw new Error(response.data?.AlertMessage || 'KPI API Error');
            }

            return response.data?.Data || null;
        } catch (error) {
            logger.error('GetClientKpi error', { clientId, error: error.message });
            return null;
        }
    }

    /**
     * Pay (approve) a withdrawal request
     * @param {Object} withdrawal - Full withdrawal object from GetClientWithdrawalRequests
     * @returns {Object} BC API response
     */
    async payWithdrawalRequest(withdrawal) {
        logger.info('Approving withdrawal', { id: withdrawal.Id, amount: withdrawal.Amount });

        const response = await this.post('/Client/PayWithdrawalRequests', withdrawal);

        if (response.HasError) {
            throw new Error(response.AlertMessage || 'Withdrawal approval failed');
        }

        return response;
    }
}
const bcClient = new BCClient();

module.exports = bcClient;
