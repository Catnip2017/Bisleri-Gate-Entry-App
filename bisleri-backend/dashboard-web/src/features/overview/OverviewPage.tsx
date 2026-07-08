import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { useAuth } from '../../lib/auth'
import { useFilters } from '../../lib/filters'
import {
  apiFetch,
  withWarehouses,
  type ApiError,
  type OverviewStats,
  type DocumentTypeStat,
  type OwnershipStat,
  type MovementStat,
  type DailyTrendPoint,
  type MonthlyTrendPoint,
  type WarehouseDistributionRow,
  type HeatmapCell,
} from '../../lib/api'
import { KpiCard, ChartCard, ErrorNotice } from '../../components/ui/DashboardUI'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function useOverviewQuery<T>(key: string, path: string) {
  const { token } = useAuth()
  const { selectedWarehouses } = useFilters()
  return useQuery<T, ApiError>({
    queryKey: ['overview', key, selectedWarehouses],
    queryFn: () => apiFetch<T>(withWarehouses(path, selectedWarehouses), token),
    enabled: !!token,
  })
}

export default function OverviewPage() {
  const [trendGranularity, setTrendGranularity] = useState<'daily' | 'monthly'>('daily')

  const stats = useOverviewQuery<OverviewStats>('stats', '/overview/stats')
  const docTypes = useOverviewQuery<DocumentTypeStat[]>('document-types', '/overview/document-types')
  const ownership = useOverviewQuery<OwnershipStat[]>('vehicle-ownership', '/overview/vehicle-ownership')
  const movement = useOverviewQuery<MovementStat[]>('movement-stats', '/overview/movement-stats')
  const warehouseDist = useOverviewQuery<WarehouseDistributionRow[]>(
    'warehouse-distribution',
    '/overview/warehouse-distribution',
  )
  const heatmap = useOverviewQuery<HeatmapCell[]>('activity-heatmap', '/overview/activity-heatmap')

  const { token } = useAuth()
  const { selectedWarehouses } = useFilters()
  const trend = useQuery<(DailyTrendPoint | MonthlyTrendPoint)[], ApiError>({
    queryKey: ['overview', 'trend', trendGranularity, selectedWarehouses],
    queryFn: () =>
      apiFetch(
        withWarehouses(`/overview/trend?granularity=${trendGranularity}`, selectedWarehouses),
        token,
      ),
    enabled: !!token,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-[var(--brand-dark)]">📊 Enterprise Gate Pass Analysis</h2>

      {/* KPI cards */}
      {stats.error && <ErrorNotice error={stats.error} />}
      {stats.data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <KpiCard label="Total Trips" value={stats.data.total_trips.toLocaleString()} />
          <KpiCard label="Unique Vehicles" value={stats.data.total_vehicles.toLocaleString()} />
          <KpiCard label="Total Warehouses" value={stats.data.total_warehouses} />
          <KpiCard label="Inward Trips" value={stats.data.gate_in_count.toLocaleString()} />
          <KpiCard label="Outward Trips" value={stats.data.gate_out_count.toLocaleString()} />
        </div>
      )}

      {/* Row 1: doc type / ownership / movement */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ChartCard title="📄 All Trips By Document Type">
          {docTypes.error ? (
            <ErrorNotice error={docTypes.error} />
          ) : (
            <ReactECharts
              style={{ height: 300 }}
              option={{
                grid: { left: 100, right: 20, top: 10, bottom: 20 },
                xAxis: { type: 'value' },
                yAxis: {
                  type: 'category',
                  data: (docTypes.data ?? []).map((d) => d.document_type),
                },
                series: [
                  {
                    type: 'bar',
                    data: (docTypes.data ?? []).map((d) => d.trip_count),
                    itemStyle: { color: '#00a651' },
                  },
                ],
                tooltip: {},
              }}
            />
          )}
        </ChartCard>

        <ChartCard title="🚛 All Vehicles By Type">
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
                      itemStyle: {
                        color: o.ownership_type === 'Company Owned' ? '#2e7d32' : '#1f77b4',
                      },
                    })),
                  },
                ],
              }}
            />
          )}
        </ChartCard>

        <ChartCard title="🔄 All Movement Type">
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
                  {
                    type: 'bar',
                    data: (movement.data ?? []).map((m) => m.trip_count),
                    itemStyle: { color: '#667eea' },
                  },
                ],
                tooltip: {},
              }}
            />
          )}
        </ChartCard>
      </div>

      {/* Trip trends */}
      <ChartCard title="📈 All Trip Trends">
        <div className="mb-2 flex gap-2">
          {(['daily', 'monthly'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setTrendGranularity(g)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                trendGranularity === g
                  ? 'bg-[var(--brand)] text-white'
                  : 'bg-[var(--brand-tint-2)] text-[var(--muted)]'
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
              xAxis: {
                type: 'category',
                data: ((trend.data ?? []) as DailyTrendPoint[]).map((d) => d.trip_date),
              },
              yAxis: { type: 'value' },
              series: [
                {
                  name: 'Gate-In',
                  type: 'line',
                  smooth: true,
                  data: ((trend.data ?? []) as DailyTrendPoint[]).map((d) => d.gate_in),
                  itemStyle: { color: '#4caf50' },
                  areaStyle: { opacity: 0.15 },
                },
                {
                  name: 'Gate-Out',
                  type: 'line',
                  smooth: true,
                  data: ((trend.data ?? []) as DailyTrendPoint[]).map((d) => d.gate_out),
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
              xAxis: {
                type: 'category',
                data: ((trend.data ?? []) as MonthlyTrendPoint[]).map((d) => d.trip_month.slice(0, 7)),
              },
              yAxis: { type: 'value' },
              series: [
                {
                  name: 'Total Trips',
                  type: 'line',
                  smooth: true,
                  data: ((trend.data ?? []) as MonthlyTrendPoint[]).map((d) => d.trip_count),
                  itemStyle: { color: '#2e7d32' },
                  lineStyle: { width: 3 },
                },
              ],
            }}
          />
        )}
      </ChartCard>

      {/* Warehouse distribution + heatmap */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="🏭 Total Entries by Warehouse (Top 10)">
          {warehouseDist.error ? (
            <ErrorNotice error={warehouseDist.error} />
          ) : (
            <ReactECharts
              style={{ height: 400 }}
              option={{
                grid: { left: 160, right: 30, top: 10, bottom: 20 },
                xAxis: { type: 'value' },
                yAxis: {
                  type: 'category',
                  data: (warehouseDist.data ?? [])
                    .slice(0, 10)
                    .map((w) => w.warehouse_name)
                    .reverse(),
                },
                series: [
                  {
                    type: 'bar',
                    data: (warehouseDist.data ?? [])
                      .slice(0, 10)
                      .map((w) => w.trip_count)
                      .reverse(),
                    itemStyle: { color: '#3f6ad8' },
                  },
                ],
                tooltip: {},
              }}
            />
          )}
        </ChartCard>

        <ChartCard title="🕐 Gate Activity Heatmap (day × hour)">
          {heatmap.error ? (
            <ErrorNotice error={heatmap.error} />
          ) : (
            <ReactECharts
              style={{ height: 400 }}
              option={{
                tooltip: { position: 'top' },
                grid: { left: 60, right: 20, top: 10, bottom: 40 },
                xAxis: {
                  type: 'category',
                  data: Array.from({ length: 24 }, (_, h) => h),
                  splitArea: { show: true },
                },
                yAxis: {
                  type: 'category',
                  data: DAY_LABELS,
                  splitArea: { show: true },
                },
                visualMap: {
                  min: 0,
                  max: Math.max(1, ...(heatmap.data ?? []).map((c) => c.trip_count)),
                  calculable: true,
                  orient: 'horizontal',
                  left: 'center',
                  bottom: -5,
                  inRange: { color: ['#eaf7ef', '#00a651', '#064d28'] },
                },
                series: [
                  {
                    type: 'heatmap',
                    data: (heatmap.data ?? []).map((c) => [c.hour_of_day, c.day_of_week, c.trip_count]),
                  },
                ],
              }}
            />
          )}
        </ChartCard>
      </div>

      {/* Top 5 table */}
      {warehouseDist.data && (
        <ChartCard title="📊 Top 5 Warehouses">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="py-1">Warehouse</th>
                <th className="py-1 text-right">Trips</th>
              </tr>
            </thead>
            <tbody>
              {warehouseDist.data.slice(0, 5).map((w) => (
                <tr key={w.warehouse_name} className="border-t border-[var(--border)]">
                  <td className="py-1">{w.warehouse_name}</td>
                  <td className="py-1 text-right">{w.trip_count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>
      )}
    </div>
  )
}
