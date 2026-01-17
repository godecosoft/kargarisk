// Evaluator: FORBIDDEN_GAMES
// Yasaklı oyunlardan kazanç olup olmadığını kontrol eder

module.exports = async function (config, withdrawal, snapshot) {
    const patterns = config.patterns || [];
    const casinoGames = snapshot?.turnover?.turnover?.casino?.games || [];

    if (patterns.length === 0) {
        return { passed: true, detail: 'Yasaklı oyun listesi boş' };
    }

    for (const game of casinoGames) {
        const gameName = (game.game || game.name || '').toLowerCase();
        for (const pattern of patterns) {
            if (gameName.includes(pattern.toLowerCase())) {
                return {
                    passed: false,
                    detail: `Yasaklı oyun tespit edildi: ${gameName}`
                };
            }
        }
    }

    return {
        passed: true,
        detail: 'Yasaklı oyun bulunamadı'
    };
};
