import { useState, useEffect } from 'react';
import { Settings, ChevronDown, ChevronUp, Check, X, Plus, Edit, Trash2, Save, XCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const CATEGORIES = {
    'GENERAL': { name: 'Genel Kurallar', icon: '🔍', color: '#3b82f6', desc: 'Tüm çekimler için geçerli' },
    'NORMAL': { name: 'Normal Çekim Kuralları', icon: '💵', color: '#22c55e', desc: 'Yatırım bazlı çekimler' },
    'BONUS': { name: 'Bonus Kuralları', icon: '🎁', color: '#a855f7', desc: 'Bonus çekimleri (BonusRules sayfasından yönetilir)' },
    'CASHBACK': { name: 'Cashback Kuralları', icon: '💰', color: '#f59e0b', desc: 'Cashback çekimleri' },
    'FREESPIN': { name: 'FreeSpin Kuralları', icon: '🎰', color: '#ec4899', desc: 'FreeSpin çekimleri' }
};

export default function RulesPage() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedCategories, setExpandedCategories] = useState(['GENERAL', 'NORMAL']);
    const [editingRule, setEditingRule] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadRules();
    }, []);

    const loadRules = async () => {
        try {
            const res = await fetch(`${API_BASE}/rules`);
            const data = await res.json();
            if (data.success) setRules(data.rules);
        } catch (e) {
            console.error('Failed to load rules:', e);
        }
        setLoading(false);
    };

    const toggleCategory = (category) => {
        setExpandedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        );
    };

    const toggleRule = async (ruleId) => {
        try {
            const res = await fetch(`${API_BASE}/rules/${ruleId}/toggle`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setRules(prev => prev.map(r => r.id === ruleId ? data.rule : r));
            }
        } catch (e) {
            console.error('Toggle failed:', e);
        }
    };

    const saveRule = async () => {
        if (!editingRule) return;
        setSaving(true);

        try {
            const isNew = !editingRule.id;
            const url = isNew ? `${API_BASE}/rules` : `${API_BASE}/rules/${editingRule.id}`;
            const method = isNew ? 'POST' : 'PUT';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingRule)
            });

            const data = await res.json();
            if (data.success) {
                if (isNew) {
                    setRules(prev => [...prev, data.rule]);
                } else {
                    setRules(prev => prev.map(r => r.id === data.rule.id ? data.rule : r));
                }
                setEditingRule(null);
            }
        } catch (e) {
            console.error('Save failed:', e);
        }
        setSaving(false);
    };

    const deleteRule = async (ruleId) => {
        if (!confirm('Bu kuralı silmek istediğinize emin misiniz?')) return;

        try {
            const res = await fetch(`${API_BASE}/rules/${ruleId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setRules(prev => prev.filter(r => r.id !== ruleId));
            }
        } catch (e) {
            console.error('Delete failed:', e);
        }
    };

    const groupedRules = Object.keys(CATEGORIES).reduce((acc, cat) => {
        acc[cat] = rules.filter(r => r.category === cat);
        return acc;
    }, {});

    if (loading) return <div className="loading-page"><div className="spinner"></div></div>;

    return (
        <div className="rules-page">
            <div className="page-header">
                <div className="header-left">
                    <Settings size={24} />
                    <h1>Kural Yönetimi</h1>
                </div>
                <button className="add-btn" onClick={() => setEditingRule({ category: 'GENERAL', config: {}, is_enabled: true })}>
                    <Plus size={16} /> Yeni Kural
                </button>
            </div>

            <div className="rules-container">
                {Object.entries(CATEGORIES).map(([category, meta]) => (
                    <div key={category} className="category-section">
                        <div
                            className="category-header"
                            onClick={() => toggleCategory(category)}
                            style={{ borderLeftColor: meta.color }}
                        >
                            <span className="category-icon">{meta.icon}</span>
                            <div className="category-info">
                                <span className="category-name">{meta.name}</span>
                                <span className="category-desc">{meta.desc}</span>
                            </div>
                            <span className="category-count">{groupedRules[category].length}</span>
                            {expandedCategories.includes(category)
                                ? <ChevronUp size={20} />
                                : <ChevronDown size={20} />
                            }
                        </div>

                        {expandedCategories.includes(category) && (
                            <div className="rules-list">
                                {category === 'BONUS' ? (
                                    <div className="bonus-redirect">
                                        <p>Bonus kuralları ayrı sayfadan yönetilir:</p>
                                        <a href="/bonus-rules" className="redirect-link">Bonus Kuralları Sayfasına Git →</a>
                                    </div>
                                ) : groupedRules[category].length === 0 ? (
                                    <div className="empty">Bu kategoride kural yok</div>
                                ) : (
                                    groupedRules[category].map(rule => (
                                        <div key={rule.id} className={`rule-card ${rule.is_enabled ? 'enabled' : 'disabled'}`}>
                                            <div className="rule-info">
                                                <div className="rule-header">
                                                    <span className="rule-key">{rule.rule_key}</span>
                                                    {rule.is_critical && <span className="critical-badge">Kritik</span>}
                                                </div>
                                                <div className="rule-name">{rule.rule_name}</div>
                                                <div className="rule-config">
                                                    {Object.entries(rule.config || {}).map(([k, v]) => (
                                                        <span key={k} className="config-item">
                                                            {k}: <strong>{JSON.stringify(v)}</strong>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="rule-actions">
                                                <button
                                                    className={`toggle-btn ${rule.is_enabled ? 'active' : ''}`}
                                                    onClick={() => toggleRule(rule.id)}
                                                    title={rule.is_enabled ? 'Kapat' : 'Aç'}
                                                >
                                                    {rule.is_enabled ? <Check size={16} /> : <X size={16} />}
                                                </button>
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => setEditingRule(rule)}
                                                    title="Düzenle"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => deleteRule(rule.id)}
                                                    title="Sil"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {editingRule && (
                <div className="modal-overlay" onClick={() => setEditingRule(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingRule.id ? 'Kural Düzenle' : 'Yeni Kural'}</h2>
                            <button className="close-btn" onClick={() => setEditingRule(null)}>
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Kural Key (benzersiz)</label>
                                <input
                                    type="text"
                                    value={editingRule.rule_key || ''}
                                    onChange={e => setEditingRule({ ...editingRule, rule_key: e.target.value.toUpperCase() })}
                                    placeholder="MAX_AMOUNT"
                                    disabled={!!editingRule.id}
                                />
                            </div>
                            <div className="form-group">
                                <label>Kural Adı</label>
                                <input
                                    type="text"
                                    value={editingRule.rule_name || ''}
                                    onChange={e => setEditingRule({ ...editingRule, rule_name: e.target.value })}
                                    placeholder="Maksimum Çekim Limiti"
                                />
                            </div>
                            <div className="form-group">
                                <label>Açıklama</label>
                                <textarea
                                    value={editingRule.rule_description || ''}
                                    onChange={e => setEditingRule({ ...editingRule, rule_description: e.target.value })}
                                    placeholder="Kural açıklaması..."
                                />
                            </div>
                            <div className="form-group">
                                <label>Kategori</label>
                                <select
                                    value={editingRule.category || 'GENERAL'}
                                    onChange={e => setEditingRule({ ...editingRule, category: e.target.value })}
                                >
                                    {Object.entries(CATEGORIES).filter(([k]) => k !== 'BONUS').map(([k, v]) => (
                                        <option key={k} value={k}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Konfigürasyon (JSON)</label>
                                <textarea
                                    value={JSON.stringify(editingRule.config || {}, null, 2)}
                                    onChange={e => {
                                        try {
                                            setEditingRule({ ...editingRule, config: JSON.parse(e.target.value) });
                                        } catch { }
                                    }}
                                    placeholder='{"max_value": 5000}'
                                    className="json-input"
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Öncelik</label>
                                    <input
                                        type="number"
                                        value={editingRule.priority || 100}
                                        onChange={e => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group checkbox-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={editingRule.is_enabled}
                                            onChange={e => setEditingRule({ ...editingRule, is_enabled: e.target.checked })}
                                        />
                                        Aktif
                                    </label>
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={editingRule.is_critical}
                                            onChange={e => setEditingRule({ ...editingRule, is_critical: e.target.checked })}
                                        />
                                        Kritik (fail = RET)
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setEditingRule(null)}>İptal</button>
                            <button className="save-btn" onClick={saveRule} disabled={saving}>
                                <Save size={16} /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .rules-page {
                    padding: 24px;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .header-left h1 {
                    margin: 0;
                    font-size: 24px;
                    color: var(--text-primary, #fff);
                }

                .add-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 16px;
                    background: var(--accent-primary, #3b82f6);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }

                .rules-container {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .category-section {
                    background: var(--bg-secondary, #1e293b);
                    border-radius: 12px;
                    overflow: hidden;
                }

                .category-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 16px 20px;
                    cursor: pointer;
                    border-left: 4px solid;
                    transition: background 0.2s;
                }

                .category-header:hover {
                    background: rgba(255,255,255,0.05);
                }

                .category-icon {
                    font-size: 24px;
                }

                .category-info {
                    flex: 1;
                }

                .category-name {
                    font-weight: 600;
                    color: var(--text-primary, #fff);
                    display: block;
                }

                .category-desc {
                    font-size: 12px;
                    color: var(--text-secondary, #94a3b8);
                }

                .category-count {
                    background: rgba(255,255,255,0.1);
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                }

                .rules-list {
                    padding: 0 20px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .rule-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    background: var(--bg-tertiary, #0f172a);
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .rule-card.disabled {
                    opacity: 0.5;
                }

                .rule-info {
                    flex: 1;
                }

                .rule-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                }

                .rule-key {
                    font-family: monospace;
                    font-size: 12px;
                    color: var(--accent-primary, #3b82f6);
                    background: rgba(59, 130, 246, 0.1);
                    padding: 2px 8px;
                    border-radius: 4px;
                }

                .critical-badge {
                    font-size: 10px;
                    background: #ef4444;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 600;
                }

                .rule-name {
                    font-weight: 500;
                    color: var(--text-primary, #fff);
                    margin-bottom: 4px;
                }

                .rule-config {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .config-item {
                    font-size: 12px;
                    color: var(--text-secondary, #94a3b8);
                }

                .rule-actions {
                    display: flex;
                    gap: 8px;
                }

                .rule-actions button {
                    padding: 8px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .toggle-btn {
                    background: rgba(255,255,255,0.1);
                    color: var(--text-secondary, #94a3b8);
                }

                .toggle-btn.active {
                    background: #22c55e;
                    color: white;
                }

                .edit-btn {
                    background: rgba(59, 130, 246, 0.2);
                    color: #3b82f6;
                }

                .delete-btn {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .empty, .bonus-redirect {
                    text-align: center;
                    padding: 24px;
                    color: var(--text-secondary, #94a3b8);
                }

                .redirect-link {
                    color: var(--accent-primary, #3b82f6);
                    text-decoration: none;
                    font-weight: 600;
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .modal-content {
                    background: var(--bg-secondary, #1e293b);
                    border-radius: 16px;
                    width: 90%;
                    max-width: 500px;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }

                .modal-header h2 {
                    margin: 0;
                    font-size: 18px;
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary, #94a3b8);
                    cursor: pointer;
                }

                .modal-body {
                    padding: 20px;
                }

                .form-group {
                    margin-bottom: 16px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--text-secondary, #94a3b8);
                }

                .form-group input,
                .form-group textarea,
                .form-group select {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px;
                    background: var(--bg-tertiary, #0f172a);
                    color: var(--text-primary, #fff);
                    font-size: 14px;
                }

                .form-group textarea {
                    min-height: 80px;
                    resize: vertical;
                }

                .json-input {
                    font-family: monospace;
                    min-height: 100px;
                }

                .form-row {
                    display: flex;
                    gap: 16px;
                }

                .form-row .form-group {
                    flex: 1;
                }

                .checkbox-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .checkbox-group label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                }

                .checkbox-group input[type="checkbox"] {
                    width: auto;
                }

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 20px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                }

                .cancel-btn {
                    padding: 10px 20px;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    background: transparent;
                    color: var(--text-secondary, #94a3b8);
                    cursor: pointer;
                }

                .save-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 8px;
                    background: var(--accent-primary, #3b82f6);
                    color: white;
                    cursor: pointer;
                    font-weight: 600;
                }

                .save-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .loading-page {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(255,255,255,0.1);
                    border-top-color: var(--accent-primary, #3b82f6);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
