import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth'
import { FilterProvider } from './lib/filters'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FilterProvider>
          <BrowserRouter basename="/dashboard">
            <App />
          </BrowserRouter>
        </FilterProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
