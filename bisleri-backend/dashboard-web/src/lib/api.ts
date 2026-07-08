// Thin fetch wrapper for /dashboard-api/*. No query logic lives here or
// anywhere else in this app — every endpoint just returns JSON the backend
// already aggregated; this file only shapes the HTTP call and error type.

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, token: string | null): Promise<T> {
  const res = await fetch(`/dashboard-api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      // ignore — use statusText
    }
    throw new ApiError(res.status, detail)
  }

  return res.json() as Promise<T>
}

export function withWarehouses(path: string, warehouses: string[]): string {
  if (warehouses.length === 0) return path
  const params = new URLSearchParams()
  for (const w of warehouses) params.append('warehouses', w)
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}${params.toString()}`
}

// General-purpose query builder: warehouses (repeated param) + date range +
// any extra scalar params (vehicle_no, document_no, site, page, etc).
export function buildQuery(
  path: string,
  opts: {
    warehouses?: string[]
    dateRange?: { start: string | null; end: string | null }
    extra?: Record<string, string | number | string[] | null | undefined>
  },
): string {
  const params = new URLSearchParams()

  for (const w of opts.warehouses ?? []) params.append('warehouses', w)

  if (opts.dateRange?.start) params.append('start_date', opts.dateRange.start)
  if (opts.dateRange?.end) params.append('end_date', opts.dateRange.end)

  for (const [key, value] of Object.entries(opts.extra ?? {})) {
    if (value === null || value === undefined || value === '') continue
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v)
    } else {
      params.append(key, String(value))
    }
  }

  const qs = params.toString()
  if (!qs) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}${qs}`
}

// ── Overview Analytics response shapes ──────────────────────────────────────

export interface OverviewStats {
  total_trips: number
  total_vehicles: number
  total_gate_entries: number
  gate_in_count: number
  gate_out_count: number
  total_warehouses: number
  last_updated: string | null
}

export interface DocumentTypeStat {
  document_type: string
  trip_count: number
}

export interface OwnershipStat {
  ownership_type: string
  vehicle_count: number
}

export interface MovementStat {
  movement_type: string
  trip_count: number
}

export interface DailyTrendPoint {
  trip_date: string
  trip_count: number
  gate_in: number
  gate_out: number
}

export interface MonthlyTrendPoint {
  trip_month: string
  trip_count: number
}

export interface WarehouseDistributionRow {
  warehouse_name: string
  trip_count: number
  gate_in: number
  gate_out: number
}

export interface HeatmapCell {
  day_of_week: number
  hour_of_day: number
  trip_count: number
}

// ── Turn Around Time response shapes ────────────────────────────────────────

export interface DateRangeBounds {
  min_date: string | null
  max_date: string | null
}

export interface DocumentTatRow {
  gate_entry_no: string
  gate_entry_datetime: string
  document_no: string
  document_type: string
  document_entry_datetime: string | null
  vehicle_no: string
  driver_name: string | null
  warehouse_name: string
  site_code: string
  tat_minutes: number
  avg_turn: string
}

export interface VehicleTatRow {
  warehouse_code: string
  warehouse_name: string
  vehicle_no: string
  entry_gate_no: string
  entry_datetime: string
  exit_gate_no: string | null
  exit_datetime: string | null
  loading_time_minutes: number
  total_time: string
  documents_in_entry: number
  documents_in_exit: number
  is_still_inside: boolean
}

export interface PaginatedResult<T> {
  data: T[]
  total_count: number
}

export interface TatAverage {
  avg_minutes: number
}

export interface TatBoxplotRow {
  warehouse_name: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

export interface TatTrendPoint {
  entry_date: string
  avg_minutes: number
  record_count: number
}

export interface TatSlaBreach {
  threshold_minutes: number
  breach_count: number
  total_count: number
  breach_pct: number
}

// ── Load Management response shapes ─────────────────────────────────────────

export interface LoadStats {
  total_trips: number
  total_vehicles: number
  avg_load: number
  overloaded_count: number
  total_weight_moved: number
  avg_weight_per_trip: number
  gate_in_count: number
  gate_out_count: number
  zero_weight_trips: number
  last_updated: string | null
}

export interface LoadTripRow {
  id: number
  vehicle_no: string
  gate_entry_no: string
  date: string
  time: string
  warehouse_name: string
  total_weight_kg: number
  maximum_load_kg: number
  load_percentage: number
  movement_type: string
}

export interface ScatterRow {
  vehicle_no: string
  capacity_kg: number
  avg_weight_kg: number
  trip_count: number
  overloaded_count: number
}

export interface RepeatOffenderRow {
  vehicle_no: string
  total_trips: number
  overloaded_count: number
  avg_load: number
}

export interface WarehouseAnalytics {
  total_trips: number
  unique_vehicles: number
  avg_load_percent: number
  total_weight_moved: number
  avg_weight_per_trip: number
  overloaded_trips: number
  inward_count: number
  outward_count: number
  zero_weight_trips: number
}

export interface VehicleStats {
  total_trips: number
  avg_load: number
  max_load: number
  min_load: number
  avg_weight: number
  max_weight: number
  vehicle_capacity: number
  overloaded_count: number
}

// ── Loader Details response shapes ──────────────────────────────────────────

export interface LoaderStats {
  total_entries: number
  unique_vehicles: number
  total_loaders: number | null
  avg_loaders_per_entry: number | null
  company_owned_count: number
  hired_count: number
}

export interface LoaderDetailRow {
  gate_entry_no: string
  gate_entry_datetime: string
  vehicle_no: string
  vehicle_type: string
  security_name: string | null
  driver_name: string | null
  loader_names: string | null
  loader_count: number
  document_types: string | null
  movement_type: string
  warehouse_name: string
  site_code: string
}

export interface LoadersPerWarehouseRow {
  warehouse_name: string
  avg_loaders: number
  entry_count: number
}

export interface OwnershipTrendPoint {
  entry_date: string
  company_owned_count: number
  hired_count: number
}
