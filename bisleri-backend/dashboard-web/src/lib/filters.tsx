import { createContext, useContext, useState, type ReactNode } from 'react'

export interface DateRange {
  start: string | null // YYYY-MM-DD
  end: string | null
}

interface FilterState {
  selectedWarehouses: string[]
  setSelectedWarehouses: (w: string[]) => void
  dateRange: DateRange
  setDateRange: (r: DateRange) => void
}

const FilterContext = createContext<FilterState | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null })

  return (
    <FilterContext.Provider
      value={{ selectedWarehouses, setSelectedWarehouses, dateRange, setDateRange }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilters must be used within FilterProvider')
  return ctx
}
