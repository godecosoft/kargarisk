import { useState, useEffect, useCallback } from 'react';
import {
    CheckCircle,
    XCircle,
    AlertCircle,
    Clock,
    Loader2,
    ChevronRight,
    ChevronDown,
    Banknote,
    Gamepad2,
    Trophy,
    Gift,
    User,
    Calendar,
    AlertTriangle,
    ArrowLeft,
    Wifi,
    Users,
    Sparkles
} from 'lucide-react';
import { fetchNewWithdrawals, fetchClientTurnover, fetchClientBonuses, fetchClientSports, fetchIPAnalysis, fetchBonusTransactions } from '../services/api';

// Store for sharing current checking ID across components
export const autoControlStore = {
    currentCheckingId: null,
    listeners: new Set(),
    setCurrentId(id) {
        this.currentCheckingId = id;
        this.listeners.forEach(fn => fn(id));
    },
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
};

function TurnoverCard({ title, icon: Icon, data, required, colorClass, games, onToggleGames, showGames }) {
    const percentage = data?.percentage || 0;
    const amount = data?.amount || 0;
    const winAmount = data?.winAmount || 0;
    const isComplete = percentage >= 100;

    return (
        <div className={`turnover-card ${colorClass}`}>
            <div className="turnover-header">
                <Icon size={24} />
                <span>{title}</span>
                {games && games.length > 0 && (
                    <button className="toggle-games-btn" onClick={onToggleGames}>
                        {showGames ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                )}
            </div>
            <div className="turnover-body">
                <div className="turnover-amounts">
                    <div className="turnover-row">
                        <span>Gerekli:</span>
                        <span>₺{required?.toLocaleString('tr-TR') || 0}</span>
                    </div>
                    <div className="turnover-row">
                        <span>Bahis:</span>
                        <span>₺{amount.toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="turnover-row">
                        <span>Kazanç:</span>
                        <span>₺{winAmount.toLocaleString('tr-TR')}</span>
                    </div>
                </div>
                <div className="turnover-progress">
                    <div
                        className="turnover-progress-bar"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>
                <div className={`turnover-status ${isComplete ? 'complete' : 'incomplete'}`}>
                    {isComplete ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    <span>%{percentage}</span>
                </div>
            </div>

            {/* Game Breakdown */}
            {showGames && games && games.length > 0 && (
                <div className="game-breakdown">
                    <table className="game-table">
                        <thead>
                            <tr>
                                <th>Oyun</th>
                                <th>Bahis</th>
                                <th>Kazanç</th>
                            </tr>
                        </thead>
                        <tbody>
                            {games.slice(0, 10).map((g, i) => (
                                <tr key={i}>
                                    <td>{g.game}</td>
                                    <td>₺{g.betAmount.toLocaleString('tr-TR')}</td>
                                    <td>₺{g.winAmount.toLocaleString('tr-TR')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function DecisionCard({ decision, reason }) {
    const config = {
        'ONAY': { icon: CheckCircle, color: 'decision-approve', label: 'ONAY' },
        'RET': { icon: XCircle, color: 'decision-reject', label: 'RET' },
        'MANUEL': { icon: AlertTriangle, color: 'decision-manual', label: 'MANUEL' }
    };

    const cfg = config[decision] || config['MANUEL'];
    const Icon = cfg.icon;

    return (
        <div className={`decision-card ${cfg.color}`}>
            <div className="decision-icon">
                <Icon size={48} />
            </div>
            <div className="decision-content">
                <div className="decision-label">KARAR</div>
                <div className="decision-value">{cfg.label}</div>
                <div className="decision-reason">{reason}</div>
            </div>
        </div>
    );
}

function SportsCouponsCard({ sportsData, showCoupons, onToggle }) {
    if (!sportsData || !sportsData.success) return null;

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="card sports-coupons-card">
            <div className="card-header" onClick={onToggle} style={{ cursor: 'pointer' }}>
                <span className="card-title">
                    <Trophy size={18} style={{ marginRight: 8 }} />
                    Spor Kuponları ({sportsData.totalBets || 0})
                </span>
                {showCoupons ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </div>

            {showCoupons && (
                <div className="card-body">
                    {sportsData.hasPreDepositWinning && (
                        <div className="warning-banner">
                            <AlertTriangle size={16} />
                            <span>Yatırım öncesi kazançlı kupon tespit edildi! Manuel kontrole bırakıldı.</span>
                        </div>
                    )}

                    {sportsData.bets && sportsData.bets.length > 0 ? (
                        <div className="coupons-list">
                            {sportsData.bets.map(bet => (
                                <div key={bet.id} className={`coupon-item state-${bet.state}`}>
                                    <div className="coupon-header">
                                        <span className="coupon-id">#{bet.id}</span>
                                        <span className={`coupon-status status-${bet.state}`}>
                                            {bet.stateName}
                                        </span>
                                        <span className="coupon-type">{bet.type}</span>
                                        <span className="coupon-odds">@{bet.odds}</span>
                                    </div>
                                    <div className="coupon-amounts">
                                        <span>Bahis: ₺{bet.amount?.toLocaleString('tr-TR')}</span>
                                        <span>Kazanç: ₺{bet.winningAmount?.toLocaleString('tr-TR') || 0}</span>
                                    </div>
                                    {bet.selections && bet.selections.length > 0 && (
                                        <div className="coupon-selections">
                                            {bet.selections.map((sel, i) => (
                                                <div key={i} className="selection-item">
                                                    <div className="selection-match">{sel.matchName}</div>
                                                    <div className="selection-details">
                                                        <span>{sel.competitionName}</span>
                                                        <span>{sel.displayMarketName}: {sel.selectionName}</span>
                                                        <span className={`selection-result status-${sel.state}`}>
                                                            {sel.stateName}
                                                        </span>
                                                    </div>
                                                    {sel.matchResult && (
                                                        <div className="selection-score">{sel.matchResult}</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="coupon-time">
                                        {formatDateTime(bet.createdAt)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                            Spor kuponu bulunamadı
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

function AutoControlPage({ singleWithdrawal, onBack }) {
    const [newWithdrawals, setNewWithdrawals] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [checkingData, setCheckingData] = useState(null);
    const [bonuses, setBonuses] = useState([]);
    const [sportsData, setSportsData] = useState(null);
    const [ipAnalysis, setIpAnalysis] = useState(null);
    const [bonusTransactions, setBonusTransactions] = useState([]);
    const [showCasinoGames, setShowCasinoGames] = useState(false);
    const [showCoupons, setShowCoupons] = useState(false);
    const [error, setError] = useState(null);

    // Use singleWithdrawal if provided, otherwise use newWithdrawals[currentIndex]
    const currentWithdrawal = singleWithdrawal || newWithdrawals[currentIndex] || null;

    // Load new withdrawals
    const loadNewWithdrawals = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetchNewWithdrawals();
            if (response.success) {
                setNewWithdrawals(response.data || []);
                setCurrentIndex(0);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load current withdrawal details
    const loadWithdrawalDetails = useCallback(async () => {
        if (!currentWithdrawal) {
            autoControlStore.setCurrentId(null);
            return;
        }

        const clientId = currentWithdrawal.ClientId;
        autoControlStore.setCurrentId(currentWithdrawal.Id);

        try {
            // Fetch turnover, bonuses, sports in parallel
            const [turnoverRes, bonusesRes, sportsRes, ipRes, bonusTxRes] = await Promise.all([
                fetchClientTurnover(clientId),
                fetchClientBonuses(clientId, 5),
                fetchClientSports(clientId),
                fetchIPAnalysis(clientId, 7),
                fetchBonusTransactions(clientId)
            ]);

            // Update decision based on sports pre-deposit winning
            if (sportsRes.success && sportsRes.hasPreDepositWinning) {
                turnoverRes.decision = 'MANUEL';
                turnoverRes.decisionReason = 'Yatırım öncesi kazançlı spor kuponu tespit edildi';
            }

            setCheckingData(turnoverRes);
            setBonuses(bonusesRes.success ? bonusesRes.data : []);
            setSportsData(sportsRes);
            setIpAnalysis(ipRes.success ? ipRes : null);
            setBonusTransactions(bonusTxRes.success ? bonusTxRes.data : []);

        } catch (err) {
            console.error('Failed to load details:', err);
            setCheckingData({ success: false, error: err.message });
            setBonuses([]);
            setSportsData(null);
        }
    }, [currentWithdrawal]);

    useEffect(() => {
        // Skip loading new withdrawals if we have a single withdrawal
        if (singleWithdrawal) {
            setLoading(false);
            return;
        }
        loadNewWithdrawals();
        const interval = setInterval(loadNewWithdrawals, 30000);
        return () => {
            clearInterval(interval);
            autoControlStore.setCurrentId(null);
        };
    }, [loadNewWithdrawals, singleWithdrawal]);

    useEffect(() => {
        loadWithdrawalDetails();
        setShowCasinoGames(false);
        setShowCoupons(false);
    }, [loadWithdrawalDetails]);

    const goToNext = () => {
        if (currentIndex < newWithdrawals.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const goToPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Skip loading spinner if we have a single withdrawal to display
    if (!singleWithdrawal && loading && newWithdrawals.length === 0) {
        return (
            <div className="auto-control-page">
                <div className="auto-control-loading">
                    <Loader2 className="spinner" size={48} />
                    <p>Yeni talepler yükleniyor...</p>
                </div>
            </div>
        );
    }

    // Skip empty state check if we have a single withdrawal to display
    if (!singleWithdrawal && newWithdrawals.length === 0) {
        return (
            <div className="auto-control-page">
                <div className="page-header">
                    <h1 className="page-title">Otomatik Kontrol</h1>
                    <p className="page-subtitle">Yeni çekim taleplerini kontrol et</p>
                </div>
                <div className="auto-control-empty">
                    <CheckCircle size={64} />
                    <h2>Kontrol Edilecek Talep Yok</h2>
                    <p>Tüm yeni talepler kontrol edildi</p>
                </div>
            </div>
        );
    }

    return (
        <div className="auto-control-page">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {singleWithdrawal && onBack && (
                        <button className="back-btn" onClick={onBack}>
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1 className="page-title">
                            {singleWithdrawal ? 'Çekim Detayı' : 'Otomatik Kontrol'}
                        </h1>
                        {!singleWithdrawal && (
                            <p className="page-subtitle">
                                Talep {currentIndex + 1} / {newWithdrawals.length}
                            </p>
                        )}
                    </div>
                </div>
                {!singleWithdrawal && (
                    <div className="auto-control-nav">
                        <button
                            className="filter-btn secondary"
                            onClick={goToPrev}
                            disabled={currentIndex === 0}
                        >
                            ← Önceki
                        </button>
                        <button
                            className="filter-btn"
                            onClick={goToNext}
                            disabled={currentIndex === newWithdrawals.length - 1}
                        >
                            Sonraki →
                        </button>
                    </div>
                )}
            </div>

            {/* Current Withdrawal Info */}
            <div className="current-withdrawal-card">
                <div className="current-withdrawal-header">
                    <div className="current-withdrawal-player">
                        <User size={20} />
                        <span className="player-name">
                            {currentWithdrawal.ClientName || `${currentWithdrawal.ClientFirstName} ${currentWithdrawal.ClientLastName}`}
                        </span>
                        <span className="player-id">#{currentWithdrawal.ClientId}</span>
                    </div>
                    <div className="current-withdrawal-amount">
                        {formatCurrency(currentWithdrawal.Amount)}
                    </div>
                </div>
                <div className="current-withdrawal-details">
                    <div className="detail-item">
                        <span>Talep ID:</span>
                        <span>{currentWithdrawal.Id}</span>
                    </div>
                    <div className="detail-item">
                        <span>Yöntem:</span>
                        <span>{currentWithdrawal.PaymentSystemName}</span>
                    </div>
                    <div className="detail-item">
                        <span>Tarih:</span>
                        <span>{formatDateTime(currentWithdrawal.RequestTimeLocal)}</span>
                    </div>
                    <div className="detail-item">
                        <span>Login:</span>
                        <span>{currentWithdrawal.ClientLogin}</span>
                    </div>
                </div>
            </div>

            {/* Turnover Cards */}
            <div className="turnover-grid">
                <TurnoverCard
                    title="Casino Çevrim"
                    icon={Gamepad2}
                    data={checkingData?.turnover?.casino}
                    required={checkingData?.turnover?.required}
                    colorClass="casino"
                    games={checkingData?.turnover?.casino?.games}
                    showGames={showCasinoGames}
                    onToggleGames={() => setShowCasinoGames(!showCasinoGames)}
                />
                <TurnoverCard
                    title="Spor Çevrim"
                    icon={Trophy}
                    data={checkingData?.turnover?.sports}
                    required={checkingData?.turnover?.required}
                    colorClass="sports"
                />
            </div>

            {/* Decision Card */}
            {checkingData && (
                <DecisionCard
                    decision={checkingData.decision}
                    reason={checkingData.decisionReason}
                />
            )}

            {/* Deposit Info */}
            {checkingData?.deposit && (
                <div className="deposit-info-card">
                    <Banknote size={20} />
                    <span>Son Yatırım: {formatCurrency(checkingData.deposit.amount)}</span>
                    <span className="deposit-date">{formatDateTime(checkingData.deposit.time)}</span>
                </div>
            )}

            {/* Sports Coupons */}
            <SportsCouponsCard
                sportsData={sportsData}
                showCoupons={showCoupons}
                onToggle={() => setShowCoupons(!showCoupons)}
            />

            {/* Bonuses Table */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                    <span className="card-title">
                        <Gift size={18} style={{ marginRight: 8 }} />
                        Son 5 Bonus
                    </span>
                </div>
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Bonus Adı</th>
                                <th>Tür</th>
                                <th>Tutar</th>
                                <th>Tarih</th>
                                <th>Durum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bonuses.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: 20 }}>
                                        Bonus bulunamadı
                                    </td>
                                </tr>
                            ) : (
                                bonuses.map(bonus => (
                                    <tr key={bonus.id}>
                                        <td>{bonus.name}</td>
                                        <td>{bonus.typeName}</td>
                                        <td>{formatCurrency(bonus.amount)}</td>
                                        <td>{formatDateTime(bonus.createdAt)}</td>
                                        <td>
                                            <span className={`status-badge ${bonus.status === 'Aktif' ? 'processing' :
                                                bonus.status === 'Tamamlandı' ? 'approved' :
                                                    'rejected'
                                                }`}>
                                                <span className="status-dot"></span>
                                                {bonus.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* FreeSpin & Bonus Transactions Card */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                    <span className="card-title">
                        <Sparkles size={18} style={{ marginRight: 8 }} />
                        Yatırım Sonrası FreeSpin & Bonus
                    </span>
                    <span className="status-badge info" style={{ background: 'var(--status-processing-bg)', color: 'var(--status-processing)' }}>
                        {bonusTransactions.length} İşlem
                    </span>
                </div>
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tür</th>
                                <th>Oyun/Kaynak</th>
                                <th>Tutar</th>
                                <th>Önceki Bakiye</th>
                                <th>Sonraki Bakiye</th>
                                <th>Tarih</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bonusTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                                        Yatırım sonrası FreeSpin veya Bonus işlemi bulunamadı
                                    </td>
                                </tr>
                            ) : (
                                bonusTransactions.map((tx, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <span className={`status-badge ${tx.type === 'FREESPIN' ? 'processing' : 'approved'}`}>
                                                {tx.type === 'FREESPIN' ? '🎰 FreeSpin' : '🎁 Bonus'}
                                            </span>
                                        </td>
                                        <td>{tx.game || 'Pay Client Bonus'}</td>
                                        <td style={{ color: 'var(--status-approved)', fontWeight: 600 }}>+{formatCurrency(tx.amount)}</td>
                                        <td>{formatCurrency(tx.balanceBefore)}</td>
                                        <td>{formatCurrency(tx.balance)}</td>
                                        <td>{formatDateTime(tx.time)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* IP Control Card */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                    <span className="card-title">
                        <Wifi size={18} style={{ marginRight: 8 }} />
                        IP Kontrolü (Son 7 Gün)
                    </span>
                    {ipAnalysis?.hasMultiAccount && (
                        <span className="status-badge rejected">
                            <AlertTriangle size={14} /> Çoklu Hesap Tespit Edildi!
                        </span>
                    )}
                </div>
                <div className="card-body">
                    {!ipAnalysis ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                            IP analizi yükleniyor...
                        </div>
                    ) : ipAnalysis.analysis?.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                            Login kaydı bulunamadı
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                                <div style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Toplam Giriş</span>
                                    <div style={{ fontSize: 18, fontWeight: 600 }}>{ipAnalysis.totalLogins}</div>
                                </div>
                                <div style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Farklı IP</span>
                                    <div style={{ fontSize: 18, fontWeight: 600 }}>{ipAnalysis.uniqueIPs}</div>
                                </div>
                                {ipAnalysis.hasMultiAccount && (
                                    <div style={{ padding: '8px 16px', background: 'var(--status-rejected-bg)', borderRadius: 'var(--radius-md)' }}>
                                        <span style={{ color: 'var(--status-rejected)', fontSize: 12 }}>Diğer Hesaplar</span>
                                        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--status-rejected)' }}>{ipAnalysis.totalOtherAccounts}</div>
                                    </div>
                                )}
                            </div>

                            {ipAnalysis.analysis.map((ipData, idx) => (
                                <div key={idx} style={{
                                    padding: 12,
                                    background: ipData.otherAccounts.length > 0 ? 'var(--status-rejected-bg)' : 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: ipData.otherAccounts.length > 0 ? '1px solid var(--status-rejected)' : 'none'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600 }}>
                                            {ipData.ip}
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {ipData.loginCount} giriş • {ipData.source}
                                        </div>
                                    </div>

                                    {ipData.otherAccounts.length > 0 && (
                                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                                            <div style={{ fontSize: 12, color: 'var(--status-rejected)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Users size={14} /> Bu IP'yi kullanan diğer hesaplar:
                                            </div>
                                            {ipData.otherAccounts.map((acc, accIdx) => (
                                                <div key={accIdx} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    padding: '6px 10px',
                                                    background: 'var(--bg-card)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    marginTop: 4,
                                                    fontSize: 13
                                                }}>
                                                    <span style={{ fontWeight: 500 }}>{acc.login}</span>
                                                    <span style={{ color: 'var(--text-muted)' }}>
                                                        ID: {acc.clientId} • {acc.loginCount} giriş • Kayıt: {formatDateTime(acc.registrationDate)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .auto-control-page { max-width: 1200px; }
                
                .auto-control-loading, .auto-control-empty {
                    display: flex; flex-direction: column; align-items: center;
                    justify-content: center; padding: 80px 20px; text-align: center;
                    color: var(--text-muted);
                }
                .auto-control-empty svg { color: var(--status-approved); margin-bottom: 16px; }
                .auto-control-empty h2 { color: var(--text-primary); margin-bottom: 8px; }
                .auto-control-nav { display: flex; gap: 12px; }
                
                .current-withdrawal-card {
                    background: var(--bg-card); border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg); padding: 20px; margin-bottom: 24px;
                }
                .current-withdrawal-header {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle);
                }
                .current-withdrawal-player { display: flex; align-items: center; gap: 10px; }
                .current-withdrawal-player .player-name { font-size: 18px; font-weight: 600; color: var(--text-primary); }
                .current-withdrawal-player .player-id { color: var(--text-muted); font-size: 14px; }
                .current-withdrawal-amount { font-size: 28px; font-weight: 700; color: var(--accent-primary); }
                .current-withdrawal-details { display: flex; gap: 32px; flex-wrap: wrap; }
                .detail-item { display: flex; flex-direction: column; gap: 4px; }
                .detail-item span:first-child { font-size: 12px; color: var(--text-muted); text-transform: uppercase; }
                .detail-item span:last-child { font-size: 14px; color: var(--text-primary); }
                
                .turnover-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
                .turnover-card { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px; }
                .turnover-card.casino { border-left: 4px solid #8b5cf6; }
                .turnover-card.sports { border-left: 4px solid #10b981; }
                .turnover-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; font-size: 16px; font-weight: 600; color: var(--text-primary); }
                .turnover-card.casino .turnover-header svg { color: #8b5cf6; }
                .turnover-card.sports .turnover-header svg { color: #10b981; }
                .toggle-games-btn { margin-left: auto; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; }
                .turnover-amounts { margin-bottom: 12px; }
                .turnover-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px; }
                .turnover-row span:first-child { color: var(--text-muted); }
                .turnover-row span:last-child { color: var(--text-primary); font-weight: 500; }
                .turnover-progress { height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden; margin-bottom: 12px; }
                .turnover-progress-bar { height: 100%; background: linear-gradient(90deg, var(--accent-primary), #6366f1); border-radius: 4px; transition: width 0.3s ease; }
                .turnover-status { display: flex; align-items: center; gap: 6px; font-size: 18px; font-weight: 700; }
                .turnover-status.complete { color: var(--status-approved); }
                .turnover-status.incomplete { color: var(--status-pending); }
                
                .game-breakdown { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-subtle); }
                .game-table { width: 100%; font-size: 12px; }
                .game-table th { text-align: left; color: var(--text-muted); padding: 4px 8px; }
                .game-table td { padding: 4px 8px; color: var(--text-secondary); }
                .game-table tr:nth-child(even) { background: var(--bg-tertiary); }
                
                .decision-card { display: flex; align-items: center; gap: 20px; padding: 24px; border-radius: var(--radius-lg); margin-bottom: 16px; }
                .decision-card.decision-approve { background: rgba(52, 199, 89, 0.1); border: 2px solid var(--status-approved); }
                .decision-card.decision-reject { background: rgba(255, 87, 87, 0.1); border: 2px solid var(--status-rejected); }
                .decision-card.decision-manual { background: rgba(255, 181, 69, 0.1); border: 2px solid var(--status-pending); }
                .decision-icon { flex-shrink: 0; }
                .decision-approve .decision-icon { color: var(--status-approved); }
                .decision-reject .decision-icon { color: var(--status-rejected); }
                .decision-manual .decision-icon { color: var(--status-pending); }
                .decision-content { flex: 1; }
                .decision-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
                .decision-value { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
                .decision-approve .decision-value { color: var(--status-approved); }
                .decision-reject .decision-value { color: var(--status-rejected); }
                .decision-manual .decision-value { color: var(--status-pending); }
                .decision-reason { font-size: 14px; color: var(--text-secondary); }
                
                .deposit-info-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-tertiary); border-radius: var(--radius-md); color: var(--text-secondary); font-size: 14px; margin-bottom: 16px; }
                .deposit-info-card svg { color: var(--accent-primary); }
                .deposit-date { color: var(--text-muted); margin-left: auto; }
                
                .sports-coupons-card .card-header { display: flex; justify-content: space-between; align-items: center; }
                .warning-banner { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: rgba(255, 181, 69, 0.15); border: 1px solid var(--status-pending); border-radius: var(--radius-md); margin-bottom: 16px; color: var(--status-pending); font-size: 14px; }
                .coupons-list { display: flex; flex-direction: column; gap: 12px; }
                .coupon-item { background: var(--bg-tertiary); border-radius: var(--radius-md); padding: 12px; border-left: 3px solid var(--text-muted); }
                .coupon-item.state-4 { border-left-color: var(--status-approved); }
                .coupon-item.state-2 { border-left-color: var(--status-rejected); }
                .coupon-item.state-5 { border-left-color: var(--status-pending); }
                .coupon-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; font-size: 13px; }
                .coupon-id { font-family: monospace; color: var(--text-muted); }
                .coupon-status { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
                .status-4 { background: rgba(52, 199, 89, 0.2); color: var(--status-approved); }
                .status-2 { background: rgba(255, 87, 87, 0.2); color: var(--status-rejected); }
                .status-5 { background: rgba(255, 181, 69, 0.2); color: var(--status-pending); }
                .status-1 { background: rgba(74, 158, 255, 0.2); color: var(--accent-primary); }
                .coupon-type { color: var(--text-secondary); }
                .coupon-odds { font-weight: 600; color: var(--text-primary); margin-left: auto; }
                .coupon-amounts { display: flex; gap: 16px; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
                .coupon-selections { border-top: 1px solid var(--border-subtle); padding-top: 8px; margin-top: 8px; }
                .selection-item { padding: 6px 0; border-bottom: 1px dashed var(--border-subtle); }
                .selection-item:last-child { border-bottom: none; }
                .selection-match { font-weight: 500; color: var(--text-primary); font-size: 13px; }
                .selection-details { display: flex; gap: 12px; font-size: 12px; color: var(--text-muted); margin-top: 4px; }
                .selection-result { font-weight: 600; }
                .selection-score { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
                .coupon-time { font-size: 11px; color: var(--text-muted); margin-top: 8px; text-align: right; }
                
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .back-btn {
                    display: flex; align-items: center; justify-content: center;
                    width: 40px; height: 40px; border-radius: 50%;
                    background: var(--bg-tertiary); border: 1px solid var(--border-subtle);
                    color: var(--text-primary); cursor: pointer;
                    transition: all 0.2s ease;
                }
                .back-btn:hover { background: var(--bg-card); border-color: var(--accent-primary); }
            `}</style>
        </div>
    );
}

export default AutoControlPage;
