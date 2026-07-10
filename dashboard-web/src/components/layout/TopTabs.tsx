import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { key: 'overview', label: '📊 Overview Analytics', to: '/' },
  { key: 'tat', label: '⏱️ Turn Around Time', to: '/tat' },
  { key: 'load-management', label: '🚛 Load Management', to: '/load-management' },
  { key: 'loader-details', label: '👷 Loader Details', to: '/loader-details' },
]

export default function TopTabs() {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-white px-4">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.key}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${
              isActive
                ? 'border-[var(--brand)] text-[var(--brand-dark)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--brand-dark)]'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
