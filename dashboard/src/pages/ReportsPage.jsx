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
    Loader2
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

            // Format for API (client-side formatting or just pass ISO)
            // reportsService expects formatted strings usually for BC, 
            // but let's pass formatting string: DD-MM-YY - HH:mm:ss
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
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-purple-500" size={48} />
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <BarChart3 className="text-purple-500" />
                    Raporlar ve Analizler
                </h1>

                <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                    <button
                        onClick={() => setDateRange('today')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${dateRange === 'today' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Bugün
                    </button>
                    <button
                        onClick={() => setDateRange('yesterday')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${dateRange === 'yesterday' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Dün
                    </button>
                    <button
                        onClick={() => setDateRange('week')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${dateRange === 'week' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                        Son 7 Gün
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <KPICard title="Toplam Talep" value={stats?.total || 0} icon={TrendingUp} color="blue" />
                <KPICard title="Ödenen" value={stats?.paid || 0} icon={CheckCircle} color="green" />
                <KPICard title="Reddedilen" value={stats?.rejected || 0} icon={XCircle} color="red" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <KPICard title="Bot Onayı" value={stats?.botApproved || 0} icon={ShieldAlert} color="green" subtitle="Bot tarafından onaylanan" />
                <KPICard title="Bot Reddi" value={stats?.botRejected || 0} icon={ShieldAlert} color="red" subtitle="Bot tarafından reddedilen" />
                <KPICard title="Bot Manuel" value={stats?.botManual || 0} icon={AlertTriangle} color="yellow" subtitle="Bot manuele düşürdü" />
            </div>

            {/* Conflicts Analysis */}
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="text-orange-500" />
                Bot vs İnsan Karar Çatışmaları
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Critical Conflict: Paid but Bot Rejected */}
                <ConflictTable
                    title="KRİTİK: Panel Ödemiş vs Bot Reddetmiş"
                    items={stats?.conflicts?.paidButBotRejected || []}
                    type="critical"
                    description="Botun risk görüp RED verdiği ancak panelde ÖDENEN işlemler."
                />

                {/* Warning Conflict: Rejected but Bot Approved */}
                <ConflictTable
                    title="UYARI: Panel Reddetmiş vs Bot Onaylamış"
                    items={stats?.conflicts?.rejectedButBotApproved || []}
                    type="warning"
                    description="Botun temiz bulduğu ancak panelde REDDEDİLEN işlemler."
                />

            </div>
        </div>
    );
}

function KPICard({ title, value, icon: Icon, color, subtitle }) {
    const colors = {
        blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        green: 'bg-green-500/10 text-green-500 border-green-500/20',
        red: 'bg-red-500/10 text-red-500 border-red-500/20',
        yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
    };

    return (
        <div className={`p-5 rounded-xl border ${colors[color]} backdrop-blur-sm`}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="text-sm font-medium opacity-80 mb-1">{title}</div>
                    <div className="text-2xl font-bold">{value}</div>
                    {subtitle && <div className="text-xs opacity-60 mt-1">{subtitle}</div>}
                </div>
                <div className={`p-2 rounded-lg bg-opacity-20 ${colors[color].split(' ')[0]}`}>
                    <Icon size={24} />
                </div>
            </div>
        </div>
    );
}

function ConflictTable({ title, items, type, description }) {
    const isCritical = type === 'critical';

    return (
        <div className={`rounded-xl border overflow-hidden ${isCritical ? 'border-red-500/30 bg-red-900/10' : 'border-yellow-500/30 bg-yellow-900/10'}`}>
            <div className={`px-4 py-3 border-b flex justify-between items-center ${isCritical ? 'border-red-500/30 bg-red-500/10' : 'border-yellow-500/30 bg-yellow-500/10'}`}>
                <div>
                    <h3 className={`font-bold ${isCritical ? 'text-red-400' : 'text-yellow-400'}`}>{title}</h3>
                    <div className="text-xs opacity-70 text-slate-300">{description}</div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold ${isCritical ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'}`}>
                    {items.length} Adet
                </div>
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-black/20 text-slate-400">
                        <tr>
                            <th className="px-4 py-3">ID / Oyuncu</th>
                            <th className="px-4 py-3">Miktar</th>
                            <th className="px-4 py-3 text-right">Bot Kararı</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="px-4 py-8 text-center text-slate-500 italic">
                                    Çatışma bulunamadı. Sistem uyumlu çalışıyor.
                                </td>
                            </tr>
                        ) : (
                            items.map((item, idx) => (
                                <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-white">{item.withdrawal.Id}</div>
                                        <div className="text-xs text-slate-400">{item.withdrawal.ClientId}</div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-white">
                                        {item.withdrawal.Amount} ₺
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="font-bold">
                                            {item.decision.decision}
                                        </div>
                                        <div className="text-xs opacity-60 truncate max-w-[150px]" title={item.decision.decision_reason}>
                                            {item.decision.decision_reason}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ReportsPage;
