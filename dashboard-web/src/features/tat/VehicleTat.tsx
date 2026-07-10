import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { useAuth } from '../../lib/auth'
import { useFilters } from '../../lib/filters'
import {
  apiFetch,
  buildQuery,
  type ApiError,
  type VehicleTatRow,
  type PaginatedResult,
  type TatAverage,
  type TatBoxplotRow,
  type TatTrendPoint,
} from '../../lib/api'
import { KpiCard, ChartCard, ErrorNotice, Pagination, downloadCsv, boxplotAxisMax } from '../../components/ui/DashboardUI'

export default function VehicleTat() {
  const { token } = useAuth()
  const { selectedWarehouses, dateRange } = useFilters()

  const [vehicleNo, setVehicleNo] = useState('')
  const [page, setPage] = useState(1)

  const extra = { vehicle_no: vehicleNo || null }
  const filterKey = [selectedWarehouses, dateRange, vehicleNo]

  const list = useQuery<PaginatedResult<VehicleTatRow>, ApiError>({
    queryKey: ['tat', 'vehicle', 'list', filterKey, page],
    queryFn: () =>
      apiFetch(
        buildQuery('/tat/vehicle', { warehouses: selectedWarehouses, dateRange, extra: { ...extra, page } }),
        token,
      ),
    enabled: !!token,
  })

  const average = useQuery<TatAverage, ApiError>({
    queryKey: ['tat', 'vehicle', 'average', filterKey],
    queryFn: () =>
      apiFetch(buildQuery('/tat/vehicle/average', { warehouses: selectedWarehouses, dateRange, extra }), token),
    enabled: !!token,
  })

  const boxplot = useQuery<TatBoxplotRow[], ApiError>({
    queryKey: ['tat', 'vehicle', 'boxplot', filterKey],
    queryFn: () =>
      apiFetch(buildQuery('/tat/vehicle/boxplot', { warehouses: selectedWarehouses, dateRange, extra }), token),
    enabled: !!token,
  })

  const trend = useQuery<TatTrendPoint[], ApiError>({
    queryKey: ['tat', 'vehicle', 'trend', filterKey],
    queryFn: () =>
      apiFetch(buildQuery('/tat/vehicle/trend', { warehouses: selectedWarehouses, dateRange, extra }), token),
    enabled: !!token,
  })

  const totalPages = list.data ? Math.ceil(list.data.total_count / 50) : 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 p-4 text-white">
        <h2 className="text-lg font-bold">🚛 Vehicle Turn Around Time</h2>
        <p className="text-sm opacity-90">Time spent by vehicle inside the warehouse (Gate-In to Gate-Out)</p>
      </div>

      <ChartCard title="🔍 Filters">
        <div className="max-w-xs">
          <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Vehicle Number</label>
          <input
            value={vehicleNo}
            onChange={(e) => {
              setVehicleNo(e.target.value.toUpperCase())
              setPage(1)
            }}
            placeholder="e.g., MH12AB1234"
            className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
          />
        </div>
      </ChartCard>

      {(average.error || list.error) && <ErrorNotice error={(average.error ?? list.error)!} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Total Records" value={(list.data?.total_count ?? 0).toLocaleString()} />
        <KpiCard label="Avg Loading Time" value={`${(average.data?.avg_minutes ?? 0).toFixed(1)} min`} />
        <KpiCard label="Avg Time (Hours)" value={`${((average.data?.avg_minutes ?? 0) / 60).toFixed(2)} hr`} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="📦 Loading Time Distribution by Warehouse (minutes)">
          {boxplot.error ? (
            <ErrorNotice error={boxplot.error} />
          ) : (
            <ReactECharts
              style={{ height: 380 }}
              option={{
                tooltip: { trigger: 'item' },
                grid: { left: 160, right: 20, top: 10, bottom: 20 },
                xAxis: { type: 'value', max: boxplotAxisMax(boxplot.data ?? []) },
                yAxis: { type: 'category', data: (boxplot.data ?? []).map((r) => r.warehouse_name) },
                series: [
                  {
                    type: 'boxplot',
                    data: (boxplot.data ?? []).map((r) => [r.min, r.q1, r.median, r.q3, r.max]),
                    itemStyle: { color: '#93c5fd', borderColor: '#1d4ed8' },
                  },
                ],
              }}
            />
          )}
        </ChartCard>

        <ChartCard title="📈 Daily Average Loading Time Trend">
          {trend.error ? (
            <ErrorNotice error={trend.error} />
          ) : (
            <ReactECharts
              style={{ height: 380 }}
              option={{
                tooltip: { trigger: 'axis' },
                xAxis: { type: 'category', data: (trend.data ?? []).map((t) => t.entry_date) },
                yAxis: { type: 'value', name: 'minutes' },
                series: [
                  {
                    type: 'line',
                    smooth: true,
                    data: (trend.data ?? []).map((t) => t.avg_minutes),
                    itemStyle: { color: '#2563eb' },
                    areaStyle: { opacity: 0.1 },
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
                    <th className="py-1 pr-2">Warehouse</th>
                    <th className="py-1 pr-2">Vehicle No</th>
                    <th className="py-1 pr-2">Entry Gate No</th>
                    <th className="py-1 pr-2">Entry Time</th>
                    <th className="py-1 pr-2">Exit Gate No</th>
                    <th className="py-1 pr-2">Exit Time</th>
                    <th className="py-1 pr-2">Total Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(list.data?.data ?? []).map((r) => (
                    <tr key={r.entry_gate_no} className="border-t border-[var(--border)]">
                      <td className="py-1 pr-2">{r.warehouse_name}</td>
                      <td className="py-1 pr-2">{r.vehicle_no}</td>
                      <td className="py-1 pr-2">{r.entry_gate_no}</td>
                      <td className="py-1 pr-2">{r.entry_datetime}</td>
                      <td className="py-1 pr-2">{r.exit_gate_no ?? (r.is_still_inside ? 'Still inside' : '—')}</td>
                      <td className="py-1 pr-2">{r.exit_datetime ?? '—'}</td>
                      <td className="py-1 pr-2">{r.total_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />

            <button
              onClick={() => downloadCsv('vehicle_tat.csv', list.data?.data ?? [])}
              className="mt-2 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              📥 Download as CSV
            </button>
          </>
        )}
      </ChartCard>
    </div>
  )
}
