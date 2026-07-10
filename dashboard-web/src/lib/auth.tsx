import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

// Reads the JWT forwarded from gate-entry-app once, on load — either from
// ?token=... (query string) or a #token=... fragment, then strips it from
// the visible URL. No dashboard-side login: the token comes from the tile
// click, and every /dashboard-api/* call sends it as a Bearer token so the
// backend enforces itadmin-only access (see app/routers/dashboard.py).

interface AuthState {
  token: string | null
}

const AuthContext = createContext<AuthState>({ token: null })

function readTokenFromUrl(): string | null {
  const url = new URL(window.location.href)
  const fromQuery = url.searchParams.get('token')
  if (fromQuery) return fromQuery

  if (window.location.hash.startsWith('#token=')) {
    return decodeURIComponent(window.location.hash.slice('#token='.length))
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token] = useState<string | null>(() => {
    const found = readTokenFromUrl()
    if (found) {
      // Strip the token from the address bar so it isn't left in history/logs.
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      window.history.replaceState({}, '', url.pathname + url.search)
    }
    return found
  })

  const value = useMemo(() => ({ token }), [token])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
