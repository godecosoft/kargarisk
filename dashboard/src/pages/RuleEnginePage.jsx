import React, { useState, useEffect } from 'react';
import { Shield, Save, AlertTriangle, Loader2, Power, Zap, Ban, DollarSign, Gamepad2, Trophy, Gift, RefreshCw } from 'lucide-react';
import { fetchRules, saveRule, fetchAutoApprovalRules, updateAutoApprovalRule } from '../services/api';

function RuleEnginePage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rules, setRules] = useState({
        turnoverMultiplier: 1.0
    });
    const [autoRules, setAutoRules] = useState({});

    useEffect(() => {
        loadAllRules();
    }, []);

    const loadAllRules = async () => {
        setLoading(true);
        try {
            const [generalRules, autoApprovalRules] = await Promise.all([
                fetchRules(),
                fetchAutoApprovalRules()
            ]);

            console.log('Loaded auto-approval rules:', autoApprovalRules);

            if (generalRules.success && generalRules.rules) {
                setRules(prev => ({
                    ...prev,
                    turnoverMultiplier: parseFloat(generalRules.rules.turnover_multiplier || 1.0)
                }));
            }

            if (autoApprovalRules.success && autoApprovalRules.rules) {
                console.log('Setting autoRules:', autoApprovalRules.rules);
                setAutoRules(autoApprovalRules.rules);
            } else {
                console.error('Auto-approval rules failed:', autoApprovalRules);
            }
        } catch (error) {
            console.error('Failed to load rules:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGeneral = async () => {
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

    const handleToggleRule = async (ruleKey) => {
        const rule = autoRules[ruleKey];
        if (!rule) return;

        const newEnabled = !rule.enabled;
        try {
            await updateAutoApprovalRule(ruleKey, rule.value, newEnabled);
            setAutoRules(prev => ({
                ...prev,
                [ruleKey]: { ...prev[ruleKey], enabled: newEnabled }
            }));
        } catch (error) {
            alert('Güncelleme hatası: ' + error.message);
        }
    };

    const handleUpdateRuleValue = async (ruleKey, newValue) => {
        const rule = autoRules[ruleKey];
        if (!rule) return;

        try {
            await updateAutoApprovalRule(ruleKey, newValue, rule.enabled);
            setAutoRules(prev => ({
                ...prev,
                [ruleKey]: { ...prev[ruleKey], value: newValue }
            }));
        } catch (error) {
            alert('Güncelleme hatası: ' + error.message);
        }
    };

    const ruleIcons = {
        MAX_AMOUNT: DollarSign,
        MAX_WITHDRAWAL_RATIO: DollarSign,
        REQUIRE_DEPOSIT_TODAY: RefreshCw,
        NO_BONUS_AFTER_DEPOSIT: Gift,
        NO_FREESPIN_BONUS: Zap,
        NO_SPORTS_BETS: Trophy,
        FORBIDDEN_GAMES: Gamepad2,
        TURNOVER_COMPLETE: Shield
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
                    <p className="page-subtitle">Otomatik onay ve kontrol sistemi kuralları</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>

                {/* Auto-Approval Master Control */}
                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={20} color="var(--status-approved)" />
                            Otomatik Onay Sistemi
                        </h3>
                        <button
                            onClick={() => handleToggleRule('AUTO_APPROVAL_ENABLED')}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '24px',
                                border: 'none',
                                background: autoRules.AUTO_APPROVAL_ENABLED?.enabled ? 'var(--status-approved)' : 'var(--status-rejected)',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Power size={18} />
                            {autoRules.AUTO_APPROVAL_ENABLED?.enabled ? 'SİSTEM AÇIK' : 'SİSTEM KAPALI'}
                        </button>
                    </div>
                    <div className="card-body">
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                            {autoRules.AUTO_APPROVAL_ENABLED?.enabled
                                ? '✅ Sistem aktif - Aşağıdaki tüm kuralları geçen çekimler otomatik onaylanır.'
                                : '⛔ Sistem kapalı - Hiçbir çekim otomatik onaylanmaz.'
                            }
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                            {Object.entries(autoRules).filter(([key]) => key !== 'AUTO_APPROVAL_ENABLED').map(([key, rule]) => {
                                const Icon = ruleIcons[key] || Shield;
                                return (
                                    <div key={key} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        background: rule.enabled ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)',
                                        border: rule.enabled ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-md)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Icon size={18} color={rule.enabled ? 'var(--status-approved)' : 'var(--text-muted)'} />
                                            <div>
                                                <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>
                                                    {rule.name}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    {rule.description}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleToggleRule(key)}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '16px',
                                                border: 'none',
                                                background: rule.enabled ? 'var(--status-approved)' : 'var(--bg-secondary)',
                                                color: rule.enabled ? 'white' : 'var(--text-muted)',
                                                cursor: 'pointer',
                                                fontWeight: 500,
                                                fontSize: '12px'
                                            }}
                                        >
                                            {rule.enabled ? 'Açık' : 'Kapalı'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Auto-Approval Settings */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Otomatik Onay Limitleri</h3>
                    </div>
                    <div className="card-body">

                        {/* Max Amount */}
                        <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Maksimum Çekim Tutarı (₺)
                            </label>
                            <input
                                type="number"
                                step="500"
                                min="0"
                                value={autoRules.MAX_AMOUNT?.value || 5000}
                                onChange={(e) => handleUpdateRuleValue('MAX_AMOUNT', e.target.value)}
                                className="filter-input"
                                style={{ width: '100%', fontSize: '16px', padding: '10px' }}
                            />
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                Bu tutarın üzerindeki çekimler manuel onaya gider.
                            </div>
                        </div>

                        {/* Max Withdrawal Ratio */}
                        <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Maksimum Yatırım/Çekim Oranı (x)
                            </label>
                            <input
                                type="number"
                                step="5"
                                min="1"
                                value={autoRules.MAX_WITHDRAWAL_RATIO?.value || 30}
                                onChange={(e) => handleUpdateRuleValue('MAX_WITHDRAWAL_RATIO', e.target.value)}
                                className="filter-input"
                                style={{ width: '100%', fontSize: '16px', padding: '10px' }}
                            />
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                Çekim tutarı yatırımın bu katını aşarsa manuel onaya gider. (Örn: 30 = yatırımın 30 katına kadar)
                            </div>
                        </div>

                        {/* Turnover Percentage */}
                        <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Minimum Çevrim Yüzdesi (%)
                            </label>
                            <input
                                type="number"
                                step="10"
                                min="0"
                                value={autoRules.TURNOVER_COMPLETE?.value || 100}
                                onChange={(e) => handleUpdateRuleValue('TURNOVER_COMPLETE', e.target.value)}
                                className="filter-input"
                                style={{ width: '100%', fontSize: '16px', padding: '10px' }}
                            />
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                Çevrim bu yüzdenin altındaysa onaylanmaz.
                            </div>
                        </div>

                        {/* Forbidden Games */}
                        <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                Yasaklı Oyun Kelimeleri
                            </label>
                            <input
                                type="text"
                                value={autoRules.FORBIDDEN_GAMES?.value || ''}
                                onChange={(e) => handleUpdateRuleValue('FORBIDDEN_GAMES', e.target.value)}
                                className="filter-input"
                                style={{ width: '100%', fontSize: '14px', padding: '10px' }}
                                placeholder="Roulette,Blackjack,Aviator..."
                            />
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                Virgülle ayrılmış liste. Bu kelimeleri içeren oyunlar yasaklı.
                            </div>
                        </div>

                    </div>
                </div>

                {/* General Rules */}
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title">Genel Çevrim Kuralları</h3>
                        <button
                            onClick={handleSaveGeneral}
                            disabled={saving}
                            className="filter-btn"
                            style={{ height: '32px', padding: '0 16px', fontSize: '13px' }}
                        >
                            {saving ? <Loader2 className="spinner" size={14} /> : <Save size={14} />}
                            Kaydet
                        </button>
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
                                Yatırımın kaç katı çevrim yapılması gerektiğini belirler.
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </>
    );
}

export default RuleEnginePage;
