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

        // Seed default rules - uses ON DUPLICATE to ensure all exist
        const rules = [
            ['AUTO_APPROVAL_ENABLED', 'Otomatik Onay Sistemi', 'true', false, 'Ana aç/kapa - Kapalı olduğunda hiçbir çekim otomatik onaylanmaz'],
            ['MAX_AMOUNT', 'Maksimum Tutar', '5000', true, 'Otomatik onay için maksimum çekim tutarı (TL)'],
            ['MAX_WITHDRAWAL_RATIO', 'Yatırım/Çekim Oranı', '30', true, 'Çekim tutarı yatırımın bu katını aşarsa manuel onaya gider'],
            ['REQUIRE_DEPOSIT_TODAY', 'Bugün Yatırım Şartı', 'true', true, 'Gün içinde yatırım yapılmış olmalı'],
            ['NO_BONUS_AFTER_DEPOSIT', 'Bonus Kontrolü', 'true', true, 'Yatırım sonrası bonus alınmamış olmalı'],
            ['NO_FREESPIN_BONUS', 'FreeSpin/PayClient Bonus', 'true', true, 'FreeSpin veya Pay Client Bonus işlemi olmamalı'],
            ['NO_SPORTS_BETS', 'Spor Bahisi Kontrolü', 'true', true, 'Spor bahisi yapılmamış olmalı'],
            ['FORBIDDEN_GAMES', 'Yasaklı Oyunlar', 'Roulette,Rulet,Blackjack,Aviator,Aviabet,Baccarat', true, 'Bu kelimeleri içeren oyunlar yasaklı'],
            ['TURNOVER_COMPLETE', 'Çevrim Kontrolü', '100', true, 'Minimum çevrim yüzdesi']
        ];

        for (const [key, name, value, enabled, desc] of rules) {
            await pool.query(`
                INSERT INTO auto_approval_rules (rule_key, rule_name, rule_value, is_enabled, description) 
            `, [key, name, value, enabled, desc]);
        }

        // Bonus Rules Table (Dynamic Bonus Management)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bonus_rules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                match_keyword VARCHAR(50) NOT NULL UNIQUE,
                is_active BOOLEAN DEFAULT TRUE,
                auto_approval_enabled BOOLEAN DEFAULT FALSE,
                max_amount DECIMAL(12,2) DEFAULT 0,
                ignore_deposit_rule BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_keyword (match_keyword)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Add new columns if they don't exist (Migration logic)
        try {
            await pool.query(`
                ALTER TABLE bonus_rules
                ADD COLUMN turnover_multiplier DECIMAL(5,2) DEFAULT 0,
                ADD COLUMN min_withdrawal_multiplier DECIMAL(5,2) DEFAULT 0,
                ADD COLUMN max_withdrawal_multiplier DECIMAL(5,2) DEFAULT 0
            `);
        } catch (e) {
            if (e.errno !== 1060) console.error('[DB] Column update error:', e.message);
        }

        // Add enabled flags for each numeric field
        const enabledFlags = [
            'max_amount_enabled',
            'turnover_multiplier_enabled',
            'min_withdrawal_multiplier_enabled',
            'max_withdrawal_multiplier_enabled',
            'min_balance_limit_enabled',
            'fixed_withdrawal_amount_enabled',
            'max_remaining_balance_enabled'
        ];
        for (const flag of enabledFlags) {
            try {
                await pool.query(`ALTER TABLE bonus_rules ADD COLUMN ${flag} BOOLEAN DEFAULT FALSE`);
            } catch (e) {
                if (e.errno !== 1060) console.error('[DB] Column add error:', e.message);
            }
        }

        console.log('[DB] Migrations completed - all tables ready including auto_approvals');

        // ============================================
        // UNIFIED RULES TABLE (New RuleEngine System)
        // ============================================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS unified_rules (
                id INT PRIMARY KEY AUTO_INCREMENT,
                rule_key VARCHAR(50) NOT NULL,
                rule_name VARCHAR(100),
                rule_description TEXT,
                category ENUM('GENERAL', 'NORMAL', 'BONUS', 'CASHBACK', 'FREESPIN') NOT NULL,
                bonus_rule_id INT NULL,
                config JSON NOT NULL,
                is_enabled BOOLEAN DEFAULT TRUE,
                is_critical BOOLEAN DEFAULT FALSE,
                priority INT DEFAULT 100,
                site_id INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_rule_per_site (rule_key, category, site_id, bonus_rule_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Seed unified rules if table is empty
        const [ruleCount] = await pool.query('SELECT COUNT(*) as cnt FROM unified_rules');
        if (ruleCount[0].cnt === 0) {
            console.log('[DB] Seeding unified_rules with default rules...');
            const unifiedRules = [
                // GENERAL
                ['MAX_AMOUNT', 'Maksimum Çekim Limiti', 'Tek seferde çekilebilecek max tutar', 'GENERAL', '{"max_value": 5000}', true, 10],
                ['FORBIDDEN_GAMES', 'Yasaklı Oyunlar', 'Yasaklı oyun kontrolü', 'GENERAL', '{"patterns": ["jetx", "aviator", "spaceman", "crash", "plinko"]}', true, 20],
                ['IP_RISK_CHECK', 'Çoklu Hesap Kontrolü', 'Aynı IP çoklu hesap', 'GENERAL', '{"max_accounts_per_ip": 2}', true, 30],
                ['SPIN_HOARDING', 'Spin Gömme Tespiti', 'Bahissiz kazanç tespiti', 'GENERAL', '{"enabled": true}', true, 40],
                // NORMAL
                ['REQUIRE_DEPOSIT_TODAY', 'Bugün Yatırım Zorunlu', 'Aynı gün yatırım', 'NORMAL', '{"required": true}', true, 100],
                ['NO_BONUS_AFTER_DEPOSIT', 'Yatırım Sonrası Bonus Yok', 'Yatırım sonrası bonus kontrolü', 'NORMAL', '{"time_window_minutes": 60}', true, 110],
                ['NO_FREESPIN_BONUS', 'FreeSpin Kontrolü', 'FreeSpin işlemi yok', 'NORMAL', '{"reject_if_found": true}', true, 120],
                ['TURNOVER_MULTIPLIER', 'Çevrim Katı', 'Yatırım x çevrim', 'NORMAL', '{"multiplier": 1}', true, 130],
                ['MAX_WITHDRAWAL_RATIO', 'Max Çekim/Yatırım Oranı', 'Çekim/yatırım oranı', 'NORMAL', '{"max_ratio": 30}', true, 140],
                // CASHBACK
                ['CASHBACK_AUTO_APPROVE', 'Cashback Oto-Onay', 'Cashback oto-onay', 'CASHBACK', '{"enabled": false}', false, 200],
                ['CASHBACK_MAX_AMOUNT', 'Cashback Max Limit', 'Cashback limit', 'CASHBACK', '{"max_value": 1000}', true, 210],
                ['CASHBACK_NO_TURNOVER', 'Cashback Çevrim Yok', 'Çevrim atla', 'CASHBACK', '{"skip_turnover": true}', true, 220],
                // FREESPIN
                ['FREESPIN_AUTO_APPROVE', 'FreeSpin Oto-Onay', 'FreeSpin oto-onay', 'FREESPIN', '{"enabled": false}', false, 300]
            ];

            for (const [key, name, desc, category, config, enabled, priority] of unifiedRules) {
                await pool.query(`
                    INSERT INTO unified_rules (rule_key, rule_name, rule_description, category, config, is_enabled, priority)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [key, name, desc, category, config, enabled, priority]);
            }
            console.log('[DB] Unified rules seeded successfully');
        }

        // Add rule_evaluation column to withdrawals if not exists
        try {
            await pool.query('ALTER TABLE withdrawals ADD COLUMN rule_evaluation JSON NULL AFTER decision_reason');
        } catch (e) {
            if (e.errno !== 1060) console.error('[DB] rule_evaluation column:', e.message);
        }

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
