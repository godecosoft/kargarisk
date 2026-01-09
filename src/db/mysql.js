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
            withdrawal_id INT NOT NULL,
            client_id INT NOT NULL,
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

        // Rules table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rules (
                rule_key VARCHAR(50) PRIMARY KEY,
                rule_value JSON NOT NULL,
                description VARCHAR(255),
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('[DB] Migrations completed - decisions ve rules tabloları hazır');
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
