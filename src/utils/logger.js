/**
 * Logger Utility
 * Timestamp'li console logging
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;

function formatTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function formatMessage(level, message, data) {
    const timestamp = formatTimestamp();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
}

const logger = {
    debug: (message, data) => {
        if (currentLevel <= LOG_LEVELS.DEBUG) {
            console.log(formatMessage('DEBUG', message, data));
        }
    },

    info: (message, data) => {
        if (currentLevel <= LOG_LEVELS.INFO) {
            console.log(formatMessage('INFO', message, data));
        }
    },

    warn: (message, data) => {
        if (currentLevel <= LOG_LEVELS.WARN) {
            console.warn(formatMessage('WARN', message, data));
        }
    },

    error: (message, data) => {
        if (currentLevel <= LOG_LEVELS.ERROR) {
            console.error(formatMessage('ERROR', message, data));
        }
    }
};

module.exports = logger;
