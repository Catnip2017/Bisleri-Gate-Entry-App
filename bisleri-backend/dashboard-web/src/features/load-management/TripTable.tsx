import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { useAuth } from '../../lib/auth'
import { useFilters } from '../../lib/filters'
import { apiFetch, buildQuery, type ApiError, type LoadTripRow, type PaginatedResult } from '../../lib/api'
import { ChartCard, ErrorNotice, Pagination, downloadCsv } from '../../components/ui/DashboardUI'

function loadGaugeOption(loadPercentage: number) {
  const color = loadPercentage > 100 ? '#c62828' : loadPercentage > 80 ? '#ef6c00' : '#2e7d32'
  return {
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 150,
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14 } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { distance: -30, fontSize: 10 },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          fontSize: 22,
          color,
          offsetCenter: [0, '20%'],
        },
        itemStyle: { color },
        data: [{ value: loadPercentage }],
      },
    ],
  }
}

export default function TripTable({
  vehicleNo,
  warehouseName,
  pageContext,
}: {
  vehicleNo?: string
  warehouseName?: string
  pageContext: string
}) {
  const { token } = useAuth()
  const { dateRange } = useFilters()
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const list = useQuery<PaginatedResult<LoadTripRow>, ApiError>({
    queryKey: ['load', 'trips', pageContext, vehicleNo, warehouseName, dateRange, page],
    queryFn: () =>
      apiFetch(
        buildQuery('/load/trips', {
          dateRange,
          extra: { vehicle_no: vehicleNo, warehouse_name: warehouseName, page },
        }),
        token,
      ),
    enabled: !!token,
  })

  const totalPages = list.data ? Math.ceil(list.data.total_count / 50) : 0
  const showWarehouseColumn = !warehouseName

  if (list.error) return <ErrorNotice error={list.error} />
  if (!list.data || list.data.total_count === 0) {
    return <p className="text-sm text-[var(--muted)]">No trip records found</p>
  }

  return (
    <ChartCard title="📋 Trip Records">
      <p className="mb-2 text-xs text-[var(--muted)]">
        Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, list.data.total_count)} of{' '}
        {list.data.total_count.toLocaleString()}
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-[var(--muted)]">
              <th className="py-1 pr-2">Vehicle No</th>
              <th className="py-1 pr-2">Gate Entry No</th>
              <th className="py-1 pr-2">Date</th>
              <th className="py-1 pr-2">Time</th>
              <th className="py-1 pr-2">{showWarehouseColumn ? 'Warehouse' : 'Movement'}</th>
              <th className="py-1 pr-2">Total Weight (kg)</th>
              <th className="py-1 pr-2">Max Load (kg)</th>
              <th className="py-1 pr-2">Load %</th>
            </tr>
          </thead>
          <tbody>
            {list.data.data.map((r) => {
              const loadClass =
                r.load_percentage === 0
                  ? 'text-[var(--muted)] italic'
                  : r.load_percentage > 100
                    ? 'font-bold text-red-700'
                    : r.load_percentage > 80
                      ? 'font-bold text-orange-600'
                      : 'font-bold text-green-700'
              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--brand-tint-2)]"
                  >
                    <td className="py-1 pr-2">{r.vehicle_no}</td>
                    <td className="py-1 pr-2">{r.gate_entry_no}</td>
                    <td className="py-1 pr-2">{r.date?.slice(0, 10)}</td>
                    <td className="py-1 pr-2">{r.time?.slice(0, 5)}</td>
                    <td className="py-1 pr-2">{showWarehouseColumn ? r.warehouse_name : r.movement_type}</td>
                    <td className="py-1 pr-2">{r.total_weight_kg.toFixed(2)}</td>
                    <td className="py-1 pr-2">{r.maximum_load_kg.toFixed(2)}</td>
                    <td className={`py-1 pr-2 ${loadClass}`}>{r.load_percentage.toFixed(2)}</td>
                  </tr>
                  {expandedId === r.id && (
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={8} className="bg-[var(--brand-tint-2)] p-3">
                        <div className="flex flex-wrap items-center gap-6">
                          <ReactECharts style={{ width: 220, height: 160 }} option={loadGaugeOption(r.load_percentage)} />
                          <div className="text-sm">
                            <div>
                              <b>Total Weight:</b> {r.total_weight_kg.toFixed(2)} kg
                            </div>
                            <div>
                              <b>Max Capacity:</b> {r.maximum_load_kg.toFixed(2)} kg
                            </div>
                            <div>
                              <b>Remaining:</b> {(r.maximum_load_kg - r.total_weight_kg).toFixed(2)} kg
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <button
        onClick={() => downloadCsv(`load_trips_${pageContext}.csv`, list.data?.data ?? [])}
        className="mt-2 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white"
      >
        📥 Download as CSV
      </button>
    </ChartCard>
  )
}
