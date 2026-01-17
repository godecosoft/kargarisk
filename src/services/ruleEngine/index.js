const ruleLoader = require('./ruleLoader');
const ruleExecutor = require('./ruleExecutor');
const typeDetector = require('./typeDetector');
const logger = require('../../utils/logger');

class RuleEngine {
    constructor(siteId = 1) {
        this.siteId = siteId;
        this.rules = null;
        this.lastLoad = null;
        this.cacheTimeout = 60000; // 1 dakika cache
    }

    async loadRules(force = false) {
        const now = Date.now();
        if (!force && this.rules && this.lastLoad && (now - this.lastLoad) < this.cacheTimeout) {
            return this.rules;
        }

        this.rules = await ruleLoader.loadRules(this.siteId);
        this.lastLoad = now;
        logger.info(`[RuleEngine] Loaded ${this.rules.length} rules for site ${this.siteId}`);
        return this.rules;
    }

    async evaluate(withdrawal, snapshot, bonusRules = []) {
        await this.loadRules();

        const results = [];

        // 1. Çekim tipini belirle
        const withdrawalType = typeDetector.detect(snapshot);
        logger.info(`[RuleEngine] Withdrawal ${withdrawal.Id} type: ${withdrawalType}`);

        // 2. GENERAL kuralları çalıştır (hepsi için)
        const generalRules = this.rules.filter(r => r.category === 'GENERAL');
        for (const rule of generalRules) {
            const result = await ruleExecutor.execute(rule, withdrawal, snapshot);
            results.push({ ...result, category: 'GENERAL' });
        }

        // 3. Tipe özel kuralları çalıştır
        const typeRules = this.rules.filter(r => r.category === withdrawalType);
        for (const rule of typeRules) {
            const result = await ruleExecutor.execute(rule, withdrawal, snapshot);
            results.push({ ...result, category: withdrawalType });
        }

        // 4. BONUS tipi için bonus_rules tablosundan eşleşen kuralı uygula
        let matchedBonusRule = null;
        if (withdrawalType === 'BONUS' && bonusRules.length > 0) {
            matchedBonusRule = this.findMatchingBonusRule(snapshot, bonusRules);
            if (matchedBonusRule) {
                const bonusResults = await this.evaluateBonusRule(matchedBonusRule, withdrawal, snapshot);
                results.push(...bonusResults);
            } else {
                results.push({
                    name: 'BONUS_MATCH',
                    passed: false,
                    detail: 'Eşleşen bonus kuralı bulunamadı',
                    category: 'BONUS',
                    critical: false
                });
            }
        }

        // 5. Sonuç hesapla
        const failedRules = results.filter(r => !r.passed);
        const criticalFailed = failedRules.filter(r => r.critical);

        let decision = 'ONAY';
        let reason = 'Tüm kurallar geçti';

        if (criticalFailed.length > 0) {
            decision = 'RET';
            reason = criticalFailed.map(r => r.detail).join(', ');
        } else if (failedRules.length > 0) {
            decision = 'MANUEL';
            reason = failedRules.map(r => r.detail).join(', ');
        }

        logger.info(`[RuleEngine] Withdrawal ${withdrawal.Id} decision: ${decision} (${failedRules.length} failed)`);

        return {
            decision,
            reason,
            withdrawalType,
            matchedBonusRule: matchedBonusRule ? { id: matchedBonusRule.id, name: matchedBonusRule.name } : null,
            rules: results,
            passedCount: results.filter(r => r.passed).length,
            failedCount: failedRules.length,
            totalCount: results.length,
            simulationMode: false // Gerçek onay yapılıp yapılmayacağını belirler
        };
    }

    findMatchingBonusRule(snapshot, bonusRules) {
        const bonuses = snapshot?.bonuses || [];
        const lastBonus = bonuses.find(b => b.type === 2 && (b.acceptanceType === 0 || b.acceptanceType === 2));

        if (!lastBonus) return null;

        for (const rule of bonusRules) {
            if (!rule.match_keyword) continue;
            const keywords = rule.match_keyword.split(',').map(k => k.trim().toLowerCase());
            const bonusName = (lastBonus.name || '').toLowerCase();

            if (keywords.some(kw => bonusName.includes(kw))) {
                return rule;
            }
        }

        return null;
    }

    async evaluateBonusRule(bonusRule, withdrawal, snapshot) {
        const results = [];

        // Auto-approval check
        if (!bonusRule.auto_approval_enabled) {
            results.push({
                name: 'BONUS_AUTO_ENABLED',
                passed: false,
                detail: `Bonus oto-onay kapalı: ${bonusRule.name}`,
                category: 'BONUS',
                critical: false
            });
        } else {
            results.push({
                name: 'BONUS_AUTO_ENABLED',
                passed: true,
                detail: 'Bonus oto-onay açık',
                category: 'BONUS',
                critical: false
            });
        }

        // Max amount check
        if (bonusRule.max_amount && bonusRule.max_amount > 0) {
            const passed = withdrawal.Amount <= bonusRule.max_amount;
            results.push({
                name: 'BONUS_MAX_AMOUNT',
                passed,
                detail: passed
                    ? `₺${withdrawal.Amount} <= ₺${bonusRule.max_amount}`
                    : `₺${withdrawal.Amount} > ₺${bonusRule.max_amount}`,
                category: 'BONUS',
                critical: false
            });
        }

        // Turnover multiplier check
        if (bonusRule.turnover_multiplier && bonusRule.turnover_multiplier > 0) {
            const deposit = snapshot?.turnover?.deposit?.amount || 0;
            const required = deposit * bonusRule.turnover_multiplier;
            const actual = snapshot?.turnover?.total?.amount || 0;
            const percentage = required > 0 ? Math.round((actual / required) * 100) : 100;
            const passed = percentage >= 100;

            results.push({
                name: 'BONUS_TURNOVER',
                passed,
                detail: passed
                    ? `%${percentage} >= %100 (${bonusRule.turnover_multiplier}x)`
                    : `%${percentage} < %100 (${bonusRule.turnover_multiplier}x gerekli)`,
                category: 'BONUS',
                critical: false
            });
        }

        // Fixed withdrawal amount check
        if (bonusRule.fixed_withdrawal_amount && bonusRule.fixed_withdrawal_amount > 0) {
            const passed = withdrawal.Amount <= bonusRule.fixed_withdrawal_amount;
            results.push({
                name: 'BONUS_FIXED_AMOUNT',
                passed,
                detail: passed
                    ? `₺${withdrawal.Amount} <= Sabit ₺${bonusRule.fixed_withdrawal_amount}`
                    : `₺${withdrawal.Amount} > Sabit ₺${bonusRule.fixed_withdrawal_amount}`,
                category: 'BONUS',
                critical: false
            });
        }

        // Ignore deposit rule check (special handling)
        if (bonusRule.ignore_deposit_rule) {
            results.push({
                name: 'BONUS_IGNORE_DEPOSIT',
                passed: true,
                detail: 'Yatırım kuralı atlandı (bonus özel)',
                category: 'BONUS',
                critical: false
            });
        }

        return results;
    }
}

module.exports = RuleEngine;
