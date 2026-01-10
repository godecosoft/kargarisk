/**
 * Compact Withdrawal Detail Page
 * Single-screen layout with 3-column grid
 * No scrolling needed - all info visible at once
 */

import { useState, useEffect, useCallback } from 'react';
import {
    CheckCircle, XCircle, AlertCircle, ArrowLeft, Wifi,
    AlertTriangle, Trophy, Gamepad2, Gift
} from 'lucide-react';
import {
    fetchClientTurnover, fetchClientBonuses, fetchClientSports,
    fetchIPAnalysis, fetchBonusTransactions
} from '../services/api';

// Circular Progress Component
function CircularProgress({ percentage, size = 120 }) {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
    const isComplete = percentage >= 100;

    return (
        <div className="circular-progress" style={{ width: size, height: size }}>
            <svg width={size} height={size}>
                <circle
                    className="progress-bg"
                    cx={size / 2} cy={size / 2} r={radius}
                    strokeWidth={strokeWidth} fill="none"
                />
                <circle
                    className={`progress-bar ${isComplete ? 'complete' : 'incomplete'}`}
                    cx={size / 2} cy={size / 2} r={radius}
                    strokeWidth={strokeWidth} fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
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
    const [loading, setLoading] = useState(true);

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

                if (snapshot.success && snapshot.fromDB) {
                    setTurnover(snapshot.turnover);
                    setSports(snapshot.sports);
                    setBonuses(snapshot.bonuses || []);
                    setBonusTx(snapshot.bonusTransactions?.data || []);
                    setIpAnalysis(snapshot.ipAnalysis);
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

                // Always fetch fresh KPI
                const { fetchClientKpi } = await import('../services/api');
                const kpiRes = await fetchClientKpi(clientId);
                if (kpiRes.success) setClientKpi(kpiRes.data);
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
                <DecisionBadge decision={decision} />
            </div>

            {/* Decision Reason */}
            {decisionReason && (
                <div className="decision-reason">{decisionReason}</div>
            )}

            {/* Client KPI Stats Bar */}
            {clientKpi && (
                <div className="kpi-bar">
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
                        <span className="kpi-value">{formatCurrency(clientKpi.lastWithdrawalAmount)}</span>
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
                                <CircularProgress percentage={totalPercentage} />
                                <div className="turnover-stats">
                                    <div className="stat-row">
                                        <span>Yatırım:</span>
                                        <span>{formatCurrency(turnover?.deposit?.amount)}</span>
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
                        </div>

                        {/* Middle: Spor + Casino */}
                        <div className="detail-card middle-card">
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
                                {sportsBets.length === 0 ? (
                                    <div className="empty-message">Kupon yok</div>
                                ) : (
                                    <div className="mini-list">
                                        {sportsBets.slice(0, 4).map((bet, i) => (
                                            <div key={i} className="mini-item">
                                                <span className="item-name">
                                                    {bet.selections?.[0]?.matchName || bet.type || `Bahis #${bet.id}`}
                                                </span>
                                                <span className={`item-amount ${(bet.winningAmount || 0) > 0 ? 'positive' : ''}`}>
                                                    {formatCurrency(bet.amount)} → {formatCurrency(bet.winningAmount || 0)}
                                                </span>
                                            </div>
                                        ))}
                                        {sportsBets.length > 4 && <div className="more-indicator">+{sportsBets.length - 4} daha</div>}
                                    </div>
                                )}
                            </div>

                            {/* Casino Top 5 */}
                            <div className="sub-section">
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
                                            <div key={i} className="mini-item">
                                                <span className="item-name">{g.game}</span>
                                                <span className={`item-amount ${g.winAmount > g.betAmount ? 'positive' : 'negative'}`}>
                                                    {formatCurrency(g.winAmount - g.betAmount)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: IP + Bonuslar */}
                        <div className="detail-card right-card">
                            {/* IP Kontrolü */}
                            <div className="sub-section">
                                <div className="section-title">
                                    <Wifi size={16} /> IP Kontrolü
                                    {ipAnalysis?.hasMultiAccount && (
                                        <AlertTriangle size={14} className="warning-icon" />
                                    )}
                                </div>
                                {!ipAnalysis?.analysis?.length ? (
                                    <div className="empty-message">IP kaydı yok</div>
                                ) : (
                                    <div className="ip-list">
                                        {ipAnalysis.analysis.slice(0, 3).map((ip, i) => (
                                            <div key={i} className={`ip-item ${ip.otherAccounts?.length > 0 ? 'warning' : ''}`}>
                                                <div className="ip-main">
                                                    <span className="ip-address">{ip.ip}</span>
                                                    <span className="ip-info">{ip.loginCount} giriş</span>
                                                </div>
                                                {ip.otherAccounts?.length > 0 && (
                                                    <div className="other-accounts">
                                                        ⚠️ Diğer hesaplar: {ip.otherAccounts.map(acc => acc.Login || acc.login).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Son Bonuslar */}
                            <div className="sub-section">
                                <div className="section-title"><Gift size={16} /> Son Bonuslar</div>
                                {bonuses.length === 0 ? (
                                    <div className="empty-message">Bonus yok</div>
                                ) : (
                                    <div className="mini-list">
                                        {bonuses.slice(0, 3).map((b, i) => (
                                            <div key={i} className="mini-item with-time">
                                                <div className="item-main">
                                                    <span className="item-name">{b.name}</span>
                                                    <span className="item-amount">{formatCurrency(b.amount)}</span>
                                                </div>
                                                {b.createdAt && <span className="item-time">{formatTime(b.createdAt)}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer: FreeSpin & Bonus İşlemleri */}
                    {bonusTx.length > 0 && (
                        <div className="footer-bar">
                            <span className="footer-title">FreeSpin & Bonus İşlemleri</span>
                            <div className="tx-chips">
                                {bonusTx.map((tx, i) => (
                                    <div key={i} className={`tx-chip ${tx.type.toLowerCase()}`}>
                                        <span>{tx.type === 'FREESPIN' ? '🎰' : '🎁'} {formatCurrency(tx.amount)}</span>
                                        {tx.time && <span className="tx-time">{formatTime(tx.time)}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
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
                    padding: 6px 8px;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-sm);
                    font-size: 12px;
                }
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
                .tx-chip { display: flex; flex-direction: column; align-items: center; gap: 2px; }
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
            `}</style>
        </div>
    );
}
