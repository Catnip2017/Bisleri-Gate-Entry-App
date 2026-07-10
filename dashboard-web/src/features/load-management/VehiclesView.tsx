import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { apiFetch, type ApiError, type VehicleStats } from '../../lib/api'
import { KpiCard, ChartCard, ErrorNotice } from '../../components/ui/DashboardUI'
import TripTable from './TripTable'

export default function VehiclesView() {
  const { token } = useAuth()
  const [input, setInput] = useState('')
  const [searchedVehicle, setSearchedVehicle] = useState('')

  const vehicleStats = useQuery<VehicleStats, ApiError>({
    queryKey: ['load', 'vehicle', 'stats', searchedVehicle],
    queryFn: () => apiFetch(`/load/vehicle/stats?vehicle_no=${encodeURIComponent(searchedVehicle)}`, token),
    enabled: !!token && !!searchedVehicle,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-[var(--brand-dark)]">🚗 Vehicle Load Management</h2>

      <ChartCard title="🔍 Search">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="e.g., MH12AB1234"
            className="max-w-xs flex-1 rounded border border-[var(--border)] px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => setSearchedVehicle(input.trim())}
            className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Search
          </button>
          <button
            onClick={() => {
              setInput('')
              setSearchedVehicle('')
            }}
            className="rounded-lg bg-[var(--brand-tint-2)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]"
          >
            Clear
          </button>
        </div>
      </ChartCard>

      {searchedVehicle && vehicleStats.error && <ErrorNotice error={vehicleStats.error} />}

      {searchedVehicle && vehicleStats.data && vehicleStats.data.total_trips > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="Total Trips" value={vehicleStats.data.total_trips.toLocaleString()} />
          <KpiCard label="Avg Load %" value={`${vehicleStats.data.avg_load.toFixed(1)}%`} />
          <KpiCard label="Max Load %" value={`${vehicleStats.data.max_load.toFixed(1)}%`} />
          <KpiCard label="Capacity" value={`${vehicleStats.data.vehicle_capacity.toFixed(0)} kg`} />
          <KpiCard label="Overloaded" value={vehicleStats.data.overloaded_count.toLocaleString()} />
        </div>
      )}

      {searchedVehicle && vehicleStats.data && vehicleStats.data.total_trips === 0 && (
        <p className="text-sm text-orange-600">No trips found for vehicle: {searchedVehicle}</p>
      )}

      <TripTable vehicleNo={searchedVehicle || undefined} pageContext="vehicle" />
    </div>
  )
}
