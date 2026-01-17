/**
 * Compact Withdrawal Detail Page
 * Single-screen layout with 3-column grid
 * No scrolling needed - all info visible at once
 */

import { useState, useEffect, useCallback } from 'react';
import {
    CheckCircle, XCircle, AlertCircle, ArrowLeft, Wifi,
    AlertTriangle, Trophy, Gamepad2, Gift, ChevronDown, ChevronUp, Info, X
} from 'lucide-react';
import {
    fetchClientTurnover, fetchClientBonuses, fetchClientSports,
    fetchIPAnalysis, fetchBonusTransactions
} from '../services/api';

// Circular Progress Component - Casino (yeşil) + Spor (mavi) - Oransal
function CircularProgress({ percentage, casinoPercentage = 0, sportsPercentage = 0, size = 120 }) {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    const isComplete = percentage >= 100;
    const total = casinoPercentage + sportsPercentage;

    // Toplam 100'ü geçiyorsa oransal olarak paylaştır
    let casinoVisual, sportsVisual;
    if (total > 100) {
        // Oransal paylaşım - daire tamamen dolu
        casinoVisual = (casinoPercentage / total) * 100;
        sportsVisual = (sportsPercentage / total) * 100;
    } else {
        // Toplam 100'ün altındaysa direkt göster
        casinoVisual = casinoPercentage;
        sportsVisual = sportsPercentage;
    }

    // Casino segmenti - yeşil (üstten başlar)
    const casinoLength = (casinoVisual / 100) * circumference;
    const casinoOffset = circumference - casinoLength;

    // Spor segmenti - mavi (casino'nun bittiği yerden)
    const sportsLength = (sportsVisual / 100) * circumference;
    const sportsOffset = circumference - sportsLength;
    const sportsRotation = -90 + (casinoVisual / 100) * 360;

    return (
        <div className="circular-progress" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                {/* Arka plan dairesi */}
                <circle
                    className="progress-bg"
                    cx={size / 2} cy={size / 2} r={radius}
                    strokeWidth={strokeWidth} fill="none"
                />
                {/* Casino segmenti - yeşil (önce çizilir) */}
                {casinoVisual > 0 && (
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        strokeWidth={strokeWidth} fill="none"
                        stroke={isComplete ? '#22c55e' : '#22c55e'}
                        strokeDasharray={circumference}
                        strokeDashoffset={casinoOffset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                )}
                {/* Spor segmenti - mavi (casino'dan sonra) */}
                {sportsVisual > 0 && (
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        strokeWidth={strokeWidth} fill="none"
                        stroke="#3b82f6"
                        strokeDasharray={circumference}
                        strokeDashoffset={sportsOffset}
                        transform={`rotate(${sportsRotation} ${size / 2} ${size / 2})`}
                    />
                )}
            </svg>
            <div className="progress-text">
                <span className="percentage">{percentage}%</span>
            </div>
        </div>
    );
}

// Decision Badge Component
function DecisionBadge({ decision }) {
    const config = {
        'ONAY': { icon: CheckCircle, class: 'approved', text: 'ONAY' },
        'RET': { icon: XCircle, class: 'rejected', text: 'RET' },
        'MANUEL': { icon: AlertCircle, class: 'manual', text: 'MANUEL' }
    };
    const { icon: Icon, class: cls, text } = config[decision] || config['MANUEL'];

    return (
        <div className={`decision-badge-large ${cls}`}>
            <Icon size={24} />
            <span>{text}</span>
        </div>
    );
}

// Format helpers
const formatCurrency = (amount) => `₺${(amount || 0).toLocaleString('tr-TR')}`;
const formatTime = (date) => new Date(date).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
});

export default function CompactDetailPage({ withdrawal, onBack }) {
    const [turnover, setTurnover] = useState(null);
    const [sports, setSports] = useState(null);
    const [bonuses, setBonuses] = useState([]);
    const [bonusTx, setBonusTx] = useState([]);
    const [ipAnalysis, setIpAnalysis] = useState(null);
    const [clientKpi, setClientKpi] = useState(null);
    const [clientDetails, setClientDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedIps, setExpandedIps] = useState({}); // Accordion için
    const [showDecisionModal, setShowDecisionModal] = useState(false); // Karar Özeti modal
    const [ruleEvaluation, setRuleEvaluation] = useState(null); // Kural değerlendirme verisi

    // Load all data
    useEffect(() => {
        if (!withdrawal) return;

        const loadData = async () => {
            setLoading(true);
            const clientId = withdrawal.ClientId;

            try {
                // Try snapshot first
                const { fetchWithdrawalSnapshot } = await import('../services/api');
                const snapshot = await fetchWithdrawalSnapshot(withdrawal.Id);

                console.log('[DEBUG] Snapshot received:', {
                    id: withdrawal.Id,
                    hasRuleEvaluation: !!snapshot.ruleEvaluation,
                    hasDecisionData: !!snapshot.turnover?.decisionData,
                    decisionDataKeys: snapshot.turnover?.decisionData ? Object.keys(snapshot.turnover.decisionData) : [],
                    ruleEvaluation: snapshot.ruleEvaluation,
                    turnoverDecisionData: snapshot.turnover?.decisionData?.ruleEvaluation
                });

                if (snapshot.success && snapshot.fromDB) {
                    setTurnover(snapshot.turnover);
                    setSports(snapshot.sports);
                    setBonuses(snapshot.bonuses || []);
                    setBonusTx(snapshot.bonusTransactions?.data || []);
                    setIpAnalysis(snapshot.ipAnalysis);

                    // SET RULE EVALUATION - try multiple sources
                    const ruleData = snapshot.ruleEvaluation
                        || snapshot.turnover?.decisionData?.ruleEvaluation
                        || null;
                    console.log('[DEBUG] Setting ruleEvaluation:', ruleData);
                    setRuleEvaluation(ruleData);
                } else {
                    // Fallback to live API
                    const [t, s, b, bt, ip] = await Promise.all([
                        fetchClientTurnover(clientId),
                        fetchClientSports(clientId),
                        fetchClientBonuses(clientId, 5),
                        fetchBonusTransactions(clientId),
                        fetchIPAnalysis(clientId, 7)
                    ]);
                    setTurnover(t);
                    setSports(s);
                    setBonuses(b.data || []);
                    setBonusTx(bt.data || []);
                    setIpAnalysis(ip);
                }

                // Always fetch fresh KPI and Client Details
                const { fetchClientKpi, fetchClientDetails } = await import('../services/api');
                const [kpiRes, detailsRes] = await Promise.all([
                    fetchClientKpi(clientId),
                    fetchClientDetails(clientId)
                ]);
                if (kpiRes.success) setClientKpi(kpiRes.data);
                if (detailsRes.success) setClientDetails(detailsRes.data);
            } catch (e) {
                console.error('Load error:', e);
            }
            setLoading(false);
        };

        loadData();
    }, [withdrawal]);

    if (!withdrawal) return null;

    const decision = turnover?.decision || withdrawal?.decisionData?.decision || 'MANUEL';
    const decisionReason = turnover?.decisionReason || withdrawal?.decisionData?.reason || '';
    const casinoGames = turnover?.turnover?.casino?.games || [];
    const sportsBets = sports?.bets || [];
    const totalPercentage = turnover?.turnover?.total?.percentage || 0;

    // ruleEvaluation is now a state variable set from snapshot

    // SPİN GÖMME TESPİTİ
    // Backend'den gelen kronolojik kontrol sonucu
    const spinHoardingData = turnover?.turnover?.spinHoarding || { detected: false, games: [] };

    // Alternatif: Her oyundaki suspiciousFirstWin alanını kontrol et
    const gamesWithSuspiciousWin = casinoGames.filter(g => g.suspiciousFirstWin);

    // Eğer backend'den geldiyse onu kullan, yoksa oyun bazlı kontrol
    const hasSpinHoarding = spinHoardingData.detected || gamesWithSuspiciousWin.length > 0;
    const spinHoardingDetails = spinHoardingData.detected
        ? spinHoardingData.games.map(g => ({
            game: g.game,
            amount: g.winAmount,
            time: g.winTime
        }))
        : gamesWithSuspiciousWin.map(g => ({
            game: g.game,
            amount: g.suspiciousFirstWin?.winAmount || g.winAmount,
            time: g.suspiciousFirstWin?.winTime
        }));

    // DEBUG LOG
    console.log('[FRONTEND] spinHoardingData:', spinHoardingData);
    console.log('[FRONTEND] hasSpinHoarding:', hasSpinHoarding);

    return (
        <div className="compact-detail-page">
            {/* Header Bar */}
            <div className="detail-header">
                <button className="back-btn" onClick={onBack}>
                    <ArrowLeft size={20} /> Geri
                </button>
                <div className="player-info">
                    <div className="player-main">
                        <span className="player-name">{withdrawal.ClientLogin}</span>
                        <span className="amount">{formatCurrency(withdrawal.Amount)}</span>
                        <span className="payment-method">{withdrawal.PaymentSystemName || 'Bilinmiyor'}</span>
                    </div>
                    <span className={`status-chip state-${withdrawal.State}`}>
                        {withdrawal.State === 0 ? 'YENİ' : withdrawal.State === 1 ? 'BEKLEMEDE' : withdrawal.State === 2 ? 'ÖDENDİ' : 'REDDEDİLDİ'}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <DecisionBadge decision={decision} />
                    <button
                        onClick={() => setShowDecisionModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px', borderRadius: '8px',
                            background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 600
                        }}
                    >
                        <Info size={16} /> Karar Özeti
                    </button>
                </div>
            </div>

            {/* Decision Reason */}
            {decisionReason && (
                <div
                    className="decision-reason"
                    onClick={() => setShowDecisionModal(true)}
                    style={{ cursor: 'pointer' }}
                    title="Detaylar için tıklayın"
                >
                    {decisionReason}
                </div>
            )}

            {/* HIGH RISK BANNER - SPİN GÖMME TESPİTİ */}
            {hasSpinHoarding && (
                <div className="risk-banner" style={{
                    background: 'rgba(239, 68, 68, 0.15)', border: '2px solid var(--status-rejected)',
                    borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px',
                    color: 'var(--status-rejected)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <AlertTriangle size={24} />
                        <div style={{ fontWeight: '700', fontSize: '16px' }}>🚨 SPİN GÖMME TESPİT EDİLDİ</div>
                    </div>
                    <div style={{ fontSize: '13px', marginBottom: '8px', opacity: 0.9 }}>
                        Yatırım sonrası ilk işlem olarak kazanç gelen oyunlar (öncesinde bahis yok):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {spinHoardingDetails.map((item, idx) => (
                            <div key={idx} style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                fontSize: '13px',
                                fontWeight: '600',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span>🎰 {item.game}</span>
                                <span>
                                    ₺{(item.amount || 0).toLocaleString('tr-TR')}
                                    {item.time && <small style={{ marginLeft: '8px', opacity: 0.7 }}>
                                        ({new Date(item.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})
                                    </small>}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Client KPI Stats Bar */}
            {(clientKpi || clientDetails) && (
                <div className="kpi-bar">
                    {clientDetails && (
                        <>
                            <div className="kpi-stat balance">
                                <span className="kpi-label">Bakiye</span>
                                <span className="kpi-value">{formatCurrency(clientDetails.balance)}</span>
                            </div>
                            <div className={`kpi-stat ${clientDetails.isVerified ? 'verified' : 'unverified'}`}>
                                <span className="kpi-label">KYC</span>
                                <span className="kpi-value">{clientDetails.isVerified ? '✓ Onaylı' : '✗ Onaysız'}</span>
                            </div>
                            {clientDetails.birthDate && (
                                <div className="kpi-stat" style={{
                                    border: clientDetails.age >= 60 ? '1px solid var(--status-rejected)' :
                                        clientDetails.age >= 55 ? '1px solid var(--status-pending)' : '1px solid transparent',
                                    background: clientDetails.age >= 60 ? 'rgba(239, 68, 68, 0.1)' :
                                        clientDetails.age >= 55 ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                    borderRadius: '6px',
                                    paddingRight: '12px',
                                    paddingLeft: '12px'
                                }}>
                                    <span className="kpi-label">Yaş</span>
                                    <span className="kpi-value" style={{
                                        color: clientDetails.age >= 60 ? 'var(--status-rejected)' :
                                            clientDetails.age >= 55 ? 'var(--status-pending)' : 'inherit',
                                        fontWeight: clientDetails.age >= 55 ? '700' : 'inherit'
                                    }}>
                                        {clientDetails.age} <small style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>({new Date(clientDetails.birthDate).toLocaleDateString('tr-TR')})</small>
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                    {clientKpi && (
                        <>
                            <div className="kpi-stat">
                                <span className="kpi-label">Toplam Yatırım</span>
                                <span className="kpi-value">{formatCurrency(clientKpi.depositAmount)} <small>({clientKpi.depositCount}x)</small></span>
                            </div>
                            <div className="kpi-stat">
                                <span className="kpi-label">Toplam Çekim</span>
                                <span className="kpi-value">{formatCurrency(clientKpi.withdrawalAmount)} <small>({clientKpi.withdrawalCount}x)</small></span>
                            </div>
                            <div className="kpi-stat">
                                <span className="kpi-label">Son Çekim</span>
                                <span className="kpi-value">
                                    {formatCurrency(clientKpi.lastWithdrawalAmount)}
                                    {clientKpi.lastWithdrawalTime && (
                                        <small> • {formatTime(clientKpi.lastWithdrawalTime)}</small>
                                    )}
                                </span>
                            </div>
                            <div className="kpi-stat">
                                <span className="kpi-label">Spor Bahis</span>
                                <span className="kpi-value">{clientKpi.totalSportBets} <small>({clientKpi.totalUnsettledBets} açık)</small></span>
                            </div>
                            {clientKpi.btag && (
                                <div className="kpi-stat btag">
                                    <span className="kpi-label">BTag</span>
                                    <span className="kpi-value">{clientKpi.btag}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {loading ? (
                <div className="loading-indicator">Yükleniyor...</div>
            ) : (
                <>
                    {/* Main 3-Column Grid */}
                    <div className="detail-grid">
                        {/* Left: Çevrim Durumu */}
                        <div className="detail-card turnover-card">
                            <div className="card-title">Çevrim Durumu</div>
                            <div className="turnover-content">
                                <CircularProgress
                                    percentage={totalPercentage}
                                    casinoPercentage={turnover?.turnover?.casino?.percentage || 0}
                                    sportsPercentage={turnover?.turnover?.sports?.percentage || 0}
                                />
                                <div className="turnover-stats">
                                    <div className="stat-row">
                                        <span>
                                            {turnover?.withdrawalType?.type === 'FREESPIN' ? 'FreeSpin Tutarı:' :
                                                turnover?.withdrawalType?.type === 'BONUS' ? 'Bonus Tutarı:' :
                                                    turnover?.withdrawalType?.type === 'CASHBACK' ? 'Cashback:' :
                                                        'Yatırım:'}
                                        </span>
                                        <span>
                                            {formatCurrency(turnover?.deposit?.amount)}
                                            {turnover?.withdrawalType?.type === 'FREESPIN' && ' 🎰'}
                                            {turnover?.withdrawalType?.type === 'BONUS' && ' 🎁'}
                                        </span>
                                    </div>
                                    {turnover?.deposit?.time && (
                                        <div className="stat-row time-row">
                                            <span></span>
                                            <span className="time-text">{formatTime(turnover.deposit.time)}</span>
                                        </div>
                                    )}
                                    <div className="stat-row casino-row">
                                        <span>Casino:</span>
                                        <span>{formatCurrency(turnover?.turnover?.casino?.amount)} ({turnover?.turnover?.casino?.percentage || 0}%)</span>
                                    </div>
                                    <div className="stat-row sports-row">
                                        <span>Spor:</span>
                                        <span>{formatCurrency(turnover?.turnover?.sports?.amount)} ({turnover?.turnover?.sports?.percentage || 0}%)</span>
                                    </div>
                                    <div className="stat-row highlight">
                                        <span>Toplam:</span>
                                        <span className={totalPercentage >= 100 ? 'complete' : 'incomplete'}>
                                            %{totalPercentage}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Casino Top 5 - SOL KARTA TAŞINDI */}
                            <div className="sub-section" style={{ marginTop: '16px' }}>
                                <div className="section-title">
                                    <Gamepad2 size={16} /> Casino Top 5
                                    {casinoGames.length > 0 && (
                                        <span className={`section-total ${casinoGames.reduce((sum, g) => sum + (g.winAmount - g.betAmount), 0) >= 0 ? 'positive' : 'negative'}`}>
                                            Net: {formatCurrency(casinoGames.reduce((sum, g) => sum + (g.winAmount - g.betAmount), 0))}
                                        </span>
                                    )}
                                </div>
                                {casinoGames.length === 0 ? (
                                    <div className="empty-message">Casino oyunu yok</div>
                                ) : (
                                    <div className="mini-list">
                                        {casinoGames.slice(0, 5).map((g, i) => (
                                            <div key={i} className="mini-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '2px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="item-name">{g.game}</span>
                                                    <span className={`item-amount ${g.winAmount > g.betAmount ? 'positive' : 'negative'}`}>
                                                        {formatCurrency(g.winAmount - g.betAmount)}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                                                    <span>Bahis: {formatCurrency(g.betAmount)}</span>
                                                    <span>Kazanç: {formatCurrency(g.winAmount)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Middle: SADECE Spor Kuponları */}
                        <div className="detail-card middle-card" style={{ display: 'flex', flexDirection: 'column' }}>
                            {/* Spor Kuponları */}
                            <div className="sub-section">
                                <div className="section-title">
                                    <Trophy size={16} /> Spor Kuponları
                                    {sportsBets.length > 0 && (
                                        <span className={`section-total ${sportsBets.reduce((sum, b) => sum + ((b.winningAmount || 0) - (b.amount || 0)), 0) >= 0 ? 'positive' : 'negative'}`}>
                                            Net: {formatCurrency(sportsBets.reduce((sum, b) => sum + ((b.winningAmount || 0) - (b.amount || 0)), 0))}
                                        </span>
                                    )}
                                </div>

                                {/* PRE-DEPOSIT UYARI */}
                                {sports?.hasPreDepositWinning && sports?.preDepositWinningBet && (
                                    <div style={{
                                        background: 'rgba(245, 158, 11, 0.15)',
                                        border: '1px solid rgba(245, 158, 11, 0.4)',
                                        borderRadius: '6px',
                                        padding: '8px 10px',
                                        marginBottom: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <AlertTriangle size={14} color="#f59e0b" />
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b' }}>
                                                Yatırımdan Önce Oluşturulan Kupon
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                            Bahis: {formatCurrency(sports.preDepositWinningBet.amount)} → Kazanç: {formatCurrency(sports.preDepositWinningBet.winningAmount)}
                                            <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                                                {formatTime(sports.preDepositWinningBet.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {sportsBets.length === 0 ? (
                                    <div className="empty-message">Kupon yok</div>
                                ) : (
                                    <div style={{
                                        flex: 1,
                                        overflowY: 'auto',
                                        maxHeight: '400px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        {sportsBets.map((bet, i) => (
                                            <div key={i} style={{
                                                background: 'var(--bg-tertiary)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '6px',
                                                padding: '10px'
                                            }}>
                                                {/* Header: Kupon ID + Durum + Oran */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>#{bet.id}</span>
                                                        <span style={{
                                                            fontSize: '10px',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            fontWeight: 600,
                                                            background: bet.state === 4 ? 'rgba(34,197,94,0.15)' :
                                                                bet.state === 2 ? 'rgba(239,68,68,0.15)' :
                                                                    bet.state === 5 ? 'rgba(245,158,11,0.15)' :
                                                                        bet.state === 3 ? 'rgba(99,102,241,0.15)' :
                                                                            'rgba(156,163,175,0.15)',
                                                            color: bet.state === 4 ? 'var(--status-approved)' :
                                                                bet.state === 2 ? 'var(--status-rejected)' :
                                                                    bet.state === 5 ? 'var(--status-pending)' :
                                                                        bet.state === 3 ? 'var(--accent-primary)' :
                                                                            'var(--text-muted)'
                                                        }}>
                                                            {bet.stateName}
                                                        </span>
                                                        {bet.isCashout && <span style={{ fontSize: '10px', color: '#f59e0b' }}>💰 Cashout</span>}
                                                    </div>
                                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                                        Oran: {bet.odds?.toFixed(2) || '-'}
                                                    </span>
                                                </div>

                                                {/* Maç Detayları */}
                                                {bet.selections && bet.selections.length > 0 && (
                                                    <div style={{ marginBottom: '6px' }}>
                                                        {bet.selections.length > 1 && (
                                                            <div style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '4px' }}>
                                                                Kombine ({bet.selections.length})
                                                            </div>
                                                        )}
                                                        {bet.selections.slice(0, 3).map((s, idx) => (
                                                            <div key={idx} style={{
                                                                fontSize: '11px',
                                                                color: 'var(--text-primary)',
                                                                padding: '3px 0',
                                                                borderBottom: idx < Math.min(bet.selections.length, 3) - 1 ? '1px solid var(--border-subtle)' : 'none'
                                                            }}>
                                                                <div style={{ fontWeight: 500 }}>{s.matchName}</div>
                                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                                    {s.marketName}: <span style={{ color: 'var(--accent-primary)' }}>{s.selectionName}</span>
                                                                    {s.odds && <span style={{ marginLeft: '6px' }}>@{s.odds?.toFixed(2)}</span>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {bet.selections.length > 3 && (
                                                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                                +{bet.selections.length - 3} daha...
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Footer: Bahis → Kazanç */}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    paddingTop: '6px',
                                                    borderTop: '1px solid var(--border-subtle)',
                                                    fontSize: '12px',
                                                    fontWeight: 600
                                                }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>
                                                        Bahis: {formatCurrency(bet.amount)}
                                                    </span>
                                                    <span style={{
                                                        color: (bet.winningAmount || 0) > 0 ? 'var(--status-approved)' :
                                                            bet.state === 2 ? 'var(--status-rejected)' : 'var(--text-muted)'
                                                    }}>
                                                        {(bet.winningAmount || 0) > 0 ? `+${formatCurrency(bet.winningAmount)}` :
                                                            bet.state === 2 ? `Kaybetti` :
                                                                bet.state === 1 ? `Olası: ${formatCurrency(bet.possibleWin)}` :
                                                                    formatCurrency(bet.winningAmount || 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: IP + Bonuslar */}
                        <div className="detail-card right-card">
                            {/* IP Kontrolü - GELİŞTİRİLMİŞ */}
                            <div className="sub-section">
                                <div className="section-title">
                                    <Wifi size={16} /> IP Kontrolü
                                    {ipAnalysis?.hasMultiAccount && (
                                        <span style={{
                                            marginLeft: 'auto',
                                            fontSize: '10px',
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            color: 'var(--status-rejected)',
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            fontWeight: 600
                                        }}>
                                            ⚠️ Çoklu Hesap Tespit Edildi
                                        </span>
                                    )}
                                </div>

                                {/* Özet İstatistikler */}
                                {ipAnalysis?.analysis?.length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {ipAnalysis.analysis.reduce((sum, ip) => sum + (ip.loginCount || 0), 0)}
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Toplam Giriş</div>
                                        </div>
                                        <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {ipAnalysis.analysis.length}
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Farklı IP</div>
                                        </div>
                                        <div style={{
                                            flex: 1,
                                            background: ipAnalysis.hasMultiAccount ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-tertiary)',
                                            borderRadius: '6px',
                                            padding: '8px',
                                            textAlign: 'center',
                                            border: ipAnalysis.hasMultiAccount ? '1px solid rgba(239, 68, 68, 0.3)' : 'none'
                                        }}>
                                            <div style={{
                                                fontSize: '16px',
                                                fontWeight: 700,
                                                color: ipAnalysis.hasMultiAccount ? 'var(--status-rejected)' : 'var(--text-primary)'
                                            }}>
                                                {ipAnalysis.analysis.reduce((sum, ip) => sum + (ip.otherAccounts?.length || 0), 0)}
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Diğer Hesaplar</div>
                                        </div>
                                    </div>
                                )}

                                {(() => {
                                    const riskyIps = ipAnalysis?.analysis?.filter(ip => ip.otherAccounts?.length > 0) || [];

                                    if (!ipAnalysis?.analysis?.length) {
                                        return <div className="empty-message">IP kaydı yok</div>;
                                    }

                                    if (riskyIps.length === 0) {
                                        return <div className="empty-message" style={{ color: 'var(--status-approved)' }}>✓ Riskli IP yok</div>;
                                    }

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {riskyIps.map((ip, i) => {
                                                const isExpanded = expandedIps[ip.ip];
                                                return (
                                                    <div key={i} style={{
                                                        background: 'rgba(239, 68, 68, 0.08)',
                                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                                        borderRadius: '6px',
                                                        overflow: 'hidden'
                                                    }}>
                                                        {/* Accordion Header - Tıklanabilir */}
                                                        <div
                                                            onClick={() => setExpandedIps(prev => ({ ...prev, [ip.ip]: !prev[ip.ip] }))}
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                padding: '8px 10px',
                                                                cursor: 'pointer',
                                                                userSelect: 'none'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>{ip.ip}</span>
                                                                <span style={{
                                                                    fontSize: '9px',
                                                                    background: 'rgba(239, 68, 68, 0.2)',
                                                                    color: 'var(--status-rejected)',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 600
                                                                }}>
                                                                    {ip.otherAccounts.length} hesap
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                                                                <span style={{ fontSize: '10px' }}>{ip.loginCount} giriş</span>
                                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                            </div>
                                                        </div>

                                                        {/* Accordion Content - Diğer Hesaplar */}
                                                        {isExpanded && (
                                                            <div style={{
                                                                padding: '8px 10px',
                                                                borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                                                                background: 'rgba(239, 68, 68, 0.05)'
                                                            }}>
                                                                {ip.otherAccounts.map((acc, idx) => (
                                                                    <div key={idx} style={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        fontSize: '10px',
                                                                        padding: '4px 6px',
                                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                                        borderRadius: '4px',
                                                                        marginBottom: '4px'
                                                                    }}>
                                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{acc.Login || acc.login}</span>
                                                                        <span style={{ color: 'var(--text-muted)' }}>
                                                                            ID: {acc.ClientId || acc.clientId} • {acc.LoginCount || acc.loginCount || 1} giriş
                                                                            {(acc.RegistrationDate || acc.registrationDate) && (
                                                                                <> • Kayıt: {new Date(acc.RegistrationDate || acc.registrationDate).toLocaleDateString('tr-TR')}</>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Son Bonuslar - KOMPAKT */}
                            <div className="sub-section">
                                <div className="section-title"><Gift size={16} /> Son Bonuslar</div>
                                {bonuses.length === 0 ? (
                                    <div className="empty-message">Bonus yok</div>
                                ) : (
                                    <div className="bonus-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {bonuses.slice(0, 3).map((b, i) => (
                                            <div key={i} style={{
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: '6px',
                                                padding: '8px 10px',
                                                border: '1px solid var(--border-subtle)'
                                            }}>
                                                {/* Tek Satır: İsim + Badges + Tutar */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {b.name}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{b.typeName} • {formatTime(b.createdAt)}</span>
                                                            <span style={{
                                                                padding: '1px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: 600,
                                                                background: b.acceptanceType === 2 ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                                                                color: b.acceptanceType === 2 ? 'var(--status-approved)' : 'var(--status-pending)'
                                                            }}>{b.acceptanceTypeName}</span>
                                                            <span style={{
                                                                padding: '1px 6px', borderRadius: '8px', fontSize: '9px', fontWeight: 600,
                                                                background: b.resultType === 1 ? 'rgba(34,197,94,0.15)' : b.resultType === 3 ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
                                                                color: b.resultType === 1 ? 'var(--status-approved)' : b.resultType === 3 ? 'var(--status-rejected)' : 'var(--accent-primary)'
                                                            }}>{b.resultTypeName}</span>
                                                            {b.isFreeSpin && <span style={{ fontSize: '10px' }}>🎰</span>}
                                                        </div>

                                                        {/* Wagering Progress */}
                                                        {b.wageringInfo && (
                                                            <div style={{ marginTop: '8px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px', color: 'var(--text-muted)' }}>
                                                                    <span>Çevrim: %{b.wageringInfo.percentage}</span>
                                                                    <span>{formatCurrency(b.wageringInfo.wageredAmount)} / {formatCurrency(b.wageringInfo.amountToWager)}</span>
                                                                </div>
                                                                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                                                    <div style={{
                                                                        height: '100%',
                                                                        width: `${Math.min(b.wageringInfo.percentage, 100)}%`,
                                                                        background: b.wageringInfo.percentage >= 100 ? 'var(--status-approved)' : 'var(--accent-primary)',
                                                                        transition: 'width 0.3s ease'
                                                                    }} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent-primary)' }}>{formatCurrency(b.amount)}</div>
                                                        {b.paidAmount > 0 && <div style={{ fontSize: '10px', color: 'var(--status-approved)' }}>+{formatCurrency(b.paidAmount)}</div>}
                                                    </div>
                                                </div>
                                                {/* Çevrim (varsa) - mini progress */}
                                                {b.wageringInfo && (
                                                    <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <div style={{ flex: 1, height: '3px', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(b.wageringInfo.percentage, 100)}%`, height: '100%', background: b.wageringInfo.percentage >= 100 ? 'var(--status-approved)' : 'var(--accent-primary)' }} />
                                                        </div>
                                                        <span style={{ fontSize: '9px', fontWeight: 600, color: b.wageringInfo.percentage >= 100 ? 'var(--status-approved)' : 'var(--text-muted)' }}>%{b.wageringInfo.percentage}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer: FreeSpin & Bonus & Düzeltme İşlemleri */}
                    {bonusTx.length > 0 && (
                        <div className="footer-bar">
                            <span className="footer-title">Yatırım Sonrası İşlemler</span>
                            <div className="tx-chips">
                                {bonusTx.map((tx, i) => {
                                    let emoji = '❓';
                                    let cssClass = 'unknown';
                                    if (tx.type === 'FREESPIN') { emoji = '🎰'; cssClass = 'freespin'; }
                                    else if (tx.type === 'BONUS') { emoji = '🎁'; cssClass = 'bonus'; }
                                    else if (tx.type === 'CORRECTION_UP') { emoji = '⬆️'; cssClass = 'correction-up'; }
                                    else if (tx.type === 'CORRECTION_DOWN') { emoji = '⬇️'; cssClass = 'correction-down'; }

                                    return (
                                        <div key={i} className={`tx-chip ${cssClass}`}>
                                            <span>{emoji} {formatCurrency(tx.amount)}</span>
                                            {tx.userName && <span className="tx-user">{tx.userName}</span>}
                                            {tx.time && <span className="tx-time">{formatTime(tx.time)}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Decision Summary Modal */}
            {showDecisionModal && (
                <div className="modal-overlay" onClick={() => setShowDecisionModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📋 Karar Özeti</h3>
                            <button className="modal-close" onClick={() => setShowDecisionModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {/* Final Decision */}
                            <div className={`decision-summary-box ${decision === 'ONAY' ? 'approved' : decision === 'RET' ? 'rejected' : 'manual'}`}>
                                <div className="decision-icon">
                                    {decision === 'ONAY' ? <CheckCircle size={32} /> : decision === 'RET' ? <XCircle size={32} /> : <AlertCircle size={32} />}
                                </div>
                                <div className="decision-text">
                                    <div className="decision-label">Son Karar</div>
                                    <div className="decision-value">{decision}</div>
                                </div>
                            </div>

                            {/* Decision Reason */}
                            {decisionReason && (
                                <div className="summary-section">
                                    <div className="section-label">Karar Sebebi</div>
                                    <div className="reason-text">{decisionReason}</div>
                                </div>
                            )}

                            {/* Turnover Summary - Always show if available */}
                            {turnover && (
                                <div className="summary-section turnover-summary">
                                    <div className="section-label">📊 Çevrim Özeti</div>
                                    <div className="turnover-stats">
                                        <div className="stat">
                                            <span className="label">Hedef:</span>
                                            <span className="value">₺{(turnover?.turnover?.required || turnover?.required || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="stat">
                                            <span className="label">Yapılan:</span>
                                            <span className="value">₺{(turnover?.turnover?.total?.amount || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="stat">
                                            <span className="label">Yüzde:</span>
                                            <span className={`value ${(turnover?.turnover?.total?.percentage || 0) >= 100 ? 'complete' : 'incomplete'}`}>
                                                %{turnover?.turnover?.total?.percentage || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Simulation Mode Warning */}
                            {ruleEvaluation?.simulationOnly && (
                                <div className="summary-section simulation-warning">
                                    <div className="section-label">⚠️ Simülasyon Modu</div>
                                    <div className="simulation-text">Bu sonuç simülasyondur. Oto-onay sistemi kapalı olduğu için gerçek onay yapılmamıştır.</div>
                                </div>
                            )}

                            {/* Matched Bonus Rule */}
                            {ruleEvaluation?.matchedBonusRule && (
                                <div className="summary-section bonus-rule">
                                    <div className="section-label">🎁 Eşleşen Bonus Kuralı</div>
                                    <div className="bonus-rule-name">{ruleEvaluation.matchedBonusRule}</div>
                                </div>
                            )}

                            {/* Skipped Reason */}
                            {ruleEvaluation?.skippedReason && (
                                <div className="summary-section skipped">
                                    <div className="section-label">⚠️ Atlanan Kontroller</div>
                                    <div className="skipped-text">{ruleEvaluation.skippedReason}</div>
                                </div>
                            )}

                            {/* Passed Rules */}
                            {ruleEvaluation?.passedRules?.length > 0 && (
                                <div className="summary-section passed-rules">
                                    <div className="section-label">✅ Geçen Kurallar ({ruleEvaluation.passedRules.length})</div>
                                    <div className="rules-list">
                                        {ruleEvaluation.passedRules.map((rule, i) => (
                                            <div key={i} className="rule-item passed">
                                                <CheckCircle size={14} /> {rule}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Failed Rules */}
                            {ruleEvaluation?.failedRules?.length > 0 && (
                                <div className="summary-section failed-rules">
                                    <div className="section-label">❌ Başarısız Kurallar ({ruleEvaluation.failedRules.length})</div>
                                    <div className="rules-list">
                                        {ruleEvaluation.failedRules.map((rule, i) => (
                                            <div key={i} className="rule-item failed">
                                                <XCircle size={14} /> {rule}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No Rule Data - Show debug info */}
                            {!ruleEvaluation && (
                                <div className="summary-section no-data">
                                    <div className="section-label">ℹ️ Kural Verisi</div>
                                    <div className="no-data-text">
                                        Kural değerlendirme verisi bulunamadı.
                                        Bu çekim eski bir snapshot ile oluşturulmuş olabilir.
                                    </div>
                                    <div className="debug-info" style={{ fontSize: '11px', marginTop: '8px', opacity: 0.7 }}>
                                        <div>Çekim ID: {withdrawal?.Id}</div>
                                        <div>Çevrim Tamamlandı: {turnover?.turnover?.isComplete ? 'Evet' : 'Hayır'}</div>
                                        <div>DecisionData var: {turnover?.decisionData ? 'Evet' : 'Hayır'}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .compact-detail-page {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    padding: 16px;
                    box-sizing: border-box;
                    overflow: hidden;
                }

                .detail-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: var(--bg-card);
                    border-radius: var(--radius-lg);
                    margin-bottom: 12px;
                }

                .back-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 12px;
                    background: var(--bg-tertiary);
                    border: none;
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    cursor: pointer;
                    font-size: 14px;
                }
                .back-btn:hover { background: var(--bg-hover); }

                .player-info {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .player-main { display: flex; flex-direction: column; align-items: center; }
                .player-name { font-size: 18px; font-weight: 600; color: var(--text-primary); }
                .amount { font-size: 20px; font-weight: 700; color: var(--status-approved); }
                .payment-method { font-size: 11px; color: var(--text-muted); }
                .status-chip {
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .status-chip.state-0 { background: var(--status-processing-bg); color: var(--status-processing); }
                .status-chip.state-1 { background: var(--status-pending-bg); color: var(--status-pending); }
                .status-chip.state-2 { background: var(--status-approved-bg); color: var(--status-approved); }
                .status-chip.state-3 { background: var(--status-rejected-bg); color: var(--status-rejected); }

                .decision-badge-large {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border-radius: var(--radius-lg);
                    font-size: 16px;
                    font-weight: 700;
                }
                .decision-badge-large.approved { background: var(--status-approved-bg); color: var(--status-approved); border: 2px solid var(--status-approved); }
                .decision-badge-large.rejected { background: var(--status-rejected-bg); color: var(--status-rejected); border: 2px solid var(--status-rejected); }
                .decision-badge-large.manual { background: var(--status-pending-bg); color: var(--status-pending); border: 2px solid var(--status-pending); }

                .decision-reason {
                    padding: 8px 16px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    font-size: 13px;
                    margin-bottom: 12px;
                    text-align: center;
                }

                .kpi-bar {
                    display: flex;
                    gap: 8px;
                    padding: 10px 16px;
                    background: var(--bg-card);
                    border-radius: var(--radius-lg);
                    margin-bottom: 12px;
                    flex-wrap: wrap;
                }
                .kpi-stat {
                    display: flex;
                    flex-direction: column;
                    padding: 6px 12px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    min-width: 100px;
                }
                .kpi-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
                .kpi-value { font-size: 14px; font-weight: 600; color: var(--text-primary); }
                .kpi-value small { font-size: 11px; color: var(--text-muted); font-weight: 400; }
                .kpi-stat.btag { background: var(--status-processing-bg); }
                .kpi-stat.btag .kpi-value { color: var(--status-processing); }
                .kpi-stat.balance { background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; }
                .kpi-stat.balance .kpi-value { color: #3b82f6; }
                .kpi-stat.verified { background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; }
                .kpi-stat.verified .kpi-value { color: #22c55e; }
                .kpi-stat.unverified { background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; }
                .kpi-stat.unverified .kpi-value { color: #ef4444; }

                .detail-grid {
                    display: grid;
                    grid-template-columns: 1fr 1.2fr 1fr;
                    gap: 12px;
                    flex: 1;
                    min-height: 0;
                }

                .detail-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    padding: 16px;
                    overflow: hidden;
                }

                .card-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--border-subtle);
                }

                .turnover-content {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .circular-progress {
                    position: relative;
                    flex-shrink: 0;
                }
                .circular-progress .progress-bg { stroke: var(--bg-tertiary); }
                .circular-progress .progress-bar { stroke-linecap: round; transition: stroke-dashoffset 0.5s; }
                .circular-progress .progress-bar.complete { stroke: var(--status-approved); }
                .circular-progress .progress-bar.incomplete { stroke: var(--status-rejected); }
                .progress-text {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                }
                .percentage { font-size: 24px; font-weight: 700; color: var(--text-primary); }

                .turnover-stats { flex: 1; }
                .stat-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 0;
                    font-size: 13px;
                    color: var(--text-secondary);
                }
                .stat-row.highlight { font-weight: 600; color: var(--text-primary); margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-subtle); }
                .stat-row .complete { color: var(--status-approved); }
                .stat-row .incomplete { color: var(--status-rejected); }
                .stat-row.casino-row span { color: #22c55e; }
                .stat-row.sports-row span { color: #3b82f6; }

                .middle-card, .right-card {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .sub-section {
                    flex: 1;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                }

                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-secondary);
                    margin-bottom: 8px;
                }
                .section-total {
                    margin-left: auto;
                    font-size: 12px;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 8px;
                }
                .section-total.positive { background: var(--status-approved-bg); color: var(--status-approved); }
                .section-total.negative { background: var(--status-rejected-bg); color: var(--status-rejected); }
                .warning-icon { color: var(--status-rejected); }

                .mini-list {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    flex: 1;
                    overflow: hidden;
                }

                .mini-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 10px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-sm);
                    font-size: 12px;
                }
                .mini-item.sports-item { flex-direction: column; align-items: flex-start; gap: 6px; }
                .sports-item .item-info { width: 100%; display: flex; flex-direction: column; gap: 4px; }
                .match-row { display: flex; justify-content: space-between; align-items: flex-start; font-size: 11px; padding: 2px 0; border-bottom: 1px dashed var(--border-subtle); }
                .match-row:last-child { border-bottom: none; }
                .match-name { color: var(--text-secondary); flex: 1; }
                .selection-outcome { font-weight: 600; color: var(--text-primary); margin-left: 8px; white-space: nowrap; }
                .bet-type-label { font-size: 10px; font-weight: 700; color: var(--status-pending); text-transform: uppercase; margin-bottom: 2px; }
                .sports-item .item-amount { align-self: flex-end; font-size: 12px; margin-top: 4px; font-weight: 700; }
                
                .item-name { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%; }
                .item-amount { font-weight: 600; color: var(--text-primary); }
                .item-amount.positive { color: var(--status-approved); }
                .item-amount.negative { color: var(--status-rejected); }

                .more-indicator { font-size: 11px; color: var(--text-muted); text-align: center; padding: 4px; }
                .empty-message { font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px; }

                .ip-list { display: flex; flex-direction: column; gap: 4px; }
                .ip-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding: 6px 8px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-sm);
                    font-size: 12px;
                }
                .ip-item.warning { background: var(--status-rejected-bg); border: 1px solid var(--status-rejected); }
                .ip-main { display: flex; justify-content: space-between; }
                .ip-address { font-family: monospace; color: var(--text-primary); }
                .ip-info { color: var(--text-muted); }
                .other-accounts { 
                    font-size: 11px; 
                    color: var(--status-rejected); 
                    font-weight: 500;
                    word-break: break-word;
                }

                .footer-bar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    background: var(--bg-card);
                    border-radius: var(--radius-lg);
                    margin-top: 12px;
                }
                .footer-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
                .tx-chips { display: flex; gap: 8px; flex-wrap: wrap; }
                .tx-chip {
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .tx-chip.freespin { background: var(--status-processing-bg); color: var(--status-processing); }
                .tx-chip.bonus { background: var(--status-approved-bg); color: var(--status-approved); }
                .tx-chip.correction-up { background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); }
                .tx-chip.correction-down { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
                .tx-chip { display: flex; flex-direction: column; align-items: center; gap: 2px; }
                .tx-user { font-size: 9px; opacity: 0.8; font-weight: 500; }
                .tx-time { font-size: 10px; opacity: 0.7; }

                .time-row { margin-top: -4px; }
                .time-text { font-size: 11px; color: var(--text-muted); }

                .mini-item.with-time { flex-direction: column; gap: 2px; }
                .item-main { display: flex; justify-content: space-between; width: 100%; }
                .item-time { font-size: 10px; color: var(--text-muted); }

                .loading-indicator {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                }

                /* Decision Summary Modal */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }
                .modal-content {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-lg);
                    width: 90%;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
                }
                .modal-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .modal-header h3 {
                    margin: 0;
                    font-size: 18px;
                    color: var(--text-primary);
                }
                .modal-close {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                }
                .modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }
                .modal-body {
                    padding: 20px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .decision-summary-box {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 20px;
                    border-radius: var(--radius-md);
                }
                .decision-summary-box.approved { background: rgba(34, 197, 94, 0.15); border: 2px solid #22c55e; color: #22c55e; }
                .decision-summary-box.rejected { background: rgba(239, 68, 68, 0.15); border: 2px solid #ef4444; color: #ef4444; }
                .decision-summary-box.manual { background: rgba(245, 158, 11, 0.15); border: 2px solid #f59e0b; color: #f59e0b; }
                .decision-icon { flex-shrink: 0; }
                .decision-text { flex: 1; }
                .decision-label { font-size: 12px; opacity: 0.8; text-transform: uppercase; }
                .decision-value { font-size: 24px; font-weight: 700; }
                .summary-section {
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-md);
                    padding: 14px 16px;
                }
                .summary-section.bonus-rule { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); }
                .summary-section.skipped { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); }
                .summary-section.no-data { background: rgba(156, 163, 175, 0.1); }
                .section-label { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; }
                .reason-text { font-size: 14px; color: var(--text-primary); }
                .bonus-rule-name { font-size: 16px; font-weight: 600; color: var(--accent-primary); }
                .skipped-text { font-size: 13px; color: #f59e0b; }
                .no-data-text { font-size: 13px; color: var(--text-muted); text-align: center; padding: 20px; }
                .rules-list { display: flex; flex-direction: column; gap: 6px; }
                .rule-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                }
                .rule-item.passed { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
                .rule-item.failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
                
                /* Turnover Summary */
                .turnover-summary { background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); }
                .turnover-stats { display: flex; gap: 16px; flex-wrap: wrap; }
                .turnover-stats .stat { display: flex; gap: 8px; align-items: center; }
                .turnover-stats .label { color: var(--text-muted); font-size: 12px; }
                .turnover-stats .value { font-weight: 600; font-size: 14px; color: var(--text-primary); }
                .turnover-stats .value.complete { color: #22c55e; }
                .turnover-stats .value.incomplete { color: #f59e0b; }
                
                /* Simulation Warning */
                .simulation-warning { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); }
                .simulation-text { font-size: 13px; color: #f59e0b; }
            `}</style>
        </div>
    );
}
