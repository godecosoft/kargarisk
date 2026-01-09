
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
                // Map API rules to state
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
            // Save individually for now, or batch if API supported batch
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
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-purple-500" size={48} />
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Shield className="text-purple-500" />
                    Kural Motoru Yapılandırması
                </h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Kaydet
                </button>
            </div>

            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* General Rules (Simulation for others) */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2">Genel Kurallar</h3>

                        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg opacity-50 cursor-not-allowed" title="Yakında">
                            <div>
                                <div className="font-medium text-white">Otomatik Reddetme</div>
                                <div className="text-sm text-slate-400">Kurallara uymayanları otomatik reddet</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer pointer-events-none">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={rules.autoRejectEnabled}
                                    readOnly
                                />
                                <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* Limits */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2">Limitler</h3>

                        <div className="p-3 bg-slate-700/50 rounded-lg">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Çevrim Çarpanı (x)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={rules.turnoverMultiplier}
                                onChange={(e) => setRules({ ...rules, turnoverMultiplier: parseFloat(e.target.value) })}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                            />
                            <div className="text-xs text-slate-500 mt-1">
                                Yatırımın kaç katı çevrim yapılması gerektiğini belirler. (Örn: 1.0 = %100)
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default RuleEnginePage;
