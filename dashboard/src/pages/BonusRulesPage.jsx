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
        match_keyword: '',
        max_amount: 1000,
        ignore_deposit_rule: false,
        auto_approval_enabled: false
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
            if (!formData.name || !formData.match_keyword) {
                alert('İsim ve Eşleşme Kelimesi zorunludur!');
                return;
            }

            if (editingRule) {
                await updateBonusRule(editingRule.id, formData);
            } else {
                await addBonusRule(formData);
            }

            setShowAddModal(false);
            setEditingRule(null);
            setFormData({
                name: '',
                match_keyword: '',
                max_amount: 1000,
                ignore_deposit_rule: false,
                auto_approval_enabled: false
            });
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
            match_keyword: rule.match_keyword,
            max_amount: rule.max_amount,
            ignore_deposit_rule: Boolean(rule.ignore_deposit_rule),
            auto_approval_enabled: Boolean(rule.auto_approval_enabled)
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
                    setFormData({
                        name: '',
                        match_keyword: '',
                        max_amount: 1000,
                        ignore_deposit_rule: false,
                        auto_approval_enabled: false
                    });
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
                                        <div className="rule-keyword">Anahtar: <span>{rule.match_keyword}</span></div>
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
                                        <span className="setting-value">₺{rule.max_amount}</span>
                                    </div>
                                    <div className="setting-row">
                                        <span className="setting-label"><ShieldAlert size={12} /> Yatırım Şartı:</span>
                                        <span className={`setting-value ${rule.ignore_deposit_rule ? 'success' : 'warning'}`}>
                                            {rule.ignore_deposit_rule ? 'YOKSAY' : 'ZORUNLU'}
                                        </span>
                                    </div>
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
                            <div className="form-group">
                                <label>Eşleşme Anahtar Kelimesi (Benzersiz)</label>
                                <input
                                    type="text"
                                    placeholder="Örn: DENEME500 (Oyun/Açıklama içinde aranır)"
                                    value={formData.match_keyword}
                                    onChange={e => setFormData({ ...formData, match_keyword: e.target.value })}
                                    disabled={!!editingRule} // Prevent changing key as it's unique
                                />
                                <small>Not: Bu kelime bonus açıklamasında, oyun adında veya ödeme yönteminde geçiyorsa kural devreye girer.</small>
                            </div>
                            <div className="form-group">
                                <label>Maksimum Çekim Tutarı (TL)</label>
                                <input
                                    type="number"
                                    value={formData.max_amount}
                                    onChange={e => setFormData({ ...formData, max_amount: e.target.value })}
                                />
                            </div>

                            <div className="form-check-group">
                                <label className="check-label">
                                    <input
                                        type="checkbox"
                                        checked={formData.ignore_deposit_rule}
                                        onChange={e => setFormData({ ...formData, ignore_deposit_rule: e.target.checked })}
                                    />
                                    <span>Yatırım ve Oran Şartını Yoksay (Deneme bonusları için işaretleyin)</span>
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
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--bg-tertiary); transition: .4s; border-radius: 20px; }
                .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
                input:checked + .slider { background-color: var(--brand-primary); }
                input:checked + .slider:before { transform: translateX(16px); }

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
                .check-label { display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer; }
                .check-label input { width: 16px; height: 16px; }

                .primary-btn { display: flex; items-center; gap: 8px; background: var(--brand-primary); color: white; border: none; padding: 10px 16px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; }
                .secondary-btn { background: var(--bg-tertiary); color: var(--text-primary); border: none; padding: 10px 16px; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; }
                .icon-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 4px; }
                .icon-btn:hover { color: var(--text-primary); }
                .icon-btn.delete:hover { color: var(--status-rejected); }
            `}</style>
        </div>
    );
}
