import React, { useState } from 'react';
import { Shield, Save, AlertTriangle } from 'lucide-react';

function RuleEnginePage() {
    const [rules, setRules] = useState({
        autoRejectEnabled: true,
        maxDailyWithdrawalLimit: 50000,
        minTurnoverMatch: 100,
        sportBonusRules: true
    });

    const handleToggle = (key) => {
        setRules(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = () => {
        // Implement save logic via API
        alert('Kurallar kaydedildi (Simulation)');
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Shield className="text-purple-500" />
                    Kural Motoru Yapılandırması
                </h1>
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <Save size={18} />
                    Kaydet
                </button>
            </div>

            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* General Rules */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2">Genel Kurallar</h3>

                        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                            <div>
                                <div className="font-medium text-white">Otomatik Reddetme</div>
                                <div className="text-sm text-slate-400">Kurallara uymayanları otomatik reddet</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={rules.autoRejectEnabled}
                                    onChange={() => handleToggle('autoRejectEnabled')}
                                />
                                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                            <div>
                                <div className="font-medium text-white">Spor Bonusu Kontrolü</div>
                                <div className="text-sm text-slate-400">Yatırım öncesi spor kazançlarını kontrol et</div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={rules.sportBonusRules}
                                    onChange={() => handleToggle('sportBonusRules')}
                                />
                                <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* Limits */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-300 border-b border-slate-700 pb-2">Limitler</h3>

                        <div className="p-3 bg-slate-700/50 rounded-lg">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Minimum Çevrim Oranı (%)
                            </label>
                            <input
                                type="number"
                                value={rules.minTurnoverMatch}
                                onChange={(e) => setRules({ ...rules, minTurnoverMatch: parseInt(e.target.value) })}
                                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        <div className="p-4 bg-orange-900/20 border border-orange-700/50 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="text-orange-500 shrink-0" />
                            <div className="text-sm text-orange-200">
                                Bu ayarlar şu anda sadece simülasyon amaçlıdır. Sistemi etkilemez. Kurallar şu an için kod içinde sabittir.
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default RuleEnginePage;
