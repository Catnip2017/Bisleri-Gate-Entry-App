import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { useAuth } from '../../lib/auth'
import { useFilters } from '../../lib/filters'
import {
  apiFetch,
  buildQuery,
  type ApiError,
  type LoaderStats,
  type LoaderDetailRow,
  type PaginatedResult,
  type LoadersPerWarehouseRow,
  type OwnershipTrendPoint,
} from '../../lib/api'
import { KpiCard, ChartCard, ErrorNotice, Pagination, downloadCsv } from '../../components/ui/DashboardUI'

export default function LoaderDetailsPage() {
  const { token } = useAuth()
  const { selectedWarehouses, dateRange } = useFilters()

  const [sites, setSites] = useState<string[]>([])
  const [movementType, setMovementType] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [gateEntryNo, setGateEntryNo] = useState('')
  const [docTypes, setDocTypes] = useState<string[]>([])
  const [page, setPage] = useState(1)

  const mutuallyExclusiveConflict = sites.length > 0 && selectedWarehouses.length > 0

  const extra = {
    sites,
    movement_type: movementType || null,
    vehicle_type: vehicleType || null,
    document_types: docTypes,
  }
  const filterKey = [sites, selectedWarehouses, dateRange, movementType, vehicleType, docTypes]

  const siteOptions = useQuery<string[], ApiError>({
    queryKey: ['loader', 'sites'],
    queryFn: () => apiFetch('/loader/filters/sites', token),
    enabled: !!token,
  })

  const docTypeOptions = useQuery<string[], ApiError>({
    queryKey: ['loader', 'document-types'],
    queryFn: () => apiFetch('/loader/filters/document-types', token),
    enabled: !!token,
  })

  const stats = useQuery<LoaderStats, ApiError>({
    queryKey: ['loader', 'stats', filterKey],
    queryFn: () => apiFetch(buildQuery('/loader/stats', { warehouses: selectedWarehouses, dateRange, extra }), token),
    enabled: !!token && !mutuallyExclusiveConflict,
  })

  const list = useQuery<PaginatedResult<LoaderDetailRow>, ApiError>({
    queryKey: ['loader', 'details', filterKey, gateEntryNo, page],
    queryFn: () =>
      apiFetch(
        buildQuery('/loader/details', {
          warehouses: selectedWarehouses,
          dateRange,
          extra: { ...extra, gate_entry_no: gateEntryNo || null, page },
        }),
        token,
      ),
    enabled: !!token && !mutuallyExclusiveConflict,
  })

  const loadersPerWarehouse = useQuery<LoadersPerWarehouseRow[], ApiError>({
    queryKey: ['loader', 'loaders-per-warehouse', filterKey],
    queryFn: () =>
      apiFetch(buildQuery('/loader/loaders-per-warehouse', { warehouses: selectedWarehouses, dateRange, extra }), token),
    enabled: !!token && !mutuallyExclusiveConflict,
  })

  const ownershipTrend = useQuery<OwnershipTrendPoint[], ApiError>({
    queryKey: ['loader', 'ownership-trend', filterKey],
    queryFn: () =>
      apiFetch(buildQuery('/loader/ownership-trend', { warehouses: selectedWarehouses, dateRange, extra }), token),
    enabled: !!token && !mutuallyExclusiveConflict,
  })

  const totalPages = list.data ? Math.ceil(list.data.total_count / 50) : 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 p-4 text-white">
        <h2 className="text-lg font-bold">👷 Loader Details</h2>
        <p className="text-sm opacity-90">Loader information per gate entry</p>
      </div>

      <ChartCard title="🔍 Filters">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">
              Site(s) <span title="Mutually exclusive with the global Warehouse filter">ⓘ</span>
            </label>
            <select
              multiple
              value={sites}
              onChange={(e) => {
                setSites(Array.from(e.target.selectedOptions, (o) => o.value))
                setPage(1)
              }}
              className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
              size={1}
            >
              {(siteOptions.data ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Movement Type</label>
            <select
              value={movementType}
              onChange={(e) => {
                setMovementType(e.target.value)
                setPage(1)
              }}
              className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="Gate-In">Gate-In</option>
              <option value="Gate-Out">Gate-Out</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Vehicle Type</label>
            <select
              value={vehicleType}
              onChange={(e) => {
                setVehicleType(e.target.value)
                setPage(1)
              }}
              className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="Company Owned">Company Owned</option>
              <option value="Hired">Hired</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Gate Entry No</label>
            <input
              value={gateEntryNo}
              onChange={(e) => {
                setGateEntryNo(e.target.value.toUpperCase())
                setPage(1)
              }}
              placeholder="e.g., GE001"
              className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Document Type(s)</label>
            <select
              multiple
              value={docTypes}
              onChange={(e) => {
                setDocTypes(Array.from(e.target.selectedOptions, (o) => o.value))
                setPage(1)
              }}
              className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
              size={1}
            >
              {(docTypeOptions.data ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </ChartCard>

      {mutuallyExclusiveConflict ? (
        <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
          ⚠️ Site and Warehouse filters are mutually exclusive. Please clear one to use the other (Warehouse is set in
          the global filter bar above).
        </p>
      ) : (
        <>
          {(stats.error || list.error) && <ErrorNotice error={(stats.error ?? list.error)!} />}
          {stats.data && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <KpiCard label="Total Entries" value={stats.data.total_entries.toLocaleString()} />
              <KpiCard label="Unique Vehicles" value={stats.data.unique_vehicles.toLocaleString()} />
              <KpiCard label="Total Loaders" value={(stats.data.total_loaders ?? 0).toLocaleString()} />
              <KpiCard label="Avg Loaders/Entry" value={(stats.data.avg_loaders_per_entry ?? 0).toFixed(1)} />
              <KpiCard label="Company Owned" value={stats.data.company_owned_count.toLocaleString()} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ChartCard title="👷 Avg Loaders per Entry by Warehouse">
              {loadersPerWarehouse.error ? (
                <ErrorNotice error={loadersPerWarehouse.error} />
              ) : (
                <ReactECharts
                  style={{ height: 380 }}
                  option={{
                    tooltip: {},
                    grid: { left: 160, right: 20, top: 10, bottom: 20 },
                    xAxis: { type: 'value' },
                    yAxis: { type: 'category', data: (loadersPerWarehouse.data ?? []).map((r) => r.warehouse_name) },
                    series: [
                      {
                        type: 'bar',
                        data: (loadersPerWarehouse.data ?? []).map((r) => r.avg_loaders.toFixed(2)),
                        itemStyle: { color: '#8b5cf6' },
                      },
                    ],
                  }}
                />
              )}
            </ChartCard>

            <ChartCard title="🚛 Company-Owned vs Hired Over Time">
              {ownershipTrend.error ? (
                <ErrorNotice error={ownershipTrend.error} />
              ) : (
                <ReactECharts
                  style={{ height: 380 }}
                  option={{
                    tooltip: { trigger: 'axis' },
                    legend: { data: ['Company Owned', 'Hired'] },
                    xAxis: { type: 'category', data: (ownershipTrend.data ?? []).map((t) => t.entry_date) },
                    yAxis: { type: 'value' },
                    series: [
                      {
                        name: 'Company Owned',
                        type: 'line',
                        stack: 'total',
                        areaStyle: {},
                        smooth: true,
                        data: (ownershipTrend.data ?? []).map((t) => t.company_owned_count),
                        itemStyle: { color: '#2e7d32' },
                      },
                      {
                        name: 'Hired',
                        type: 'line',
                        stack: 'total',
                        areaStyle: {},
                        smooth: true,
                        data: (ownershipTrend.data ?? []).map((t) => t.hired_count),
                        itemStyle: { color: '#1f77b4' },
                      },
                    ],
                  }}
                />
              )}
            </ChartCard>
          </div>

          <ChartCard title="📋 Records">
            {list.error ? (
              <ErrorNotice error={list.error} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[var(--muted)]">
                        <th className="py-1 pr-2">Gate Entry DateTime</th>
                        <th className="py-1 pr-2">Gate Entry No</th>
                        <th className="py-1 pr-2">Vehicle No</th>
                        <th className="py-1 pr-2">Vehicle Type</th>
                        <th className="py-1 pr-2">Security</th>
                        <th className="py-1 pr-2">Driver</th>
                        <th className="py-1 pr-2">Loader Names</th>
                        <th className="py-1 pr-2">Loader Count</th>
                        <th className="py-1 pr-2">Document Types</th>
                        <th className="py-1 pr-2">Movement</th>
                        <th className="py-1 pr-2">Warehouse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(list.data?.data ?? []).map((r) => (
                        <tr key={r.gate_entry_no} className="border-t border-[var(--border)]">
                          <td className="py-1 pr-2">{r.gate_entry_datetime}</td>
                          <td className="py-1 pr-2">{r.gate_entry_no}</td>
                          <td className="py-1 pr-2">{r.vehicle_no}</td>
                          <td className="py-1 pr-2">{r.vehicle_type}</td>
                          <td className="py-1 pr-2">{r.security_name}</td>
                          <td className="py-1 pr-2">{r.driver_name}</td>
                          <td className="py-1 pr-2">{r.loader_names}</td>
                          <td className="py-1 pr-2">{r.loader_count}</td>
                          <td className="py-1 pr-2">{r.document_types}</td>
                          <td className="py-1 pr-2">{r.movement_type}</td>
                          <td className="py-1 pr-2">{r.warehouse_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination page={page} totalPages={totalPages} onChange={setPage} />

                <button
                  onClick={() => downloadCsv('loader_details.csv', list.data?.data ?? [])}
                  className="mt-2 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  📥 Download as CSV
                </button>
              </>
            )}
          </ChartCard>
        </>
      )}
    </div>
  )
}
