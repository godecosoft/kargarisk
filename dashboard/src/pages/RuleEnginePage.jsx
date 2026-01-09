import React, { useState, useEffect } from 'react';
import { Shield, Save, AlertTriangle, Loader2 } from 'lucide-react';
import { fetchRules, saveRule } from '../services/api';

function RuleEnginePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rules, setRules] = useState({
        autoRejectEnabled: true,
        turnoverMultiplier: 1.0, // Default 1x
        sportBonusRules: true
    });

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        setLoading(true);
        try {
            const apiRules = await fetchRules();
            if (apiRules.success && apiRules.rules) {
                setRules(prev => ({
                    ...prev,
                    turnoverMultiplier: parseFloat(apiRules.rules.turnover_multiplier || 1.0)
                }));
            }
        } catch (error) {
            console.error('Failed to load rules:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveRule('turnover_multiplier', rules.turnoverMultiplier, 'Spor/Casino Çevrim Çarpanı');
            alert('Kurallar başarıyla kaydedildi');
        } catch (error) {
            alert('Kayıt hatası: ' + error.message);
        } finally {
            setSaving(false);
        }
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
                    <h1 className="page-title">Kural Motoru Yapılandırması</h1>
                    <p className="page-subtitle">Otomatik kontrol sistemi için kurallar ve limitler</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="filter-btn"
                    style={{ height: '40px', padding: '0 24px' }}
                >
                    {saving ? <Loader2 className="spinner" size={18} /> : <Save size={18} />}
                    Değişiklikleri Kaydet
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>

                {/* General Rules (Simulation for others) */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Genel Kurallar</h3>
                    </div>
                    <div className="card-body">

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: '12px', opacity: 0.5, cursor: 'not-allowed' }} title="Yakında">
                            <div>
                                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Otomatik Reddetme</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Kurallara uymayanları otomatik reddet</div>
                            </div>
                            <div className="status-badge approved">Aktif</div>
                        </div>

                        <div style={{ padding: '12px', background: 'rgba(255, 181, 69, 0.1)', border: '1px solid rgba(255, 181, 69, 0.2)', borderRadius: 'var(--radius-md)', marginTop: '24px', display: 'flex', gap: '12px' }}>
                            <AlertTriangle color="var(--status-pending)" size={20} style={{ flexShrink: 0 }} />
                            <div style={{ fontSize: '13px', color: 'var(--status-pending)' }}>
                                Bu ayarlar (Auto Reject vb.) şu anda sadece simülasyon amaçlıdır. Sistemi etkilemez. Kurallar şu an için kod içinde sabittir.
                            </div>
                        </div>

                    </div>
                </div>

                {/* Limits */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Limitler ve Gereksinimler</h3>
                    </div>
                    <div className="card-body">

                        <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Çevrim Çarpanı (x)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={rules.turnoverMultiplier}
                                onChange={(e) => setRules({ ...rules, turnoverMultiplier: parseFloat(e.target.value) })}
                                className="filter-input"
                                style={{ width: '100%', fontSize: '16px', padding: '10px' }}
                            />
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                Yatırımın kaç katı çevrim yapılması gerektiğini belirler. (Örn: 1.0 = %100)
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </>
    );
}

export default RuleEnginePage;
