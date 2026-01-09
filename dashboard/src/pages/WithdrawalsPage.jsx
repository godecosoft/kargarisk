import { useState, useEffect, useCallback, useRef } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Filter,
    Download,
    RefreshCw,
    ArrowUpDown,
    Eye,
    Check,
    X,
    ChevronLeft,
    ChevronRight,
    ArrowDownToLine,
    Banknote,
    Users,
    Zap,
    Loader2,
    Search
} from 'lucide-react';
// Chart removed - only list view
import { fetchWithdrawals, fetchDecisionsBatch } from '../services/api';
import { autoControlStore } from './AutoControlPage';

// State mapping - BC API değerleri
const STATE_MAP = {
    0: { label: 'Yeni', status: 'pending' },
    2: { label: 'Beklemede', status: 'processing' },
    3: { label: 'Ödendi', status: 'approved' },
    '-2': { label: 'Reddedildi', status: 'rejected' },
    '-1': { label: 'İptal Edildi', status: 'rejected' }
};

// Notification sound (base64 encoded short beep)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+djHdsaHJ/jpugoJSFdGVjbHmJmJ+gnpOEdWZgaHSFlp+in5WIeWxkZm94iZieoJ2Rg3VoZGZweYqZn5+ckYJ1Z2NmcXqLmp+em5B/c2ZjZnJ7jJqfnpuPf3JmYmZze42bn56aj35xZWJmc3yOnJ+emY59cGRhZXR9j5yfnpiNfG9kYWV1fo+dn56XjHtuY2BldX+Qnp+dlot6bWJgZHWAkZ6fnJWJeWxhX2R2gZKenpyUiHhrYF5jdoKTn56bk4d3al9eY3aDlJ+empKGdmlfXWN3hJWfnpmRhXVoXl1id4SVn56ZkIR0Z11cYniFlp+emI+Dc2ZcXGJ5hpefnpeOgnJlW1tieYeYn56Wi4FxZFtaYnqImZ+elYp/cGNaWWJ6iZqfnZSJfm9iWVlhe4qbn52TiH1uYVlYYXyLnJ+dkod8bWBYWGF8jJ2fnJGGe2xfV1dhfY2en5yQhXprXldXYX2On5+bj4R5al5WVmF+j5+fm46DeGldVVVhf5CgoJuNgndoXFRUYYCRoKCajYF2Z1xUVGGBkqGgmYyAdWZbU1NhgZOioZiLf3RlWlNTYYKUoqGXin5zZFlSUmGClKOhl4l9cmNYUlJiQ5WjoZeIfHFiV1FRYoOVpKGWh3twYVZRUWOElqSglYZ6b2BVUFBjhZekoJSFeG5fVU9PY4aYpaCThXdtXlRPT2SHmKaglIN2bF1TTk5kiJmnoDlHfM+gv7l3TTtSYHB+';

function playNotificationSound() {
    try {
        const audio = new Audio(NOTIFICATION_SOUND);
        audio.volume = 0.5;
        audio.play().catch(() => { }); // Ignore autoplay errors
    } catch (e) {
        console.log('Sound play failed:', e);
    }
}

function KPICard({ label, value, icon: Icon, iconType, loading, flash }) {
    return (
        <div className={`kpi-card ${flash ? 'flash-update' : ''}`}>
            <div className="kpi-header">
                <span className="kpi-label">{label}</span>
                <div className={`kpi-icon ${iconType}`}>
                    <Icon />
                </div>
            </div>
            <div className="kpi-value">
                {loading ? <Loader2 className="spinner" size={24} /> : value}
            </div>
        </div>
    );
}

function StatusBadge({ state }) {
    const config = STATE_MAP[state] || { label: 'Bilinmiyor', status: 'pending' };

    return (
        <span className={`status-badge ${config.status}`}>
            <span className="status-dot"></span>
            {config.label}
        </span>
    );
}

function DecisionBadge({ decision, loading, isChecking }) {
    if (loading) {
        return <span className="decision-badge loading"><Loader2 size={12} className="spinner" /></span>;
    }

    if (isChecking) {
        return (
            <span className="decision-badge checking">
                <Search size={12} className="pulse-icon" />
                Kontrol...
            </span>
        );
    }

    if (!decision) {
        return <span className="decision-badge unknown">-</span>;
    }

    const config = {
        'ONAY': { className: 'approve', label: 'ONAY' },
        'RET': { className: 'reject', label: 'RET' },
        'MANUEL': { className: 'manual', label: 'MANUEL' }
    };

    const cfg = config[decision] || { className: 'unknown', label: decision };

    return (
        <span className={`decision-badge ${cfg.className}`}>
            {cfg.label}
        </span>
    );
}

function WithdrawalsPage({ onViewDetail }) {
    const [withdrawals, setWithdrawals] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [newIds, setNewIds] = useState(new Set());
    const [flashStats, setFlashStats] = useState(false);
    const [checkingId, setCheckingId] = useState(null);
    const [decisions, setDecisions] = useState({}); // { clientId: { decision, loading } }

    // Refs to track previous state
    const prevIdsRef = useRef(new Set());
    const prevStatsRef = useRef(null);
    const isFirstLoad = useRef(true);

    // Subscribe to auto control checking ID
    useEffect(() => {
        return autoControlStore.subscribe(setCheckingId);
    }, []);

    // Fetch decisions for new withdrawals using batch API
    useEffect(() => {
        const loadDecisions = async () => {
            // Only examine 'Pending/New' withdrawals (State === 0)
            const newWithdrawals = withdrawals.filter(w => w.State === 0);
            if (newWithdrawals.length === 0) return;

            // Filter out withdrawals that already have a decision (to prevent re-loading/flicker)
            // User requested: "her çekim 1 kere kontrol edilsin"
            const withdrawalsToFetch = newWithdrawals.filter(w => !decisions[w.Id]);

            if (withdrawalsToFetch.length === 0) return;

            // Sort by oldest first ("en eskiden en yeniye")
            withdrawalsToFetch.sort((a, b) => new Date(a.RequestTimeLocal) - new Date(b.RequestTimeLocal));

            // Mark these specific ones as loading
            const loadingState = {};
            withdrawalsToFetch.forEach(w => {
                loadingState[w.Id] = { decision: null, loading: true };
            });
            setDecisions(prev => ({ ...prev, ...loadingState }));

            try {
                // Fetch in batch
                const result = await fetchDecisionsBatch(withdrawalsToFetch);

                if (result.success && result.decisions) {
                    // Update state with new decisions
                    const newDecisions = {};
                    Object.entries(result.decisions).forEach(([id, data]) => {
                        newDecisions[id] = {
                            decision: data.decision,
                            loading: false,
                            fromCache: data.fromCache
                        };
                    });
                    setDecisions(prev => ({ ...prev, ...newDecisions }));
                }
            } catch (err) {
                console.error('Failed to load decisions:', err);
                // Clear loading state on error only for the accumulated ones
                const errorState = {};
                withdrawalsToFetch.forEach(w => {
                    errorState[w.Id] = { decision: null, loading: false };
                });
                setDecisions(prev => ({ ...prev, ...errorState }));
            }
        };

        if (withdrawals.length > 0) {
            loadDecisions();
        }
    }, [withdrawals]); // Only runs when withdrawals list updates

    // Filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [methodFilter, setMethodFilter] = useState('all');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const loadWithdrawals = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const filters = {};

            // State filter
            if (statusFilter !== 'all') {
                filters.stateList = [parseInt(statusFilter)];
            }

            // Amount filters
            if (minAmount) filters.minAmount = parseInt(minAmount);
            if (maxAmount) filters.maxAmount = parseInt(maxAmount);

            const response = await fetchWithdrawals(filters);

            if (response.success) {
                let requests = response.data.requests || [];

                // Frontend filtering for payment method
                if (methodFilter !== 'all') {
                    requests = requests.filter(r =>
                        r.PaymentSystemName?.toLowerCase().includes(methodFilter.toLowerCase())
                    );
                }

                // Sort by newest first
                requests.sort((a, b) => new Date(b.RequestTimeLocal) - new Date(a.RequestTimeLocal));

                // Detect new withdrawals
                const currentIds = new Set(requests.map(r => r.Id));
                const newWithdrawalIds = new Set();

                if (!isFirstLoad.current) {
                    requests.forEach(r => {
                        if (!prevIdsRef.current.has(r.Id)) {
                            newWithdrawalIds.add(r.Id);
                        }
                    });

                    // Play sound if there are new withdrawals
                    if (newWithdrawalIds.size > 0) {
                        playNotificationSound();
                        setNewIds(newWithdrawalIds);

                        // Clear flash after 3 seconds
                        setTimeout(() => {
                            setNewIds(new Set());
                        }, 3000);
                    }

                    // Check if stats changed
                    const newStats = response.data.stats;
                    if (prevStatsRef.current) {
                        const changed =
                            prevStatsRef.current.new !== newStats.new ||
                            prevStatsRef.current.pending !== newStats.pending ||
                            prevStatsRef.current.paid !== newStats.paid ||
                            prevStatsRef.current.pendingAmount !== newStats.pendingAmount;

                        if (changed) {
                            setFlashStats(true);
                            setTimeout(() => setFlashStats(false), 1000);
                        }
                    }
                    prevStatsRef.current = newStats;
                } else {
                    isFirstLoad.current = false;
                    prevStatsRef.current = response.data.stats;
                }

                prevIdsRef.current = currentIds;
                setWithdrawals(requests);
                setStats(response.data.stats);
                setLastUpdate(new Date());
            } else {
                throw new Error(response.error || 'Unknown error');
            }

        } catch (err) {
            setError(err.message);
            console.error('Failed to load withdrawals:', err);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, methodFilter, minAmount, maxAmount]);

    useEffect(() => {
        loadWithdrawals();

        // Auto-refresh every 10 seconds for real-time updates
        const interval = setInterval(loadWithdrawals, 10000);
        return () => clearInterval(interval);
    }, [loadWithdrawals]);

    // Get unique payment methods
    const paymentMethods = [...new Set(withdrawals.map(w => w.PaymentSystemName).filter(Boolean))];

    return (
        <>
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Çekim Talepleri</h1>
                    <p className="page-subtitle">
                        {lastUpdate && `Son güncelleme: ${lastUpdate.toLocaleTimeString('tr-TR')}`}
                        {error && <span style={{ color: 'var(--status-rejected)', marginLeft: 12 }}>⚠️ {error}</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="filter-btn secondary">
                        <Download size={16} />
                        Dışa Aktar
                    </button>
                    <button className="filter-btn" onClick={loadWithdrawals} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spinner' : ''} />
                        Yenile
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                <KPICard
                    label="Yeni Talepler"
                    value={stats?.new || 0}
                    icon={Clock}
                    iconType="warning"
                    loading={loading && !stats}
                    flash={flashStats}
                />
                <KPICard
                    label="Beklemede"
                    value={stats?.pending || 0}
                    icon={AlertCircle}
                    iconType="info"
                    loading={loading && !stats}
                    flash={flashStats}
                />
                <KPICard
                    label="Bekleyen Tutar"
                    value={formatCurrency(stats?.pendingAmount)}
                    icon={Banknote}
                    iconType="info"
                    loading={loading && !stats}
                    flash={flashStats}
                />
                <KPICard
                    label="Bugün Ödenen"
                    value={stats?.paid || 0}
                    icon={CheckCircle}
                    iconType="success"
                    loading={loading && !stats}
                    flash={flashStats}
                />
            </div>

            {/* Chart removed - only list view */}

            {/* Filter Bar */}
            <div className="filter-bar">
                <div className="filter-group">
                    <Filter size={16} color="var(--text-muted)" />
                    <span className="filter-label">Filtrele:</span>
                </div>

                <div className="filter-group">
                    <span className="filter-label">Durum</span>
                    <select
                        className="filter-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Tümü</option>
                        <option value="0">Yeni</option>
                        <option value="2">Beklemede</option>
                        <option value="3">Ödendi</option>
                        <option value="-2">Reddedildi</option>
                        <option value="-1">İptal Edildi</option>
                    </select>
                </div>

                <div className="filter-group">
                    <span className="filter-label">Yöntem</span>
                    <select
                        className="filter-select"
                        value={methodFilter}
                        onChange={(e) => setMethodFilter(e.target.value)}
                    >
                        <option value="all">Tümü</option>
                        {paymentMethods.map(method => (
                            <option key={method} value={method}>{method}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <span className="filter-label">Min Tutar</span>
                    <input
                        type="number"
                        className="filter-input"
                        placeholder="₺0"
                        value={minAmount}
                        onChange={(e) => setMinAmount(e.target.value)}
                        style={{ width: '100px' }}
                    />
                </div>

                <div className="filter-group">
                    <span className="filter-label">Max Tutar</span>
                    <input
                        type="number"
                        className="filter-input"
                        placeholder="₺∞"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        style={{ width: '100px' }}
                    />
                </div>

                <div className="filter-spacer"></div>

                <button
                    className="filter-btn secondary"
                    onClick={() => {
                        setStatusFilter('all');
                        setMethodFilter('all');
                        setMinAmount('');
                        setMaxAmount('');
                    }}
                >
                    Filtreleri Temizle
                </button>
            </div>

            {/* Data Table */}
            <div className="card">
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Oyuncu</th>
                                <th className="sortable">Tutar <ArrowUpDown size={14} /></th>
                                <th>Yöntem</th>
                                <th>Durum</th>
                                <th>Oto. Karar</th>
                                <th className="sortable">Talep Zamanı <ArrowUpDown size={14} /></th>
                                <th>Onaylayan</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && withdrawals.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                                        <Loader2 className="spinner" size={32} style={{ margin: '0 auto' }} />
                                        <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Yükleniyor...</p>
                                    </td>
                                </tr>
                            ) : withdrawals.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                                        <p style={{ color: 'var(--text-muted)' }}>Çekim talebi bulunamadı</p>
                                    </td>
                                </tr>
                            ) : (
                                withdrawals.map((w) => (
                                    <tr
                                        key={w.Id}
                                        className={`${newIds.has(w.Id) ? 'new-row-flash' : ''} ${checkingId === w.Id ? 'checking-row' : ''}`}
                                    >
                                        <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                            {checkingId === w.Id && <Search size={14} className="checking-icon" />}
                                            {w.Id}
                                        </td>
                                        <td>
                                            <div className="player-info">
                                                <span className="player-name">{w.ClientName || `${w.ClientFirstName} ${w.ClientLastName}`}</span>
                                                <span className="player-id">{w.ClientLogin} • {w.ClientId}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="amount">{formatCurrency(w.Amount)}</span>
                                        </td>
                                        <td>{w.PaymentSystemName || '-'}</td>
                                        <td>
                                            <StatusBadge state={w.State} />
                                        </td>
                                        <td>
                                            <DecisionBadge
                                                decision={w.State === 0 ? decisions[w.Id]?.decision : null}
                                                loading={w.State === 0 ? decisions[w.Id]?.loading : false}
                                                isChecking={checkingId === w.Id}
                                            />
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)' }}>
                                            {formatDateTime(w.RequestTimeLocal)}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)' }}>
                                            {w.AllowUserName || w.RejectUserName || '-'}
                                        </td>
                                        <td>
                                            <div className="action-btns">
                                                <button
                                                    className="action-btn view"
                                                    title="Detay"
                                                    onClick={() => onViewDetail && onViewDetail(w)}
                                                >
                                                    <Eye />
                                                </button>
                                                {(w.State === 0 || w.State === 2) && (
                                                    <>
                                                        <button className="action-btn approve" title="Onayla">
                                                            <Check />
                                                        </button>
                                                        <button className="action-btn reject" title="Reddet">
                                                            <X />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="pagination">
                    <div className="pagination-info">
                        Toplam {withdrawals.length} çekim talebi
                    </div>
                    <div className="pagination-buttons">
                        <button className="pagination-btn" disabled>
                            <ChevronLeft size={16} />
                        </button>
                        <button className="pagination-btn active">1</button>
                        <button className="pagination-btn">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .spinner {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                /* New row flash animation */
                .new-row-flash {
                    animation: rowFlash 0.8s ease-in-out 3;
                }
                @keyframes rowFlash {
                    0%, 100% { 
                        background-color: transparent; 
                    }
                    50% { 
                        background-color: rgba(74, 158, 255, 0.25); 
                        box-shadow: inset 0 0 20px rgba(74, 158, 255, 0.15);
                    }
                }
                
                /* KPI card flash animation */
                .kpi-card.flash-update {
                    animation: cardFlash 0.5s ease-in-out 2;
                }
                @keyframes cardFlash {
                    0%, 100% { 
                        border-color: var(--border-subtle);
                    }
                    50% { 
                        border-color: var(--accent-primary);
                        box-shadow: 0 0 15px rgba(74, 158, 255, 0.3);
                    }
                }
                
                /* Checking row indicator */
                .checking-row {
                    background-color: rgba(255, 181, 69, 0.1) !important;
                    border-left: 3px solid var(--status-pending);
                }
                
                .checking-icon {
                    display: inline-block;
                    margin-right: 6px;
                    color: var(--status-pending);
                    animation: pulse 1s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                
                /* Decision Badge styles */
                .decision-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .decision-badge.loading {
                    background: var(--bg-tertiary);
                    color: var(--text-muted);
                }
                .decision-badge.checking {
                    background: rgba(255, 181, 69, 0.15);
                    color: var(--status-pending);
                    animation: pulse 1s infinite;
                }
                .decision-badge.approve {
                    background: rgba(52, 199, 89, 0.15);
                    color: var(--status-approved);
                }
                .decision-badge.reject {
                    background: rgba(255, 87, 87, 0.15);
                    color: var(--status-rejected);
                }
                .decision-badge.manual {
                    background: rgba(255, 181, 69, 0.15);
                    color: var(--status-pending);
                }
                .decision-badge.unknown {
                    color: var(--text-muted);
                }
                
                .pulse-icon {
                    animation: pulse 1s infinite;
                }
            `}</style>
        </>
    );
}

export default WithdrawalsPage;
