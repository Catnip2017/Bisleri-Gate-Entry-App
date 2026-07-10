import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { useAuth } from '../../lib/auth'
import { useFilters } from '../../lib/filters'
import { apiFetch, buildQuery, type ApiError, type WarehouseAnalytics } from '../../lib/api'
import { KpiCard, ChartCard, ErrorNotice } from '../../components/ui/DashboardUI'
import TripTable from './TripTable'

interface WarehouseTrendPoint {
  trip_date: string
  trip_count: number
  inward: number
  outward: number
  avg_load: number
}

export default function WarehouseView() {
  const { token } = useAuth()
  const { dateRange } = useFilters()
  const [warehouse, setWarehouse] = useState('')

  const warehouses = useQuery<string[], ApiError>({
    queryKey: ['load', 'filters', 'warehouses'],
    queryFn: () => apiFetch('/load/filters/warehouses', token),
    enabled: !!token,
  })

  useEffect(() => {
    if (!warehouse && warehouses.data && warehouses.data.length > 0) {
      setWarehouse(warehouses.data[0])
    }
  }, [warehouses.data, warehouse])

  const analytics = useQuery<WarehouseAnalytics, ApiError>({
    queryKey: ['load', 'warehouse', 'analytics', warehouse, dateRange],
    queryFn: () =>
      apiFetch(
        buildQuery('/load/warehouse/analytics', { dateRange, extra: { warehouse_name: warehouse } }),
        token,
      ),
    enabled: !!token && !!warehouse,
  })

  const trend = useQuery<WarehouseTrendPoint[], ApiError>({
    queryKey: ['load', 'warehouse', 'trend', warehouse, dateRange],
    queryFn: () =>
      apiFetch(buildQuery('/load/warehouse/trend', { dateRange, extra: { warehouse_name: warehouse } }), token),
    enabled: !!token && !!warehouse,
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-[var(--brand-dark)]">🏭 Warehouse Load Management</h2>

      <ChartCard title="Select Warehouse">
        {warehouses.error ? (
          <ErrorNotice error={warehouses.error} />
        ) : (
          <select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            className="w-full max-w-md rounded border border-[var(--border)] px-2 py-1.5 text-sm"
          >
            {(warehouses.data ?? []).map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        )}
      </ChartCard>

      {analytics.error && <ErrorNotice error={analytics.error} />}
      {analytics.data && analytics.data.total_trips > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <KpiCard label="Total Trips" value={analytics.data.total_trips.toLocaleString()} />
            <KpiCard label="Unique Vehicles" value={analytics.data.unique_vehicles.toLocaleString()} />
            <KpiCard label="Avg Load %" value={`${analytics.data.avg_load_percent.toFixed(1)}%`} />
            <KpiCard label="Inward" value={analytics.data.inward_count.toLocaleString()} />
            <KpiCard label="Outward" value={analytics.data.outward_count.toLocaleString()} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <ChartCard title="📈 Movement Distribution">
              <ReactECharts
                style={{ height: 280 }}
                option={{
                  tooltip: { trigger: 'item' },
                  series: [
                    {
                      type: 'pie',
                      radius: '65%',
                      data: [
                        { name: 'Inward', value: analytics.data.inward_count, itemStyle: { color: '#2e7d32' } },
                        { name: 'Outward', value: analytics.data.outward_count, itemStyle: { color: '#c62828' } },
                      ],
                    },
                  ],
                }}
              />
            </ChartCard>

            <ChartCard title="⚖️ Load Distribution">
              <ReactECharts
                style={{ height: 280 }}
                option={{
                  tooltip: {},
                  xAxis: { type: 'category', data: ['Normal', 'Overloaded'] },
                  yAxis: { type: 'value' },
                  series: [
                    {
                      type: 'bar',
                      data: [
                        {
                          value: analytics.data.total_trips - analytics.data.overloaded_trips,
                          itemStyle: { color: '#2e7d32' },
                        },
                        { value: analytics.data.overloaded_trips, itemStyle: { color: '#c62828' } },
                      ],
                    },
                  ],
                }}
              />
            </ChartCard>

            <ChartCard title="📊 Key Metrics">
              <div className="space-y-3 pt-2">
                <KpiCard
                  label="Total Weight"
                  value={`${Math.round(analytics.data.total_weight_moved).toLocaleString()} kg`}
                />
                <KpiCard
                  label="Avg Weight/Trip"
                  value={`${Math.round(analytics.data.avg_weight_per_trip).toLocaleString()} kg`}
                />
                <KpiCard label="Zero Weight" value={analytics.data.zero_weight_trips.toLocaleString()} />
              </div>
            </ChartCard>
          </div>

          <ChartCard title="📅 Daily Trend">
            {trend.error ? (
              <ErrorNotice error={trend.error} />
            ) : (
              <ReactECharts
                style={{ height: 350 }}
                option={{
                  tooltip: { trigger: 'axis' },
                  legend: { data: ['Inward', 'Outward'] },
                  xAxis: { type: 'category', data: (trend.data ?? []).map((t) => t.trip_date) },
                  yAxis: { type: 'value' },
                  series: [
                    {
                      name: 'Inward',
                      type: 'line',
                      smooth: true,
                      data: (trend.data ?? []).map((t) => t.inward),
                      itemStyle: { color: '#2e7d32' },
                    },
                    {
                      name: 'Outward',
                      type: 'line',
                      smooth: true,
                      data: (trend.data ?? []).map((t) => t.outward),
                      itemStyle: { color: '#c62828' },
                    },
                  ],
                }}
              />
            )}
          </ChartCard>
        </>
      )}

      {analytics.data && analytics.data.total_trips === 0 && (
        <p className="text-sm text-orange-600">No data available for {warehouse}</p>
      )}

      {warehouse && <TripTable warehouseName={warehouse} pageContext="warehouse" />}
    </div>
  )
}
