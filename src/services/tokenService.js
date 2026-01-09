/**
 * BetConstruct SSO Token Service
 * Backoffice API'lerine erişim için Authentication token yönetimi
 */

const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const speakeasy = require('speakeasy');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('../utils/logger');

class TokenService {
    constructor() {
        this.token = null;
        this.tokenExpiry = null;
        this.isRefreshing = false;
        this.refreshPromise = null;
        this.jar = new CookieJar();
        this.client = this._createHttpClient();
    }

    /**
     * Adım 1: Cookie-destekli HTTP Client oluştur
     */
    _createHttpClient() {
        const client = wrapper(axios.create({
            jar: this.jar,
            withCredentials: true,
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Origin': 'https://www.accounts-bc.com',
                'Referer': 'https://www.accounts-bc.com/',
                'x-requested-with': 'XMLHttpRequest'
            }
        }));

        return client;
    }

    /**
     * Adım 2: Login Request
     */
    async _login() {
        logger.info('Login başlatılıyor...', { email: config.BC_EMAIL });

        const loginRes = await this.client.post(config.ENDPOINTS.LOGIN, {
            email: config.BC_EMAIL,
            password: config.BC_PASSWORD,
            domain: config.BC_DOMAIN
        });

        logger.debug('Login response', { status: loginRes.status, data: loginRes.data });

        if (loginRes.status !== 200) {
            throw new Error(`Login failed: ${loginRes.status} - ${JSON.stringify(loginRes.data)}`);
        }

        // 2FA gerekiyor mu kontrol et
        if (loginRes.data?.requestTwoFactor === true) {
            logger.info('2FA doğrulaması gerekiyor...');
            await this._verify2FA();
        } else {
            logger.info('Login başarılı (2FA gerekmedi)');
        }

        return true;
    }

    /**
     * Adım 3: 2FA Doğrulama
     */
    async _verify2FA() {
        const code = speakeasy.totp({
            secret: config.BC_2FA_SECRET,
            encoding: 'base32'
        });

        logger.info('2FA kodu oluşturuldu', { code });

        const twoFaRes = await this.client.post(config.ENDPOINTS.TWO_FA, {
            twoFactorCode: code,
            rememberMachine: true
        });

        logger.debug('2FA response', { status: twoFaRes.status, data: twoFaRes.data });

        if (twoFaRes.status !== 200) {
            throw new Error(`2FA verification failed: ${twoFaRes.status} - ${JSON.stringify(twoFaRes.data)}`);
        }

        logger.info('2FA doğrulaması başarılı');
        return true;
    }

    /**
     * Adım 4: OAuth2 Authorize - HTML'den hidden input'ları parse et
     */
    async _authorizeOAuth() {
        const authorizeUrl = config.ENDPOINTS.AUTHORIZE + '?' +
            'client_id=BackOfficeSSO&' +
            'response_type=code%20token%20id_token&' +
            'scope=openid%20profile%20email%20offline_access%20introspect.full.access%20real_ip&' +
            'redirect_uri=' + encodeURIComponent(config.ENDPOINTS.SSO_CALLBACK) + '&' +
            'state=https%3A%2F%2Fbackoffice.betcostatic.com%2F&' +
            'nonce=https%3A%2F%2Fbackofficewebadmin.betcostatic.com&' +
            'response_mode=form_post';

        logger.info('OAuth2 authorize isteği gönderiliyor...');

        const authRes = await this.client.get(authorizeUrl);

        logger.debug('Authorize response status', { status: authRes.status });

        if (authRes.status !== 200) {
            throw new Error(`OAuth authorize failed: ${authRes.status}`);
        }

        // HTML'den hidden input'ları parse et
        const formData = this._parseHiddenInputs(authRes.data);

        if (!formData.access_token) {
            logger.error('Form data içinde access_token bulunamadı', formData);
            throw new Error('access_token not found in authorize response');
        }

        logger.info('OAuth2 authorize başarılı', { hasAccessToken: !!formData.access_token });
        return formData;
    }

    /**
     * HTML'den hidden input'ları çıkar
     */
    _parseHiddenInputs(html) {
        const formData = {};
        const re = /<input type='hidden' name='([^']+)' value='([^']*)'/g;
        let match;

        while ((match = re.exec(String(html))) !== null) {
            formData[match[1]] = match[2];
        }

        // Alternatif format: double quotes
        const re2 = /<input type="hidden" name="([^"]+)" value="([^"]*)"/g;
        while ((match = re2.exec(String(html))) !== null) {
            formData[match[1]] = match[2];
        }

        return formData;
    }

    /**
     * Adım 5: SSO Callback
     */
    async _ssoCallback(formData) {
        logger.info('SSO callback gönderiliyor...');

        const cbRes = await this.client.post(
            config.ENDPOINTS.SSO_CALLBACK,
            new URLSearchParams(formData).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Origin': 'https://api.accounts-bc.com',
                    'Referer': 'https://api.accounts-bc.com/'
                }
            }
        );

        logger.debug('SSO callback response', { status: cbRes.status });

        if (cbRes.status !== 200 && cbRes.status !== 302) {
            throw new Error(`SSO callback failed: ${cbRes.status}`);
        }

        logger.info('SSO callback başarılı');
        return true;
    }

    /**
     * Adım 6: Backoffice Warm-up
     */
    async _warmupBackoffice() {
        logger.info('Backoffice warm-up yapılıyor...');

        await this.client.get(config.ENDPOINTS.BACKOFFICE, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });

        logger.info('Backoffice warm-up tamamlandı');
    }

    /**
     * Adım 7: Token Exchange - Token HEADER'dan gelir!
     */
    async _exchangeToken() {
        logger.info('Token exchange başlatılıyor...');

        const exchangeRes = await this.client.post(
            config.ENDPOINTS.TOKEN_EXCHANGE,
            { StateList: [1], MaxRows: 1, SkeepRows: 0 },  // Body BOŞ OLMAMALI!
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': 'https://backoffice.betcostatic.com',
                    'Referer': 'https://backoffice.betcostatic.com/',
                    'x-requested-with': 'XMLHttpRequest'
                }
            }
        );

        logger.debug('Token exchange response', {
            status: exchangeRes.status,
            headers: Object.keys(exchangeRes.headers)
        });

        // Token HEADER'da gelir!
        const token = exchangeRes.headers['authentication'] || exchangeRes.headers['Authentication'];

        if (!token || token.length < 40) {
            logger.error('Token alınamadı veya çok kısa', {
                tokenLength: token?.length,
                responseStatus: exchangeRes.status,
                responseData: exchangeRes.data
            });
            throw new Error('Token not found in response headers or too short');
        }

        logger.info('Token başarıyla alındı', { tokenLength: token.length });
        return token;
    }

    /**
     * Token'ı dosyaya kaydet
     */
    _saveToken(token) {
        try {
            const tokenDir = path.dirname(config.TOKEN_FILE_PATH);
            if (!fs.existsSync(tokenDir)) {
                fs.mkdirSync(tokenDir, { recursive: true });
            }
            fs.writeFileSync(config.TOKEN_FILE_PATH, token);
            logger.info('Token dosyaya kaydedildi', { path: config.TOKEN_FILE_PATH });
        } catch (error) {
            logger.warn('Token dosyaya kaydedilemedi', { error: error.message });
        }
    }

    /**
     * Token'ı dosyadan oku
     */
    _loadToken() {
        try {
            if (fs.existsSync(config.TOKEN_FILE_PATH)) {
                const token = fs.readFileSync(config.TOKEN_FILE_PATH, 'utf-8').trim();
                if (token && token.length >= 40) {
                    logger.info('Token dosyadan yüklendi', { tokenLength: token.length });
                    return token;
                }
            }
        } catch (error) {
            logger.warn('Token dosyadan okunamadı', { error: error.message });
        }
        return null;
    }

    /**
     * Token geçerliliğini test et
     */
    async testToken(token) {
        try {
            const res = await axios.post(
                config.ENDPOINTS.TOKEN_EXCHANGE,
                { StateList: [1], MaxRows: 1, SkeepRows: 0 },
                {
                    headers: {
                        'authentication': token,
                        'Content-Type': 'application/json',
                        'Origin': 'https://backoffice.betcostatic.com',
                        'Referer': 'https://backoffice.betcostatic.com/',
                        'x-requested-with': 'XMLHttpRequest'
                    },
                    timeout: 10000
                }
            );
            return res.status === 200;
        } catch (error) {
            logger.debug('Token test failed', { error: error.message });
            return false;
        }
    }

    /**
     * Tam login akışını çalıştır ve token al
     */
    async _performFullLogin() {
        // Cookie jar'ı temizle
        this.jar = new CookieJar();
        this.client = this._createHttpClient();

        // Sıralı adımları çalıştır
        await this._login();
        const formData = await this._authorizeOAuth();
        await this._ssoCallback(formData);
        await this._warmupBackoffice();
        const token = await this._exchangeToken();

        // Token'ı kaydet
        this.token = token;
        this.tokenExpiry = Date.now() + config.TOKEN_REFRESH_INTERVAL;
        this._saveToken(token);

        return token;
    }

    /**
     * Token al - cached veya yeni
     */
    async getToken() {
        // Zaten yenileme yapılıyorsa bekle
        if (this.isRefreshing && this.refreshPromise) {
            logger.debug('Token yenileme devam ediyor, bekleniyor...');
            return this.refreshPromise;
        }

        // Cached token var ve geçerli mi?
        if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            logger.debug('Cached token kullanılıyor');
            return this.token;
        }

        // Dosyadan yükle ve test et
        const savedToken = this._loadToken();
        if (savedToken) {
            const isValid = await this.testToken(savedToken);
            if (isValid) {
                this.token = savedToken;
                this.tokenExpiry = Date.now() + config.TOKEN_REFRESH_INTERVAL;
                logger.info('Dosyadan yüklenen token geçerli');
                return savedToken;
            }
            logger.warn('Dosyadan yüklenen token geçersiz, yeni token alınacak');
        }

        // Yeni token al
        return this.refreshToken();
    }

    /**
     * Token'ı zorunlu yenile (lock pattern ile)
     */
    async refreshToken() {
        if (this.isRefreshing && this.refreshPromise) {
            return this.refreshPromise;
        }

        this.isRefreshing = true;
        this.refreshPromise = this._refreshWithRetry();

        try {
            const token = await this.refreshPromise;
            return token;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    /**
     * Retry mekanizmalı token yenileme
     */
    async _refreshWithRetry(maxRetries = 3, retryDelay = 30000) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info(`Token yenileme deneme ${attempt}/${maxRetries}`);
                const token = await this._performFullLogin();
                return token;
            } catch (error) {
                lastError = error;
                logger.error(`Token yenileme hatası (deneme ${attempt})`, { error: error.message });

                if (attempt < maxRetries) {
                    logger.info(`${retryDelay / 1000} saniye sonra tekrar denenecek...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }

        throw new Error(`Token alınamadı (${maxRetries} deneme sonrası): ${lastError.message}`);
    }
}

// Singleton instance
const tokenService = new TokenService();

module.exports = tokenService;
