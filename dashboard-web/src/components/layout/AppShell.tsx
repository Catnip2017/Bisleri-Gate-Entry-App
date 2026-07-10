import type { ReactNode } from 'react'
import TopTabs from './TopTabs'
import FilterBar from './FilterBar'

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--brand-tint-2)]">
      <header className="flex items-center gap-3 border-b border-[var(--border)] bg-white px-4 py-3">
        <span className="text-lg font-bold text-[var(--brand-dark)]">
          🚛 Vehicle/Load Dashboard
        </span>
      </header>

      <TopTabs />

      <FilterBar />

      <main className="p-4">{children}</main>
    </div>
  )
}
