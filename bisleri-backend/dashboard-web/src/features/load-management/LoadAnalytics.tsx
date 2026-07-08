import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { useAuth } from '../../lib/auth'
import { useFilters } from '../../lib/filters'
import {
  apiFetch,
  withWarehouses,
  type ApiError,
  type LoadStats,
  type DocumentTypeStat,
  type OwnershipStat,
  type MovementStat,
  type TatBoxplotRow,
  type ScatterRow,
  type RepeatOffenderRow,
} from '../../lib/api'
import { KpiCard, ChartCard, ErrorNotice, boxplotAxisMax } from '../../components/ui/DashboardUI'

interface LoadTrendPoint {
  trip_date?: string
  trip_month?: string
  trip_count: number
  gate_in?: number
  gate_out?: number
  avg_load: number
}

function useLoadQuery<T>(key: string, path: string) {
  const { token } = useAuth()
  const { selectedWarehouses } = useFilters()
  return useQuery<T, ApiError>({
    queryKey: ['load', 'analytics', key, selectedWarehouses],
    queryFn: () => apiFetch<T>(withWarehouses(path, selectedWarehouses), token),
    enabled: !!token,
  })
}

export default function LoadAnalytics() {
  const [trendGranularity, setTrendGranularity] = useState<'daily' | 'monthly'>('daily')
  const { token } = useAuth()
  const { selectedWarehouses } = useFilters()

  const stats = useLoadQuery<LoadStats>('stats', '/load/analytics/stats')
  const docTypes = useLoadQuery<DocumentTypeStat[]>('document-types', '/load/analytics/document-types')
  const ownership = useLoadQuery<OwnershipStat[]>('vehicle-ownership', '/load/analytics/vehicle-ownership')
  const movement = useLoadQuery<MovementStat[]>('movement-stats', '/load/analytics/movement-stats')
  const boxplot = useLoadQuery<TatBoxplotRow[]>('boxplot', '/load/analytics/boxplot')
  const scatter = useLoadQuery<ScatterRow[]>('scatter', '/load/analytics/scatter')
  const repeatOffenders = useLoadQuery<RepeatOffenderRow[]>(
    'repeat-offenders',
    '/load/analytics/repeat-offenders?limit=15',
  )

  const trend = useQuery<LoadTrendPoint[], ApiError>({
    queryKey: ['load', 'analytics', 'trend', trendGranularity, selectedWarehouses],
    queryFn: () =>
      apiFetch(withWarehouses(`/load/analytics/trend?granularity=${trendGranularity}`, selectedWarehouses), token),
    enabled: !!token,
  })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--brand-dark)]">📊 Load Management Analytics</h2>
        <p className="text-sm text-[var(--muted)]">Showing only loaded trips with weight calculations</p>
      </div>

      {stats.error && <ErrorNotice error={stats.error} />}
      {stats.data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiCard label="Total Trips" value={stats.data.total_trips.toLocaleString()} />
            <KpiCard label="Unique Vehicles" value={stats.data.total_vehicles.toLocaleString()} />
            <KpiCard label="Avg Load %" value={`${stats.data.avg_load.toFixed(1)}%`} />
            <KpiCard label="Inward Trips" value={stats.data.gate_in_count.toLocaleString()} />
            <KpiCard label="Outward Trips" value={stats.data.gate_out_count.toLocaleString()} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total Weight Moved" value={`${Math.round(stats.data.total_weight_moved).toLocaleString()} kg`} />
            <KpiCard label="Avg Weight/Trip" value={`${Math.round(stats.data.avg_weight_per_trip).toLocaleString()} kg`} />
            <KpiCard label="Overloaded Trips" value={stats.data.overloaded_count.toLocaleString()} />
            <KpiCard label="Zero Weight Trips" value={stats.data.zero_weight_trips.toLocaleString()} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ChartCard title="📄 Loaded Trips By Document Type">
          {docTypes.error ? (
            <ErrorNotice error={docTypes.error} />
          ) : (
            <ReactECharts
              style={{ height: 300 }}
              option={{
                grid: { left: 100, right: 20, top: 10, bottom: 20 },
                xAxis: { type: 'value' },
                yAxis: { type: 'category', data: (docTypes.data ?? []).map((d) => d.document_type) },
                series: [
                  { type: 'bar', data: (docTypes.data ?? []).map((d) => d.trip_count), itemStyle: { color: '#00a651' } },
                ],
                tooltip: {},
              }}
            />
          )}
        </ChartCard>

        <ChartCard title="🚛 Loaded Vehicles By Type">
          {ownership.error ? (
            <ErrorNotice error={ownership.error} />
          ) : (
            <ReactECharts
              style={{ height: 300 }}
              option={{
                tooltip: { trigger: 'item' },
                series: [
                  {
                    type: 'pie',
                    radius: '65%',
                    data: (ownership.data ?? []).map((o) => ({
                      name: o.ownership_type,
                      value: o.vehicle_count,
                      itemStyle: { color: o.ownership_type === 'Company Owned' ? '#2e7d32' : '#1f77b4' },
                    })),
                  },
                ],
              }}
            />
          )}
        </ChartCard>

        <ChartCard title="🔄 Loaded Movement Type">
          {movement.error ? (
            <ErrorNotice error={movement.error} />
          ) : (
            <ReactECharts
              style={{ height: 300 }}
              option={{
                grid: { left: 40, right: 20, top: 10, bottom: 30 },
                xAxis: { type: 'category', data: (movement.data ?? []).map((m) => m.movement_type) },
                yAxis: { type: 'value' },
                series: [
                  { type: 'bar', data: (movement.data ?? []).map((m) => m.trip_count), itemStyle: { color: '#667eea' } },
                ],
                tooltip: {},
              }}
            />
          )}
        </ChartCard>
      </div>

      <ChartCard title="📈 Loaded Trip Trends">
        <div className="mb-2 flex gap-2">
          {(['daily', 'monthly'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setTrendGranularity(g)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                trendGranularity === g ? 'bg-[var(--brand)] text-white' : 'bg-[var(--brand-tint-2)] text-[var(--muted)]'
              }`}
            >
              {g === 'daily' ? 'Daily View' : 'Monthly View'}
            </button>
          ))}
        </div>
        {trend.error ? (
          <ErrorNotice error={trend.error} />
        ) : trendGranularity === 'daily' ? (
          <ReactECharts
            style={{ height: 350 }}
            option={{
              tooltip: { trigger: 'axis' },
              legend: { data: ['Gate-In', 'Gate-Out'] },
              xAxis: { type: 'category', data: (trend.data ?? []).map((d) => d.trip_date) },
              yAxis: { type: 'value' },
              series: [
                {
                  name: 'Gate-In',
                  type: 'line',
                  smooth: true,
                  data: (trend.data ?? []).map((d) => d.gate_in ?? 0),
                  itemStyle: { color: '#4caf50' },
                  areaStyle: { opacity: 0.15 },
                },
                {
                  name: 'Gate-Out',
                  type: 'line',
                  smooth: true,
                  data: (trend.data ?? []).map((d) => d.gate_out ?? 0),
                  itemStyle: { color: '#ff5722' },
                  areaStyle: { opacity: 0.15 },
                },
              ],
            }}
          />
        ) : (
          <ReactECharts
            style={{ height: 350 }}
            option={{
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: (trend.data ?? []).map((d) => (d.trip_month ?? '').slice(0, 7)) },
              yAxis: { type: 'value' },
              series: [
                {
                  name: 'Total Trips',
                  type: 'line',
                  smooth: true,
                  data: (trend.data ?? []).map((d) => d.trip_count),
                  itemStyle: { color: '#2e7d32' },
                  lineStyle: { width: 3 },
                },
              ],
            }}
          />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="📦 Load % Distribution by Warehouse (loaded trips only)">
          {boxplot.error ? (
            <ErrorNotice error={boxplot.error} />
          ) : (
            <ReactECharts
              style={{ height: 380 }}
              option={{
                tooltip: { trigger: 'item' },
                grid: { left: 160, right: 20, top: 10, bottom: 20 },
                xAxis: { type: 'value', max: boxplotAxisMax(boxplot.data ?? []), name: '%' },
                yAxis: { type: 'category', data: (boxplot.data ?? []).map((r) => r.warehouse_name) },
                series: [
                  {
                    type: 'boxplot',
                    data: (boxplot.data ?? []).map((r) => [r.min, r.q1, r.median, r.q3, r.max]),
                    itemStyle: { color: '#fbbf24', borderColor: '#b45309' },
                  },
                ],
              }}
            />
          )}
        </ChartCard>

        <ChartCard title="⚖️ Weight vs Capacity (per vehicle)">
          {scatter.error ? (
            <ErrorNotice error={scatter.error} />
          ) : (
            <ReactECharts
              style={{ height: 380 }}
              option={{
                tooltip: {
                  formatter: (p: { data: [number, number, number, number] }) =>
                    `Capacity: ${p.data[0]} kg<br/>Avg Weight: ${p.data[1].toFixed(0)} kg<br/>Overloaded trips: ${p.data[2]}`,
                },
                xAxis: { type: 'value', name: 'Capacity (kg)' },
                yAxis: { type: 'value', name: 'Avg Weight (kg)' },
                series: [
                  {
                    type: 'scatter',
                    symbolSize: (d: number[]) => Math.min(6 + d[2] / 5, 26),
                    data: (scatter.data ?? []).map((r) => [r.capacity_kg, r.avg_weight_kg, r.overloaded_count]),
                    itemStyle: { color: 'rgba(220, 38, 38, 0.55)' },
                  },
                ],
              }}
            />
          )}
        </ChartCard>
      </div>

      <ChartCard title="🚨 Repeat Offenders (most frequently overloaded vehicles)">
        {repeatOffenders.error ? (
          <ErrorNotice error={repeatOffenders.error} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="py-1">Vehicle No</th>
                <th className="py-1 text-right">Total Trips</th>
                <th className="py-1 text-right">Overloaded Trips</th>
                <th className="py-1 text-right">Avg Load %</th>
              </tr>
            </thead>
            <tbody>
              {(repeatOffenders.data ?? []).map((r) => (
                <tr key={r.vehicle_no} className="border-t border-[var(--border)]">
                  <td className="py-1 font-semibold">{r.vehicle_no}</td>
                  <td className="py-1 text-right">{r.total_trips.toLocaleString()}</td>
                  <td className="py-1 text-right text-red-600">{r.overloaded_count.toLocaleString()}</td>
                  <td className="py-1 text-right">{r.avg_load.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ChartCard>
    </div>
  )
}
