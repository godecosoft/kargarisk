import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, CheckCircle, XCircle, Gift, Save, X, AlertTriangle, Zap, DollarSign, ShieldAlert } from 'lucide-react';
import { fetchBonusRules, addBonusRule, updateBonusRule, deleteBonusRule } from '../services/api';

export default function BonusRulesPage() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [error, setError] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        max_amount: 0,
        ignore_deposit_rule: false,
        auto_approval_enabled: false,
        turnover_multiplier: 0,
        min_withdrawal_multiplier: 0,
        max_withdrawal_multiplier: 0,
        min_balance_limit: 0,
        fixed_withdrawal_amount: 0,
        max_remaining_balance: 0,
        require_deposit_id: false,
        delete_excess_balance: false,
        check_wagering_status: false,
        // Enabled flags for each numeric field
        max_amount_enabled: false,
        turnover_multiplier_enabled: false,
        min_withdrawal_multiplier_enabled: false,
        max_withdrawal_multiplier_enabled: false,
        min_balance_limit_enabled: false,
        fixed_withdrawal_amount_enabled: false,
        max_remaining_balance_enabled: false
    });

    const resetFormData = () => ({
        name: '',
        max_amount: 0,
        ignore_deposit_rule: false,
        auto_approval_enabled: false,
        turnover_multiplier: 0,
        min_withdrawal_multiplier: 0,
        max_withdrawal_multiplier: 0,
        min_balance_limit: 0,
        fixed_withdrawal_amount: 0,
        max_remaining_balance: 0,
        require_deposit_id: false,
        delete_excess_balance: false,
        check_wagering_status: false,
        max_amount_enabled: false,
        turnover_multiplier_enabled: false,
        min_withdrawal_multiplier_enabled: false,
        max_withdrawal_multiplier_enabled: false,
        min_balance_limit_enabled: false,
        fixed_withdrawal_amount_enabled: false,
        max_remaining_balance_enabled: false
    });

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        try {
            setLoading(true);
            const data = await fetchBonusRules();
            setRules(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (!formData.name) {
                alert('Kural adı zorunludur!');
                return;
            }

            // match_keyword'ü isimden otomatik oluştur (Türkçe karakterler çevrilir)
            const autoKeyword = formData.name
                .toUpperCase()
                .replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S')
                .replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
                .replace(/[^A-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');

            const dataToSend = { ...formData, match_keyword: autoKeyword };

            if (editingRule) {
                await updateBonusRule(editingRule.id, dataToSend);
            } else {
                await addBonusRule(dataToSend);
            }

            setShowAddModal(false);
            setEditingRule(null);
            setFormData(resetFormData());
            loadRules(); // Reload list
        } catch (err) {
            alert('Hata: ' + err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu kuralı silmek istediğinize emin misiniz?')) return;
        try {
            await deleteBonusRule(id);
            loadRules();
        } catch (err) {
            alert('Silinemedi: ' + err.message);
        }
    };

    const openEdit = (rule) => {
        setEditingRule(rule);
        setFormData({
            name: rule.name,
            max_amount: rule.max_amount || 0,
            ignore_deposit_rule: Boolean(rule.ignore_deposit_rule),
            auto_approval_enabled: Boolean(rule.auto_approval_enabled),
            turnover_multiplier: rule.turnover_multiplier || 0,
            min_withdrawal_multiplier: rule.min_withdrawal_multiplier || 0,
            max_withdrawal_multiplier: rule.max_withdrawal_multiplier || 0,
            min_balance_limit: rule.min_balance_limit || 0,
            fixed_withdrawal_amount: rule.fixed_withdrawal_amount || 0,
            max_remaining_balance: rule.max_remaining_balance || 0,
            require_deposit_id: Boolean(rule.require_deposit_id),
            delete_excess_balance: Boolean(rule.delete_excess_balance),
            check_wagering_status: Boolean(rule.check_wagering_status),
            // Enabled flags
            max_amount_enabled: Boolean(rule.max_amount_enabled),
            turnover_multiplier_enabled: Boolean(rule.turnover_multiplier_enabled),
            min_withdrawal_multiplier_enabled: Boolean(rule.min_withdrawal_multiplier_enabled),
            max_withdrawal_multiplier_enabled: Boolean(rule.max_withdrawal_multiplier_enabled),
            min_balance_limit_enabled: Boolean(rule.min_balance_limit_enabled),
            fixed_withdrawal_amount_enabled: Boolean(rule.fixed_withdrawal_amount_enabled),
            max_remaining_balance_enabled: Boolean(rule.max_remaining_balance_enabled)
        });
        setShowAddModal(true);
    };

    const toggleStatus = async (rule, field) => {
        try {
            await updateBonusRule(rule.id, { [field]: !rule[field] });
            loadRules(); // Refresh to see update
        } catch (err) {
            alert('Güncellenemedi: ' + err.message);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Bonus Kuralları</h1>
                    <p className="page-subtitle">Özel bonus ve freespin kuralları tanımlayın</p>
                </div>
                <button className="primary-btn" onClick={() => {
                    setEditingRule(null);
                    setFormData(resetFormData());
                    setShowAddModal(true);
                }}>
                    <Plus size={16} /> Yeni Kural Ekle
                </button>
            </div>

            {error && (
                <div className="error-banner">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {loading ? (
                <div className="loading-indicator">Yükleniyor...</div>
            ) : (
                <div className="rules-grid-list">
                    {rules.length === 0 ? (
                        <div className="empty-state">Henüz kural tanımlanmamış.</div>
                    ) : (
                        rules.map(rule => (
                            <div key={rule.id} className={`rule-card ${!rule.is_active ? 'inactive' : ''}`}>
                                <div className="rule-header">
                                    <div className="rule-icon">
                                        <Gift size={20} />
                                    </div>
                                    <div className="rule-info">
                                        <div className="rule-name">{rule.name}</div>
                                    </div>
                                    <div className="rule-actions">
                                        <button className="icon-btn edit" onClick={() => openEdit(rule)}>
                                            <Edit2 size={14} />
                                        </button>
                                        <button className="icon-btn delete" onClick={() => handleDelete(rule.id)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="rule-settings">
                                    <div className="setting-row">
                                        <span className="setting-label"><DollarSign size={12} /> Max Çekim:</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <span className="setting-value">₺{rule.max_amount}</span>
                                            {rule.max_withdrawal_multiplier > 0 && (
                                                <small style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                                    ({rule.max_withdrawal_multiplier}x Yatırım)
                                                </small>
                                            )}
                                        </div>
                                    </div>
                                    {rule.turnover_multiplier > 0 && (
                                        <div className="setting-row">
                                            <span className="setting-label"><ShieldAlert size={12} /> Çevrim:</span>
                                            <span className="setting-value">{rule.turnover_multiplier} Katı</span>
                                        </div>
                                    )}
                                    <div className="setting-row switch-row">
                                        <span className="setting-label">Kural Aktif</span>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={rule.is_active}
                                                onChange={() => toggleStatus(rule, 'is_active')}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <div className="setting-row switch-row">
                                        <span className="setting-label"><Zap size={12} /> Oto-Onay</span>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={rule.auto_approval_enabled}
                                                onChange={() => toggleStatus(rule, 'auto_approval_enabled')}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <div className="setting-row switch-row">
                                        <span className="setting-label"><ShieldAlert size={12} /> Yatırım Şartı Yoksay</span>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={rule.ignore_deposit_rule}
                                                onChange={() => toggleStatus(rule, 'ignore_deposit_rule')}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <div className="setting-row switch-row">
                                        <span className="setting-label">Yatırım ID Kontrolü</span>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={rule.require_deposit_id}
                                                onChange={() => toggleStatus(rule, 'require_deposit_id')}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <div className="setting-row switch-row">
                                        <span className="setting-label">Bonus Çevrim Kontrolü</span>
                                        <label className="toggle-switch">
                                            <input
                                                type="checkbox"
                                                checked={rule.check_wagering_status}
                                                onChange={() => toggleStatus(rule, 'check_wagering_status')}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <div className="setting-row switch-row warning-row">
                                        <span className="setting-label"><AlertTriangle size={12} /> Bakiye Silme</span>
                                        <label className="toggle-switch warning">
                                            <input
                                                type="checkbox"
                                                checked={rule.delete_excess_balance}
                                                onChange={() => toggleStatus(rule, 'delete_excess_balance')}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>{editingRule ? 'Kural Düzenle' : 'Yeni Bonus Kuralı'}</h3>
                            <button className="close-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Bonus Adı (Görünen İsim)</label>
                                <input
                                    type="text"
                                    placeholder="Örn: 500 TL Deneme Bonusu"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            {/* Max Çekim Tutarı - Toggle'lı */}
                            <div className="form-group-toggle">
                                <div className="toggle-header">
                                    <label>Maksimum Çekim Tutarı (TL)</label>
                                    <label className="toggle-switch small">
                                        <input
                                            type="checkbox"
                                            checked={formData.max_amount_enabled}
                                            onChange={e => setFormData({ ...formData, max_amount_enabled: e.target.checked })}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                                <input
                                    type="number"
                                    placeholder="Örn: 5000"
                                    value={formData.max_amount}
                                    onChange={e => setFormData({ ...formData, max_amount: e.target.value })}
                                    disabled={!formData.max_amount_enabled}
                                    className={!formData.max_amount_enabled ? 'disabled' : ''}
                                />
                                <small>Sabit maksimum çekim limiti</small>
                            </div>

                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {/* Çevrim Şartı - Toggle'lı */}
                                <div className="form-group-toggle">
                                    <div className="toggle-header">
                                        <label>Çevrim Şartı (Katı)</label>
                                        <label className="toggle-switch small">
                                            <input
                                                type="checkbox"
                                                checked={formData.turnover_multiplier_enabled}
                                                onChange={e => setFormData({ ...formData, turnover_multiplier_enabled: e.target.checked })}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="Örn: 10"
                                        value={formData.turnover_multiplier}
                                        onChange={e => setFormData({ ...formData, turnover_multiplier: e.target.value })}
                                        disabled={!formData.turnover_multiplier_enabled}
                                        className={!formData.turnover_multiplier_enabled ? 'disabled' : ''}
                                    />
                                    <small>Yatırımın kaç katı çevrim?</small>
                                </div>
                                {/* Max Çekim Katı - Toggle'lı */}
                                <div className="form-group-toggle">
                                    <div className="toggle-header">
                                        <label>Max Çekim (Yatırım Katı)</label>
                                        <label className="toggle-switch small">
                                            <input
                                                type="checkbox"
                                                checked={formData.max_withdrawal_multiplier_enabled}
                                                onChange={e => setFormData({ ...formData, max_withdrawal_multiplier_enabled: e.target.checked })}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="Örn: 10"
                                        value={formData.max_withdrawal_multiplier}
                                        onChange={e => setFormData({ ...formData, max_withdrawal_multiplier: e.target.value })}
                                        disabled={!formData.max_withdrawal_multiplier_enabled}
                                        className={!formData.max_withdrawal_multiplier_enabled ? 'disabled' : ''}
                                    />
                                    <small>Yatırımın max kaç katı çekilebilir?</small>
                                </div>
                            </div>

                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {/* Min Çekim Katı - Toggle'lı */}
                                <div className="form-group-toggle">
                                    <div className="toggle-header">
                                        <label>Min Çekim (Yatırım Katı)</label>
                                        <label className="toggle-switch small">
                                            <input
                                                type="checkbox"
                                                checked={formData.min_withdrawal_multiplier_enabled}
                                                onChange={e => setFormData({ ...formData, min_withdrawal_multiplier_enabled: e.target.checked })}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="Örn: 5"
                                        value={formData.min_withdrawal_multiplier}
                                        onChange={e => setFormData({ ...formData, min_withdrawal_multiplier: e.target.value })}
                                        disabled={!formData.min_withdrawal_multiplier_enabled}
                                        className={!formData.min_withdrawal_multiplier_enabled ? 'disabled' : ''}
                                    />
                                    <small>Yatırımın en az kaç katı çekilmeli?</small>
                                </div>
                                {/* Min Bakiye Şartı - Toggle'lı */}
                                <div className="form-group-toggle">
                                    <div className="toggle-header">
                                        <label>Minimum Bakiye Şartı (₺)</label>
                                        <label className="toggle-switch small">
                                            <input
                                                type="checkbox"
                                                checked={formData.min_balance_limit_enabled}
                                                onChange={e => setFormData({ ...formData, min_balance_limit_enabled: e.target.checked })}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="Örn: 15000"
                                        value={formData.min_balance_limit}
                                        onChange={e => setFormData({ ...formData, min_balance_limit: e.target.value })}
                                        disabled={!formData.min_balance_limit_enabled}
                                        className={!formData.min_balance_limit_enabled ? 'disabled' : ''}
                                    />
                                    <small>Çekim için ulaşılması gereken bakiye</small>
                                </div>
                            </div>

                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {/* Sabit Çekim - Toggle'lı */}
                                <div className="form-group-toggle">
                                    <div className="toggle-header">
                                        <label>Sabit Çekim Tutarı (₺)</label>
                                        <label className="toggle-switch small">
                                            <input
                                                type="checkbox"
                                                checked={formData.fixed_withdrawal_amount_enabled}
                                                onChange={e => setFormData({ ...formData, fixed_withdrawal_amount_enabled: e.target.checked })}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="Örn: 1000"
                                        value={formData.fixed_withdrawal_amount}
                                        onChange={e => setFormData({ ...formData, fixed_withdrawal_amount: e.target.value })}
                                        disabled={!formData.fixed_withdrawal_amount_enabled}
                                        className={!formData.fixed_withdrawal_amount_enabled ? 'disabled' : ''}
                                    />
                                    <small>Sabit çekim limiti</small>
                                </div>
                                {/* Max Bırakılabilir Bakiye - Toggle'lı */}
                                <div className="form-group-toggle">
                                    <div className="toggle-header">
                                        <label>Max İçeride Bırakılabilir (₺)</label>
                                        <label className="toggle-switch small">
                                            <input
                                                type="checkbox"
                                                checked={formData.max_remaining_balance_enabled}
                                                onChange={e => setFormData({ ...formData, max_remaining_balance_enabled: e.target.checked })}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <input
                                        type="number"
                                        placeholder="Örn: 3"
                                        value={formData.max_remaining_balance}
                                        onChange={e => setFormData({ ...formData, max_remaining_balance: e.target.value })}
                                        disabled={!formData.max_remaining_balance_enabled}
                                        className={!formData.max_remaining_balance_enabled ? 'disabled' : ''}
                                    />
                                    <small>0 = tüm bakiye çekilmeli</small>
                                </div>
                            </div>

                            <div className="form-check-group">
                                <label className="check-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.ignore_deposit_rule}
                                        onChange={e => setFormData({ ...formData, ignore_deposit_rule: e.target.checked })}
                                    />
                                    <span>Yatırım ve Oran Şartını Yoksay (Deneme bonusları için)</span>
                                </label>
                            </div>

                            <div className="form-check-group">
                                <label className="check-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.require_deposit_id}
                                        onChange={e => setFormData({ ...formData, require_deposit_id: e.target.checked })}
                                    />
                                    <span>Yatırım ID Kontrolü Gerekli</span>
                                </label>
                            </div>

                            <div className="form-check-group" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                <label className="check-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.check_wagering_status}
                                        onChange={e => setFormData({ ...formData, check_wagering_status: e.target.checked })}
                                    />
                                    <span>Bonus Çevrim Kontrolü (Ana Para + Bonus Çevrimi)</span>
                                </label>
                            </div>

                            <div className="form-check-group warning">
                                <label className="check-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.delete_excess_balance}
                                        onChange={e => setFormData({ ...formData, delete_excess_balance: e.target.checked })}
                                    />
                                    <span>Kalan Bakiyeyi Sil (Çekim onayından önce üst bakiye silinir)</span>
                                </label>
                            </div>

                            <div className="form-check-group highlight">
                                <label className="check-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.auto_approval_enabled}
                                        onChange={e => setFormData({ ...formData, auto_approval_enabled: e.target.checked })}
                                    />
                                    <span>Bu bonus için Otomatik Onay açık olsun</span>
                                </label>
                            </div>


                        </div>
                        <div className="modal-footer">
                            <button className="secondary-btn" onClick={() => setShowAddModal(false)}>İptal</button>
                            <button className="primary-btn" onClick={handleSave}>
                                <Save size={16} /> Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .page-container { padding: 20px; color: var(--text-primary); }
                .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .page-title { font-size: 24px; font-weight: 700; margin: 0; }
                .rules-grid-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
                
                .rule-card { 
                    background: var(--bg-card); 
                    border: 1px solid var(--border-subtle); 
                    border-radius: var(--radius-lg); 
                    padding: 16px;
                    transition: all 0.2s;
                }
                .rule-card.inactive { opacity: 0.6; }
                
                .rule-header { display: flex; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; }
                .rule-icon { background: var(--bg-tertiary); padding: 10px; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: var(--brand-primary); }
                .rule-info { flex: 1; }
                .rule-name { font-weight: 700; font-size: 16px; }
                .rule-keyword span { background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px; }
                
                .rule-settings { display: flex; flex-direction: column; gap: 8px; }
                .setting-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
                .setting-label { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); }
                .setting-value { font-weight: 600; }
                .setting-value.success { color: var(--status-approved); }
                .setting-value.warning { color: var(--status-pending); }

                /* Toggle Switch */
                .toggle-switch { position: relative; display: inline-block; width: 36px; height: 20px; }
                .toggle-switch.small { width: 32px; height: 18px; }
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--bg-tertiary); transition: .4s; border-radius: 20px; }
                .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
                .toggle-switch.small .slider:before { height: 14px; width: 14px; }
                input:checked + .slider { background-color: var(--brand-primary); }
                input:checked + .slider:before { transform: translateX(16px); }
                .toggle-switch.small input:checked + .slider:before { transform: translateX(14px); }
                .toggle-switch.warning input:checked + .slider { background-color: #f59e0b; }
                .warning-row { background: rgba(245, 158, 11, 0.1); padding: 4px 8px; border-radius: 6px; margin-top: 4px; }

                /* Toggle'lı Form Alanları */
                .form-group-toggle { margin-bottom: 16px; }
                .form-group-toggle .toggle-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
                .form-group-toggle .toggle-header label:first-child { font-size: 13px; color: var(--text-secondary); }
                .form-group-toggle input[type="number"] { width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-primary); }
                .form-group-toggle input[type="number"].disabled { opacity: 0.4; cursor: not-allowed; background: var(--bg-secondary); }
                .form-group-toggle small { display: block; margin-top: 4px; font-size: 11px; opacity: 0.7; }

                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal-content { background: var(--bg-card); padding: 24px; border-radius: var(--radius-lg); width: 100%; max-width: 500px; border: 1px solid var(--border-subtle); }
                .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
                
                .form-group { margin-bottom: 16px; }
                .form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: var(--text-secondary); }
                .form-group input { width: 100%; padding: 10px; background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); color: var(--text-primary); }
                .form-group small { display: block; margin-top: 4px; font-size: 11px; opacity: 0.7; }
                
                .form-check-group { margin-bottom: 12px; padding: 10px; border-radius: var(--radius-md); background: var(--bg-tertiary); }
                .form-check-group.highlight { border: 1px solid var(--brand-primary); background: rgba(99, 102, 241, 0.1); }
                .form-check-group.warning { border: 1px solid #f59e0b; background: rgba(245, 158, 11, 0.1); }
                .check-label { display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer; }
                .check-label input { width: 16px; height: 16px; }
                
                .modal-body { max-height: 60vh; overflow-y: auto; padding-right: 8px; }

                .primary-btn { display: flex; items-center; gap: 8px; background: var(--brand-primary); color: white; border: none; padding: 10px 16px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; }
                .secondary-btn { background: var(--bg-tertiary); color: var(--text-primary); border: none; padding: 10px 16px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; }
                .icon-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; }
                .icon-btn:hover { color: var(--text-primary); }
                .icon-btn.delete:hover { color: var(--status-rejected); }
            `}</style>
        </div>
    );
}
