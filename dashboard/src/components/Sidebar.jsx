import {
    LayoutDashboard,
    ArrowDownToLine,
    Users,
    Settings,
    FileText,
    BarChart3,
    Shield,
    Bell,
    HelpCircle,
    Zap
} from 'lucide-react';

function Sidebar({ currentPage, onNavigate }) {
    const navItems = [
        {
            section: 'Ana Menü',
            items: [
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'withdrawals', icon: ArrowDownToLine, label: 'Çekim Talepleri' },
                { id: 'autocontrol', icon: Zap, label: 'Otomatik Kontrol' },
                { id: 'players', icon: Users, label: 'Oyuncular' },
                { id: 'reports', icon: BarChart3, label: 'Raporlar' },
            ]
        },
        {
            section: 'Yönetim',
            items: [
                { id: 'rules', icon: Shield, label: 'Kural Motoru' },
                { id: 'logs', icon: FileText, label: 'İşlem Logları' },
                { id: 'settings', icon: Settings, label: 'Ayarlar' },
            ]
        }
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">K</div>
                    <span className="sidebar-logo-text">Karga SuperApp</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((section) => (
                    <div key={section.section} className="nav-section">
                        <div className="nav-section-title">{section.section}</div>
                        {section.items.map((item) => (
                            <div
                                key={item.id}
                                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                                onClick={() => onNavigate(item.id)}
                            >
                                <item.icon />
                                <span>{item.label}</span>
                                {item.badge && <span className="nav-badge">{item.badge}</span>}
                            </div>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="sidebar-nav" style={{ paddingTop: 0 }}>
                <div className="nav-item">
                    <HelpCircle />
                    <span>Yardım</span>
                </div>
            </div>
        </aside>
    );
}

export default Sidebar;
