-- RuleEngine Migration Script
-- Run this to create the unified rules table

CREATE TABLE IF NOT EXISTS rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Kural Tanımı
    rule_key VARCHAR(50) NOT NULL,
    rule_name VARCHAR(100),
    rule_description TEXT,
    
    -- Kategori
    category ENUM('GENERAL', 'NORMAL', 'BONUS', 'CASHBACK', 'FREESPIN') NOT NULL,
    
    -- Bonus ile ilişki (sadece BONUS kategorisi için)
    bonus_rule_id INT NULL,
    
    -- Konfigürasyon
    config JSON NOT NULL,
    
    -- Durum
    is_enabled BOOLEAN DEFAULT TRUE,
    is_critical BOOLEAN DEFAULT FALSE,
    priority INT DEFAULT 100,
    
    -- Multi-site desteği
    site_id INT DEFAULT 1,
    
    -- Meta
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
    
    UNIQUE KEY unique_rule_per_site (rule_key, category, site_id, bonus_rule_id)
);

-- Başlangıç Verileri

-- GENEL KURALLAR (Tüm çekimler için geçerli)
INSERT INTO rules (rule_key, rule_name, rule_description, category, config, is_enabled, priority) VALUES
('MAX_AMOUNT', 'Maksimum Çekim Limiti', 'Tek seferde çekilebilecek maksimum tutar', 'GENERAL', '{"max_value": 5000}', TRUE, 10),
('FORBIDDEN_GAMES', 'Yasaklı Oyunlar', 'Kazanç sağlanması yasak olan oyunlar', 'GENERAL', '{"patterns": ["jetx", "aviator", "spaceman", "crash", "plinko"]}', TRUE, 20),
('IP_RISK_CHECK', 'Çoklu Hesap Kontrolü', 'Aynı IP adresinden birden fazla hesap kontrolü', 'GENERAL', '{"max_accounts_per_ip": 2}', TRUE, 30),
('SPIN_HOARDING', 'Spin Gömme Tespiti', 'Bahis yapmadan kazanç elde etme tespiti', 'GENERAL', '{"enabled": true}', TRUE, 40);

-- NORMAL ÇEKİM KURALLARI
INSERT INTO rules (rule_key, rule_name, rule_description, category, config, is_enabled, priority) VALUES
('REQUIRE_DEPOSIT_TODAY', 'Bugün Yatırım Zorunlu', 'Aynı gün içinde yatırım yapılmış olmalı', 'NORMAL', '{"required": true}', TRUE, 100),
('NO_BONUS_AFTER_DEPOSIT', 'Yatırım Sonrası Bonus Yok', 'Yatırımdan sonra bonus alınmamış olmalı', 'NORMAL', '{"time_window_minutes": 60}', TRUE, 110),
('NO_FREESPIN_BONUS', 'FreeSpin Kontrolü', 'FreeSpin işlemi olmamalı', 'NORMAL', '{"reject_if_found": true}', TRUE, 120),
('TURNOVER_MULTIPLIER', 'Çevrim Katı', 'Yatırımın kaç katı çevrilmeli', 'NORMAL', '{"multiplier": 1}', TRUE, 130),
('MAX_WITHDRAWAL_RATIO', 'Max Çekim/Yatırım Oranı', 'Çekim tutarı yatırımın max kaç katı olabilir', 'NORMAL', '{"max_ratio": 30}', TRUE, 140);

-- CASHBACK KURALLARI
INSERT INTO rules (rule_key, rule_name, rule_description, category, config, is_enabled, priority) VALUES
('CASHBACK_AUTO_APPROVE', 'Cashback Oto-Onay', 'Cashback çekimlerinde otomatik onay', 'CASHBACK', '{"enabled": false}', FALSE, 200),
('CASHBACK_MAX_AMOUNT', 'Cashback Max Limit', 'Cashback çekim limiti', 'CASHBACK', '{"max_value": 1000}', TRUE, 210),
('CASHBACK_NO_TURNOVER', 'Cashback Çevrim Yok', 'Cashback çekimlerinde çevrim şartı aranmaz', 'CASHBACK', '{"skip_turnover": true}', TRUE, 220);

-- FREESPIN KURALLARI
INSERT INTO rules (rule_key, rule_name, rule_description, category, config, is_enabled, priority) VALUES
('FREESPIN_AUTO_APPROVE', 'FreeSpin Oto-Onay', 'FreeSpin çekimlerinde otomatik onay', 'FREESPIN', '{"enabled": false}', FALSE, 300);

-- Withdrawals tablosuna rule_evaluation kolonu ekle (eğer yoksa)
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS rule_evaluation JSON NULL AFTER decision_reason;
