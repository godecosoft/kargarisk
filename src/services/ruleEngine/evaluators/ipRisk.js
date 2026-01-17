// Evaluator: IP_RISK_CHECK
// Aynı IP'den birden fazla hesap olup olmadığını kontrol eder

module.exports = async function (config, withdrawal, snapshot) {
    const maxAccountsPerIp = config.max_accounts_per_ip || 2;
    const ipAnalysis = snapshot?.ipAnalysis;

    if (!ipAnalysis || !ipAnalysis.uniqueIps) {
        return { passed: true, detail: 'IP analizi verisi yok, kontrol atlandı' };
    }

    // Her IP için diğer hesap sayısını kontrol et
    const riskyIps = [];
    for (const ip of ipAnalysis.uniqueIps) {
        if (ip.otherAccounts && ip.otherAccounts.length >= maxAccountsPerIp) {
            riskyIps.push({
                ip: ip.ip,
                accounts: ip.otherAccounts.length
            });
        }
    }

    if (riskyIps.length > 0) {
        const ipList = riskyIps.map(r => `${r.ip} (${r.accounts} hesap)`).join(', ');
        return {
            passed: false,
            detail: `Çoklu hesap tespit edildi: ${ipList}`
        };
    }

    return {
        passed: true,
        detail: 'Çoklu hesap riski yok'
    };
};
