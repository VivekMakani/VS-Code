import { Outlet, NavLink } from 'react-router-dom';

const navItems = [
  { to: '/rulebook', label: 'Rulebook', icon: '⚙️' },
  { to: '/import', label: 'Raw Import', icon: '📥' },
  { to: '/ledger', label: 'Ledger', icon: '📋' },
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
];

export default function RootLayout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Nav */}
      <header style={{
        background: '#fff', borderBottom: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 24, height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: '1.5rem' }}>💳</span>
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-text)' }}>ExpenseTracker</span>
          </div>
          <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: '0.9rem',
                  fontWeight: 500, textDecoration: 'none', transition: 'all 150ms',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  background: isActive ? 'var(--color-primary-light)' : 'transparent',
                })}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main style={{ flex: 1, maxWidth: 1400, margin: '0 auto', width: '100%', padding: '24px' }}>
        <Outlet />
      </main>
    </div>
  );
}
