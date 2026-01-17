// Evaluator Index - Tüm kural değerlendiricileri burada toplanır
// Yeni evaluator eklemek için: 1) dosya oluştur 2) buraya ekle

module.exports = {
    // GENERAL kuralları
    'MAX_AMOUNT': require('./maxAmount'),
    'FORBIDDEN_GAMES': require('./forbiddenGames'),
    'IP_RISK_CHECK': require('./ipRisk'),
    'SPIN_HOARDING': require('./spinHoarding'),

    // NORMAL kuralları
    'REQUIRE_DEPOSIT_TODAY': require('./requireDeposit'),
    'NO_BONUS_AFTER_DEPOSIT': require('./noBonusAfterDeposit'),
    'NO_FREESPIN_BONUS': require('./noFreespin'),
    'TURNOVER_MULTIPLIER': require('./turnoverMultiplier'),
    'MAX_WITHDRAWAL_RATIO': require('./maxWithdrawalRatio'),

    // CASHBACK kuralları
    'CASHBACK_AUTO_APPROVE': require('./cashbackAuto'),
    'CASHBACK_MAX_AMOUNT': require('./cashbackMaxAmount'),
    'CASHBACK_NO_TURNOVER': require('./cashbackNoTurnover'),

    // FREESPIN kuralları
    'FREESPIN_AUTO_APPROVE': require('./freespinAuto')
};
