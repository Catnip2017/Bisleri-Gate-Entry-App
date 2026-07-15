import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import ReactECharts from 'echarts-for-react'
import { useAuth } from '../../lib/auth'
import { useFilters } from '../../lib/filters'
import {
  apiFetch,
  buildQuery,
  type ApiError,
  type DocumentTatRow,
  type PaginatedResult,
  type TatAverage,
  type TatBoxplotRow,
  type TatTrendPoint,
} from '../../lib/api'
import { KpiCard, ChartCard, ErrorNotice, Pagination, downloadCsv, boxplotAxisMax } from '../../components/ui/DashboardUI'
import { useDebouncedValue } from '../../lib/useDebouncedValue'

export default function DocumentTat() {
  const { token } = useAuth()
  const { selectedWarehouses, dateRange } = useFilters()

  const [site, setSite] = useState('')
  const [docTypes, setDocTypes] = useState<string[]>([])
  const [vehicleNoInput, setVehicleNoInput] = useState('')
  const [documentNoInput, setDocumentNoInput] = useState('')
  const vehicleNo = useDebouncedValue(vehicleNoInput)
  const documentNo = useDebouncedValue(documentNoInput)
  const [page, setPage] = useState(1)

  const extra = {
    site: site || null,
    document_types: docTypes,
    vehicle_no: vehicleNo || null,
    document_no: documentNo || null,
  }

  const sites = useQuery<string[], ApiError>({
    queryKey: ['tat', 'sites'],
    queryFn: () => apiFetch('/tat/filters/sites', token),
    enabled: !!token,
  })

  const docTypeOptions = useQuery<string[], ApiError>({
    queryKey: ['tat', 'document-types'],
    queryFn: () => apiFetch('/tat/filters/document-types', token),
    enabled: !!token,
  })

  const filterKey = [selectedWarehouses, dateRange, site, docTypes, vehicleNo, documentNo]

  const list = useQuery<PaginatedResult<DocumentTatRow>, ApiError>({
    queryKey: ['tat', 'document', 'list', filterKey, page],
    queryFn: () =>
      apiFetch(
        buildQuery('/tat/document', {
          warehouses: selectedWarehouses,
          dateRange,
          extra: { ...extra, page },
        }),
        token,
      ),
    enabled: !!token,
  })

  const average = useQuery<TatAverage, ApiError>({
    queryKey: ['tat', 'document', 'average', filterKey],
    queryFn: () =>
      apiFetch(buildQuery('/tat/document/average', { warehouses: selectedWarehouses, dateRange, extra }), token),
    enabled: !!token,
  })

  const boxplot = useQuery<TatBoxplotRow[], ApiError>({
    queryKey: ['tat', 'document', 'boxplot', filterKey],
    queryFn: () =>
      apiFetch(buildQuery('/tat/document/boxplot', { warehouses: selectedWarehouses, dateRange, extra }), token),
    enabled: !!token,
  })

  const trend = useQuery<TatTrendPoint[], ApiError>({
    queryKey: ['tat', 'document', 'trend', filterKey],
    queryFn: () =>
      apiFetch(buildQuery('/tat/document/trend', { warehouses: selectedWarehouses, dateRange, extra }), token),
    enabled: !!token,
  })

  const totalPages = list.data ? Math.ceil(list.data.total_count / 50) : 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 p-4 text-white">
        <h2 className="text-lg font-bold">📄 Document Turn Around Time</h2>
      </div>

      {/* Local filters */}
      <ChartCard title="🔍 Filters">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Site</label>
            <select
              value={site}
              onChange={(e) => {
                setSite(e.target.value)
                setPage(1)
              }}
              className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              {(sites.data ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
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

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Vehicle Number</label>
            <input
              value={vehicleNoInput}
              onChange={(e) => {
                setVehicleNoInput(e.target.value.toUpperCase())
                setPage(1)
              }}
              placeholder="e.g., MH12AB1234"
              className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--muted)]">Document No</label>
            <input
              value={documentNoInput}
              onChange={(e) => {
                setDocumentNoInput(e.target.value.toUpperCase())
                setPage(1)
              }}
              placeholder="e.g., TON26027193"
              className="w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      </ChartCard>

      {/* KPIs */}
      {(average.error || list.error) && <ErrorNotice error={(average.error ?? list.error)!} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Total Records" value={(list.data?.total_count ?? 0).toLocaleString()} />
        <KpiCard label="Average TAT" value={`${(average.data?.avg_minutes ?? 0).toFixed(1)} min`} />
        <KpiCard label="Avg TAT (Hours)" value={`${((average.data?.avg_minutes ?? 0) / 60).toFixed(2)} hr`} />
      </div>

      {/* Box plot + trend */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ChartCard title="📦 TAT Distribution by Warehouse (minutes)">
          {boxplot.error ? (
            <ErrorNotice error={boxplot.error} />
          ) : (
            <ReactECharts
              style={{ height: 380 }}
              option={{
                tooltip: { trigger: 'item' },
                grid: { left: 160, right: 20, top: 10, bottom: 20 },
                xAxis: { type: 'value', max: boxplotAxisMax(boxplot.data ?? []) },
                yAxis: {
                  type: 'category',
                  data: (boxplot.data ?? []).map((r) => r.warehouse_name),
                },
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

        <ChartCard title="📈 Daily Average TAT Trend">
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

      {/* Table */}
      <ChartCard title="📋 Records">
        {list.error ? (
          <ErrorNotice error={list.error} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[var(--muted)]">
                    <th className="py-1 pr-2">Gate Entry No</th>
                    <th className="py-1 pr-2">Gate Entry DateTime</th>
                    <th className="py-1 pr-2">Document No</th>
                    <th className="py-1 pr-2">Document Type</th>
                    <th className="py-1 pr-2">Vehicle No</th>
                    <th className="py-1 pr-2">Driver</th>
                    <th className="py-1 pr-2">Avg Turn</th>
                  </tr>
                </thead>
                <tbody>
                  {(list.data?.data ?? []).map((r) => (
                    <tr key={`${r.gate_entry_no}-${r.document_no}`} className="border-t border-[var(--border)]">
                      <td className="py-1 pr-2">{r.gate_entry_no}</td>
                      <td className="py-1 pr-2">{r.gate_entry_datetime}</td>
                      <td className="py-1 pr-2">{r.document_no}</td>
                      <td className="py-1 pr-2">{r.document_type}</td>
                      <td className="py-1 pr-2">{r.vehicle_no}</td>
                      <td className="py-1 pr-2">{r.driver_name}</td>
                      <td className="py-1 pr-2">{r.avg_turn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />

            <button
              onClick={() => downloadCsv('document_tat.csv', list.data?.data ?? [])}
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
