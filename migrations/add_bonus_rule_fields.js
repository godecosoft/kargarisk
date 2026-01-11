/**
 * Bonus Rules Migration - Yeni alanları ekle
 * Çalıştır: node migrations/add_bonus_rule_fields.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('Connecting to database...');

    const conn = await mysql.createConnection({
        host: process.env.MY_SQL_HOST,
        user: process.env.MY_SQL_USER,
        password: process.env.MY_SQL_PASSWORD,
        database: process.env.MY_SQL_DATABASE
    });

    const alterCommands = [
        'ALTER TABLE bonus_rules ADD COLUMN min_balance_limit DECIMAL(10,2) DEFAULT 0',
        'ALTER TABLE bonus_rules ADD COLUMN fixed_withdrawal_amount DECIMAL(10,2) DEFAULT 0',
        'ALTER TABLE bonus_rules ADD COLUMN max_remaining_balance DECIMAL(10,2) DEFAULT 0',
        'ALTER TABLE bonus_rules ADD COLUMN require_deposit_id BOOLEAN DEFAULT FALSE',
        'ALTER TABLE bonus_rules ADD COLUMN delete_excess_balance BOOLEAN DEFAULT FALSE'
    ];

    for (const cmd of alterCommands) {
        try {
            await conn.execute(cmd);
            console.log('✓ Added:', cmd.match(/ADD COLUMN (\w+)/)[1]);
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('⊘ Exists:', cmd.match(/ADD COLUMN (\w+)/)[1]);
            } else {
                console.error('✗ Error:', e.message);
            }
        }
    }

    await conn.end();
    console.log('\nMigration completed!');
}

migrate().catch(console.error);
