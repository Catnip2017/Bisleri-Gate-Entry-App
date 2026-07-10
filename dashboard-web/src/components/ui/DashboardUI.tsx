import type { ReactNode } from 'react'
import { ApiError } from '../../lib/api'

// A handful of warehouses can have wildly bad outlier data (e.g. a document
// date years off, producing a "TAT" of hundreds of thousands of minutes).
// That's real (dirty) data, not something to silently drop — but a linear
// axis scaled to the single worst outlier makes every other warehouse's box
// invisible. Cap the axis to the interquartile spread instead; outlier
// whiskers simply run off the edge of the chart (still visible on hover).
export function boxplotAxisMax(rows: { q3: number }[]): number | undefined {
  if (rows.length === 0) return undefined
  const maxQ3 = Math.max(...rows.map((r) => r.q3))
  return Math.max(200, maxQ3 * 4)
}

export function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-dark)] p-4 text-center text-white shadow">
      <div className="text-xs opacity-90">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  )
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-[var(--brand-dark)]">{title}</h3>
      {children}
    </div>
  )
}

export function ErrorNotice({ error }: { error: ApiError }) {
  if (error.status === 401 || error.status === 403) {
    return <p className="text-sm text-red-600">Not authorized to view this data.</p>
  }
  return <p className="text-sm text-red-600">Failed to load: {error.message}</p>
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 py-3 text-sm">
      <button
        disabled={page === 1}
        onClick={() => onChange(1)}
        className="rounded px-2 py-1 disabled:opacity-30"
      >
        ⏮ First
      </button>
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="rounded px-2 py-1 disabled:opacity-30"
      >
        ◀ Prev
      </button>
      <span className="px-2 font-semibold text-[var(--brand-dark)]">
        Page {page} of {totalPages}
      </span>
      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded px-2 py-1 disabled:opacity-30"
      >
        Next ▶
      </button>
      <button
        disabled={page === totalPages}
        onClick={() => onChange(totalPages)}
        className="rounded px-2 py-1 disabled:opacity-30"
      >
        Last ⏭
      </button>
    </div>
  )
}

export function downloadCsv<T extends object>(filename: string, rows: T[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0]) as (keyof T)[]
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
