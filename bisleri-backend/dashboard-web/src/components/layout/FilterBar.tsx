import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../lib/auth'
import { apiFetch } from '../../lib/api'
import { useFilters } from '../../lib/filters'
import { fuzzyFilter } from '../../lib/fuzzyMatch'

// Global filter bar — warehouse multiselect shared across every tab (see
// plan: tab-specific filters like vehicle no / doc type stay local to each
// tab, but warehouse scope is shared here). A dropdown + search instead of a
// flat chip list, since the warehouse count will only grow over time.
export default function FilterBar() {
  const { token } = useAuth()
  const { selectedWarehouses, setSelectedWarehouses, dateRange, setDateRange } = useFilters()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: warehouses = [] } = useQuery({
    queryKey: ['filters', 'warehouses'],
    queryFn: () => apiFetch<string[]>('/filters/warehouses', token),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })

  const filtered = useMemo(
    () => fuzzyFilter(search, warehouses, (w) => w),
    [search, warehouses],
  )

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const toggle = (w: string) => {
    setSelectedWarehouses(
      selectedWarehouses.includes(w)
        ? selectedWarehouses.filter((x) => x !== w)
        : [...selectedWarehouses, w],
    )
  }

  const summary =
    selectedWarehouses.length === 0
      ? `All ${warehouses.length} warehouses`
      : selectedWarehouses.length === 1
        ? selectedWarehouses[0]
        : `${selectedWarehouses.length} / ${warehouses.length} warehouses`

  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-[var(--border)] bg-white px-4 py-3">
      <div ref={containerRef} className="relative inline-block w-full max-w-sm">
        <span className="mb-1 block text-xs font-semibold text-[var(--brand-dark)]">
          🏭 Warehouse
        </span>

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-left text-sm text-[var(--ink)] shadow-sm hover:border-[var(--brand-mid)]"
        >
          <span className="truncate">{summary}</span>
          <span className="ml-2 shrink-0 text-[var(--muted)]">{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div className="absolute z-40 mt-1 w-full rounded-lg border border-[var(--border)] bg-white shadow-lg">
            <div className="border-b border-[var(--border)] p-2">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search warehouses…"
                className="w-full rounded border border-[var(--border)] px-2 py-1 text-sm outline-none focus:border-[var(--brand-mid)]"
              />
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5 text-xs">
              <button
                onClick={() => setSelectedWarehouses([])}
                className="font-semibold text-[var(--brand)] hover:underline"
              >
                Clear (all warehouses)
              </button>
              <button
                onClick={() => setSelectedWarehouses(filtered)}
                className="font-semibold text-[var(--brand)] hover:underline"
              >
                Select all shown
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-[var(--muted)]">No warehouses match “{search}”</div>
              )}
              {filtered.map((w) => (
                <label
                  key={w}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-[var(--brand-tint-2)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedWarehouses.includes(w)}
                    onChange={() => toggle(w)}
                    className="accent-[var(--brand)]"
                  />
                  <span className="truncate">{w}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <span className="mb-1 block text-xs font-semibold text-[var(--brand-dark)]">📅 From</span>
        <input
          type="date"
          value={dateRange.start ?? ''}
          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value || null })}
          className="rounded-lg border border-[var(--border)] px-2 py-2 text-sm outline-none focus:border-[var(--brand-mid)]"
        />
      </div>

      <div>
        <span className="mb-1 block text-xs font-semibold text-[var(--brand-dark)]">📅 To</span>
        <input
          type="date"
          value={dateRange.end ?? ''}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value || null })}
          className="rounded-lg border border-[var(--border)] px-2 py-2 text-sm outline-none focus:border-[var(--brand-mid)]"
        />
      </div>

      {(dateRange.start || dateRange.end) && (
        <button
          onClick={() => setDateRange({ start: null, end: null })}
          className="rounded-full bg-[var(--brand-tint-2)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--brand-tint)]"
        >
          Clear dates
        </button>
      )}
    </div>
  )
}
