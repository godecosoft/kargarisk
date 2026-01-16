const db = require('../src/db/mysql');
const logger = require('../src/utils/logger');

async function migrate() {
    try {
        logger.info('Starting migration: add_check_wagering_status_to_bonus_rules');
        const pool = db.getPool();

        // Check if column exists
        const [columns] = await pool.query(`
            SHOW COLUMNS FROM bonus_rules LIKE 'check_wagering_status'
        `);

        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE bonus_rules
                ADD COLUMN check_wagering_status BOOLEAN DEFAULT 0
                AFTER turnover_multiplier_enabled
            `);
            logger.info('Added check_wagering_status column to bonus_rules table');
        } else {
            logger.info('check_wagering_status column already exists');
        }

        logger.info('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
