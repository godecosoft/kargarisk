import React, { useState, useEffect } from 'react';
import {
    BarChart3,
    Calendar,
    CheckCircle,
    XCircle,
    AlertTriangle,
    ShieldAlert,
    TrendingUp,
    Banknote,
    Loader2,
    RefreshCw,
    Download
} from 'lucide-react';
import { fetchReportsStats } from '../services/api';

function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [dateRange, setDateRange] = useState('today'); // today, yesterday, week

    useEffect(() => {
        loadStats();
    }, [dateRange]);

    const loadStats = async () => {
        setLoading(true);
        try {
            // Calculate dates
            const end = new Date();
            const start = new Date();

            if (dateRange === 'yesterday') {
                start.setDate(start.getDate() - 1);
                end.setDate(end.getDate() - 1);
            } else if (dateRange === 'week') {
                start.setDate(start.getDate() - 7);
            }

            const formatDate = (d, isEnd = false) => {
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yy = String(d.getFullYear()).slice(-2);
                const time = isEnd ? '23:59:59' : '00:00:00';
                return `${dd}-${mm}-${yy} - ${time}`;
            };

            const queryDates = {
                startDate: formatDate(start),
                endDate: formatDate(end, true)
            };

            const result = await fetchReportsStats(queryDates.startDate, queryDates.endDate);
            if (result.success) {
                setStats(result.stats);
            }
        } catch (error) {
            console.error('Failed to load reports:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !stats) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 className="spinner" size={48} />
            </div>
        );
    }

    return (
        <>
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Raporlar ve Analizler</h1>
                    <p className="page-subtitle">Çekim istatistikleri ve bot performans analizi</p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="filter-bar" style={{ marginBottom: 0, padding: '4px 8px' }}>
                        <button
                            className={`filter-btn ${dateRange === 'today' ? '' : 'secondary'}`}
                            onClick={() => setDateRange('today')}
                        >
                            Bugün
                        </button>
                        <button
                            className={`filter-btn ${dateRange === 'yesterday' ? '' : 'secondary'}`}
                            onClick={() => setDateRange('yesterday')}
                        >
                            Dün
                        </button>
                        <button
                            className={`filter-btn ${dateRange === 'week' ? '' : 'secondary'}`}
                            onClick={() => setDateRange('week')}
                        >
                            Son 7 Gün
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI Grid 1 - General Stats */}
            <div className="kpi-grid">
                <KPICard
                    label="Toplam Talep"
                    value={stats?.total || 0}
                    icon={TrendingUp}
                    iconType="info"
                />
                <KPICard
                    label="Ödenen"
                    value={stats?.paid || 0}
                    icon={CheckCircle}
                    iconType="success"
                />
                <KPICard
                    label="Reddedilen"
                    value={stats?.rejected || 0}
                    icon={XCircle}
                    iconType="danger"
                />
                <KPICard
                    label="Bekleyen"
                    value={stats?.pending || 0}
                    icon={Loader2}
                    iconType="warning"
                />
            </div>

            {/* KPI Grid 2 - Bot Performance */}
            <div className="kpi-grid">
                <KPICard
                    label="Bot Onayı"
                    value={stats?.botApproved || 0}
                    icon={ShieldAlert}
                    iconType="success"
                />
                <KPICard
                    label="Bot Reddi"
                    value={stats?.botRejected || 0}
                    icon={ShieldAlert}
                    iconType="danger"
                />
                <KPICard
                    label="Bot Manuel"
                    value={stats?.botManual || 0}
                    icon={AlertTriangle}
                    iconType="warning"
                />
                <KPICard
                    label="Bot Başarısı"
                    value={`%${stats?.total ? Math.round(((stats?.botApproved + stats?.botRejected) / stats?.total) * 100) : 0}`}
                    icon={TrendingUp}
                    iconType="info"
                />
            </div>

            {/* Conflicts Analysis */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px', marginTop: '24px' }}>

                {/* Critical Conflict: Paid but Bot Rejected */}
                <div className="card">
                    <div className="card-header" style={{ borderBottomColor: 'var(--status-rejected)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertTriangle color="var(--status-rejected)" size={20} />
                            <div>
                                <h3 className="card-title" style={{ color: 'var(--status-rejected)' }}>KRİTİK: Panel Ödemiş vs Bot Reddetmiş</h3>
                                <p className="page-subtitle">Botun risk görüp RED verdiği ancak panelde ÖDENEN işlemler</p>
                            </div>
                        </div>
                        <span className="status-badge rejected">{stats?.conflicts?.paidButBotRejected?.length || 0} Adet</span>
                    </div>
                    <div className="data-table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <ConflictTable items={stats?.conflicts?.paidButBotRejected || []} />
                    </div>
                </div>

                {/* Warning Conflict: Rejected but Bot Approved */}
                <div className="card">
                    <div className="card-header" style={{ borderBottomColor: 'var(--status-pending)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertTriangle color="var(--status-pending)" size={20} />
                            <div>
                                <h3 className="card-title" style={{ color: 'var(--status-pending)' }}>UYARI: Panel Reddetmiş vs Bot Onaylamış</h3>
                                <p className="page-subtitle">Botun temiz bulduğu ancak panelde REDDEDİLEN işlemler</p>
                            </div>
                        </div>
                        <span className="status-badge pending">{stats?.conflicts?.rejectedButBotApproved?.length || 0} Adet</span>
                    </div>
                    <div className="data-table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <ConflictTable items={stats?.conflicts?.rejectedButBotApproved || []} />
                    </div>
                </div>

            </div>
        </>
    );
}

function KPICard({ label, value, icon: Icon, iconType }) {
    return (
        <div className="kpi-card">
            <div className="kpi-header">
                <span className="kpi-label">{label}</span>
                <div className={`kpi-icon ${iconType}`}>
                    <Icon />
                </div>
            </div>
            <div className="kpi-value">
                {value}
            </div>
        </div>
    );
}

function ConflictTable({ items }) {
    if (items.length === 0) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Çatışma bulunamadı. Sistem uyumlu çalışıyor.
            </div>
        );
    }

    return (
        <table className="data-table">
            <thead>
                <tr>
                    <th>ID / Oyuncu</th>
                    <th>Miktar</th>
                    <th>Bot Kararı</th>
                </tr>
            </thead>
            <tbody>
                {items.map((item, idx) => (
                    <tr key={idx}>
                        <td>
                            <div className="player-info">
                                <span className="player-name">{item.withdrawal.Id}</span>
                                <span className="player-id">{item.withdrawal.ClientId}</span>
                            </div>
                        </td>
                        <td>
                            <span className="amount">{item.withdrawal.Amount} ₺</span>
                        </td>
                        <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600 }}>{item.decision.decision}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.decision.decision_reason}>
                                    {item.decision.decision_reason}
                                </span>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default ReportsPage;
