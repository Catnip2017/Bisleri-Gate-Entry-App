import { Routes, Route } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import OverviewPage from './features/overview/OverviewPage'
import TatPage from './features/tat/TatPage'
import LoadManagementPage from './features/load-management/LoadManagementPage'
import LoaderDetailsPage from './features/loader-details/LoaderDetailsPage'
import { useAuth } from './lib/auth'

function NotAuthorized() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--brand-tint-2)] p-6 text-center">
      <div>
        <h1 className="text-xl font-bold text-[var(--brand-dark)]">Not authorized</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Open this dashboard from the Dashboards tile in the gate-entry app.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const { token } = useAuth()

  if (!token) {
    return <NotAuthorized />
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/tat" element={<TatPage />} />
        <Route path="/load-management" element={<LoadManagementPage />} />
        <Route path="/loader-details" element={<LoaderDetailsPage />} />
      </Routes>
    </AppShell>
  )
}
