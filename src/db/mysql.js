/**
 * MySQL Database Connection
 * Railway-compatible configuration
 */

const mysql = require('mysql2/promise');

let pool = null;

/**
 * Initialize MySQL connection pool
 */
async function initDatabase() {
    // Railway provides DATABASE_URL, MYSQL_URL, or individual vars
    const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

    const config = connectionUrl
        ? { uri: connectionUrl }
        : {
            host: process.env.MYSQL_HOST || process.env.MYSQLHOST || 'localhost',
            port: parseInt(process.env.MYSQL_PORT || process.env.MYSQLPORT || '3306'),
            user: process.env.MYSQL_USER || process.env.MYSQLUSER || 'root',
            password: process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || '',
            database: process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || 'kargasuperapp',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        };

    try {
        if (connectionUrl) {
            pool = mysql.createPool(connectionUrl);
        } else {
            pool = mysql.createPool(config);
        }

        // Test connection
        const connection = await pool.getConnection();
        console.log('[DB] MySQL bağlantısı başarılı');
        connection.release();

        // Run migrations
        await runMigrations();

        return pool;
    } catch (error) {
        console.error('[DB] MySQL bağlantı hatası:', error.message || error);
        pool = null; // Reset pool on error
        // Don't crash - allow app to run without DB for development
        return null;
    }
}

/**
 * Run database migrations (create tables if not exist)
 */
async function runMigrations() {
    if (!pool) return;

    const createDecisionsTable = `
        CREATE TABLE IF NOT EXISTS decisions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            withdrawal_id BIGINT NOT NULL,
            client_id BIGINT NOT NULL,
            decision ENUM('ONAY', 'RET', 'MANUEL') NOT NULL,
            decision_reason VARCHAR(500),
            deposit_amount DECIMAL(12,2),
            deposit_time DATETIME,
            turnover_casino DECIMAL(12,2) DEFAULT 0,
            turnover_sports DECIMAL(12,2) DEFAULT 0,
            turnover_required DECIMAL(12,2) DEFAULT 0,
            turnover_percentage INT DEFAULT 0,
            has_pre_deposit_win BOOLEAN DEFAULT FALSE,
            withdrawal_amount DECIMAL(12,2),
            withdrawal_status_at_check INT,
            checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_withdrawal (withdrawal_id),
            INDEX idx_client (client_id),
            INDEX idx_checked (checked_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    try {
        await pool.query(createDecisionsTable);

        // Add JSON columns for audit logging (idempotent check via try-catch)
        // Note: IF NOT EXISTS for columns is only available in newer MySQL/MariaDB versions,
        // so we try to add and ignore "Duplicate column name" error (errno 1060)
        try {
            await pool.query('ALTER TABLE decisions ADD COLUMN withdrawal_data JSON');
        } catch (e) {
            // Ignore if column exists
            if (e.errno !== 1060) console.error('[DB] Migration column warning:', e.message);
        }

        try {
            await pool.query('ALTER TABLE decisions ADD COLUMN turnover_data JSON');
        } catch (e) {
            // Ignore if column exists
            if (e.errno !== 1060) console.error('[DB] Migration column warning:', e.message);
        }

        // Upgrade withdrawal_id and client_id from INT to BIGINT (for existing tables)
        // BC uses very large IDs that can overflow INT
        try {
            await pool.query('ALTER TABLE decisions MODIFY COLUMN withdrawal_id BIGINT NOT NULL');
            await pool.query('ALTER TABLE decisions MODIFY COLUMN client_id BIGINT NOT NULL');
            console.log('[DB] Upgraded withdrawal_id and client_id to BIGINT');
        } catch (e) {
            // Ignore if already BIGINT or other non-critical issues
            if (e.errno !== 1060) console.log('[DB] Column type check:', e.message);
        }

        // Rules table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rules (
                rule_key VARCHAR(50) PRIMARY KEY,
                rule_value JSON NOT NULL,
                description VARCHAR(255),
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Withdrawals table - Full Snapshot Architecture
        // Stores ALL detail page data at the moment of bot analysis
        await pool.query(`
            CREATE TABLE IF NOT EXISTS withdrawals (
                id BIGINT PRIMARY KEY,
                client_id BIGINT NOT NULL,
                client_login VARCHAR(100),
                amount DECIMAL(12,2) NOT NULL,
                status INT NOT NULL DEFAULT 0,
                payment_method VARCHAR(100),
                request_time DATETIME,
                
                -- Bot Decision (Immutable after first save)
                bot_decision ENUM('ONAY', 'RET', 'MANUEL'),
                decision_reason TEXT,
                withdrawal_type ENUM('DEPOSIT', 'CASHBACK', 'FREESPIN', 'BONUS', 'UNKNOWN') DEFAULT 'UNKNOWN',
                
                -- Full Snapshot Data (Immutable - JSON columns)
                withdrawal_data JSON,
                client_data JSON,
                turnover_data JSON,
                sports_data JSON,
                bonuses_data JSON,
                bonus_transactions JSON,
                ip_analysis JSON,
                
                -- Timestamps
                checked_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_client (client_id),
                INDEX idx_status (status),
                INDEX idx_created (created_at),
                INDEX idx_checked (checked_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Auto Approvals Log Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS auto_approvals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                withdrawal_id BIGINT NOT NULL,
                client_id BIGINT NOT NULL,
                client_login VARCHAR(100),
                amount DECIMAL(12,2),
                rules_passed JSON,
                approved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                bc_response JSON,
                INDEX idx_withdrawal (withdrawal_id),
                INDEX idx_approved (approved_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Auto Approval Rules Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS auto_approval_rules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                rule_key VARCHAR(50) UNIQUE NOT NULL,
                rule_name VARCHAR(100) NOT NULL,
                rule_value TEXT,
                is_enabled BOOLEAN DEFAULT TRUE,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Seed default rules
        await pool.query(`
            INSERT IGNORE INTO auto_approval_rules (rule_key, rule_name, rule_value, is_enabled, description) VALUES
            ('MAX_AMOUNT', 'Maksimum Tutar', '5000', TRUE, 'Otomatik onay için maksimum çekim tutarı (TL)'),
            ('REQUIRE_DEPOSIT_TODAY', 'Bugün Yatırım Şartı', 'true', TRUE, 'Gün içinde yatırım yapılmış olmalı'),
            ('NO_BONUS_AFTER_DEPOSIT', 'Bonus Kontrolü', 'true', TRUE, 'Yatırım sonrası bonus alınmamış olmalı'),
            ('NO_FREESPIN_BONUS', 'FreeSpin/Bonus İşlemi', 'true', TRUE, 'FreeSpin veya Pay Client Bonus işlemi olmamalı'),
            ('NO_SPORTS_BETS', 'Spor Bahisi Kontrolü', 'true', TRUE, 'Spor bahisi yapılmamış olmalı'),
            ('FORBIDDEN_GAMES', 'Yasaklı Oyunlar', 'Roulette,Rulet,Blackjack,Aviator,Aviabet,Baccarat', TRUE, 'Bu kelimeleri içeren oyunlar yasaklı'),
            ('TURNOVER_COMPLETE', 'Çevrim Kontrolü', '100', TRUE, 'Minimum çevrim yüzdesi')
        `);

        console.log('[DB] Migrations completed - all tables ready including auto_approvals');
    } catch (error) {
        console.error('[DB] Migration hatası:', error.message);
    }
}

/**
 * Get the database pool
 */
function getPool() {
    return pool;
}

/**
 * Execute a query
 */
async function query(sql, params = []) {
    if (!pool) {
        throw new Error('Database not initialized');
    }
    const [results] = await pool.query(sql, params);
    return results;
}

/**
 * Close database connection
 */
async function closeDatabase() {
    if (pool) {
        await pool.end();
        console.log('[DB] MySQL bağlantısı kapatıldı');
    }
}

module.exports = {
    initDatabase,
    getPool,
    query,
    closeDatabase
};
