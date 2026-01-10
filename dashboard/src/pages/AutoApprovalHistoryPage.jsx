import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, DollarSign, User, Loader2, RefreshCw } from 'lucide-react';
import { fetchAutoApprovalHistory } from '../services/api';

function AutoApprovalHistoryPage() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const res = await fetchAutoApprovalHistory(100);
            if (res.success) {
                setHistory(res.data || []);
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatDate = (dateStr) => {
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

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 className="spinner" size={48} />
            </div>
        );
    }

    return (
        <>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Otomatik Onay Geçmişi</h1>
                    <p className="page-subtitle">Bot tarafından otomatik onaylanan çekimler</p>
                </div>
                <button onClick={loadHistory} className="filter-btn" style={{ height: '40px', padding: '0 24px' }}>
                    <RefreshCw size={18} />
                    Yenile
                </button>
            </div>

            {history.length === 0 ? (
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center', padding: '48px' }}>
                        <CheckCircle size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
                        <h3 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Henüz Otomatik Onay Yok</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Otomatik onay sistemi aktifken, kurallara uyan çekimler burada listelenecek.</p>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Çekim ID</th>
                                    <th>Üye</th>
                                    <th>Tutar</th>
                                    <th>Geçen Kurallar</th>
                                    <th>Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((item) => {
                                    let rulesPassed = [];
                                    try {
                                        rulesPassed = JSON.parse(item.rules_passed || '[]');
                                    } catch (e) {
                                        rulesPassed = [];
                                    }

                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Clock size={14} color="var(--text-muted)" />
                                                    {formatDate(item.approved_at)}
                                                </div>
                                            </td>
                                            <td>
                                                <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {item.withdrawal_id}
                                                </code>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <User size={14} color="var(--text-muted)" />
                                                    {item.client_login || `ID: ${item.client_id}`}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--status-approved)' }}>
                                                    <DollarSign size={14} />
                                                    {formatCurrency(item.amount)}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {rulesPassed.slice(0, 3).map((rule, i) => (
                                                        <span key={i} style={{
                                                            fontSize: '11px',
                                                            padding: '2px 6px',
                                                            background: 'rgba(34, 197, 94, 0.1)',
                                                            color: 'var(--status-approved)',
                                                            borderRadius: '4px'
                                                        }}>
                                                            ✓ {rule.split(':')[0]}
                                                        </span>
                                                    ))}
                                                    {rulesPassed.length > 3 && (
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                            +{rulesPassed.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="status-badge approved">
                                                    <CheckCircle size={12} />
                                                    Onaylandı
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <style>{`
                .data-table {
                    border-collapse: collapse;
                }
                .data-table th,
                .data-table td {
                    padding: 12px 16px;
                    text-align: left;
                    border-bottom: 1px solid var(--border-subtle);
                }
                .data-table th {
                    background: var(--bg-tertiary);
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                }
                .data-table tr:hover {
                    background: var(--bg-hover);
                }
            `}</style>
        </>
    );
}

export default AutoApprovalHistoryPage;
