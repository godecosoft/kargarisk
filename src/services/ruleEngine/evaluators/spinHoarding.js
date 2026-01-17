// Evaluator: SPIN_HOARDING
// Bahis yapmadan kazanç elde etme (spin gömme) tespiti

module.exports = async function (config, withdrawal, snapshot) {
    if (!config.enabled) {
        return { passed: true, detail: 'Spin gömme kontrolü kapalı' };
    }

    // Risk analizi verisinden kontrol
    const riskAnalysis = snapshot?.turnover?.riskAnalysis;
    if (riskAnalysis?.isRisky && riskAnalysis?.suspiciousWins?.length > 0) {
        const suspiciousGames = riskAnalysis.suspiciousWins
            .map(w => `${w.game}: ₺${w.win}`)
            .join(', ');
        return {
            passed: false,
            detail: `Spin gömme tespit edildi: ${suspiciousGames}`
        };
    }

    // Alternatif: spinHoarding alanı
    const spinHoarding = snapshot?.turnover?.turnover?.spinHoarding;
    if (spinHoarding?.detected) {
        const games = spinHoarding.games?.map(g => g.game).join(', ') || 'Bilinmeyen oyunlar';
        return {
            passed: false,
            detail: `Spin gömme tespit edildi: ${games}`
        };
    }

    return {
        passed: true,
        detail: 'Spin gömme tespit edilmedi'
    };
};
