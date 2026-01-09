import { Search, Bell, ChevronDown } from 'lucide-react';

function Header() {
    return (
        <header className="header">
            <div className="header-search">
                <Search />
                <input type="text" placeholder="Oyuncu ara (ID, isim, email)..." />
            </div>

            <div className="header-actions">
                <button className="header-icon-btn">
                    <Bell />
                    <span className="notification-dot"></span>
                </button>

                <div className="user-menu">
                    <div className="user-avatar">A</div>
                    <div className="user-info">
                        <span className="user-name">Admin</span>
                        <span className="user-role">Operatör</span>
                    </div>
                    <ChevronDown size={16} color="var(--text-muted)" />
                </div>
            </div>
        </header>
    );
}

export default Header;
