/**
 * BetConstruct Super App - Entry Point
 * Token Service başlatma ve periyodik yenileme
 */

const tokenService = require('./services/tokenService');
const logger = require('./utils/logger');
const config = require('./config/env');

let refreshInterval = null;

async function initialize() {
    logger.info('========================================');
    logger.info('BetConstruct Super App başlatılıyor...');
    logger.info('========================================');

    try {
        // İlk token'ı al
        logger.info('Token alınıyor...');
        const token = await tokenService.getToken();

        logger.info('✅ Token başarıyla alındı!');
        logger.info(`Token (ilk 50 karakter): ${token.substring(0, 50)}...`);

        // Token'ı test et
        const isValid = await tokenService.testToken(token);
        if (isValid) {
            logger.info('✅ Token testi başarılı - API erişimi doğrulandı');
        } else {
            logger.warn('⚠️ Token testi başarısız oldu');
        }

        // Periyodik yenileme başlat
        startAutoRefresh();

        logger.info('========================================');
        logger.info('Super App hazır!');
        logger.info(`Sonraki yenileme: ${config.TOKEN_REFRESH_INTERVAL / 60000} dakika sonra`);
        logger.info('========================================');

        return token;

    } catch (error) {
        logger.error('❌ Başlatma hatası:', { error: error.message, stack: error.stack });
        throw error;
    }
}

function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }

    refreshInterval = setInterval(async () => {
        logger.info('⏰ Otomatik token yenileme başlatılıyor...');
        try {
            await tokenService.refreshToken();
            logger.info('✅ Token otomatik olarak yenilendi');
        } catch (error) {
            logger.error('❌ Otomatik yenileme hatası:', { error: error.message });
        }
    }, config.TOKEN_REFRESH_INTERVAL);

    logger.info('Otomatik yenileme aktif', { intervalMinutes: config.TOKEN_REFRESH_INTERVAL / 60000 });
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        logger.info('Otomatik yenileme durduruldu');
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Kapatma sinyali alındı...');
    stopAutoRefresh();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Sonlandırma sinyali alındı...');
    stopAutoRefresh();
    process.exit(0);
});

// Export for external use
module.exports = {
    initialize,
    getToken: () => tokenService.getToken(),
    refreshToken: () => tokenService.refreshToken(),
    testToken: (token) => tokenService.testToken(token),
    stopAutoRefresh
};

// Eğer doğrudan çalıştırılıyorsa başlat
if (require.main === module) {
    initialize().catch((error) => {
        logger.error('Fatal error:', { error: error.message });
        process.exit(1);
    });
}
