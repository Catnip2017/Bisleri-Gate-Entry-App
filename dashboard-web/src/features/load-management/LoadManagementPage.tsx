import { useState } from 'react'
import VehiclesView from './VehiclesView'
import WarehouseView from './WarehouseView'
import LoadAnalytics from './LoadAnalytics'

const SUB_TABS = [
  { key: 'analytics', label: '📊 Load Analytics' },
  { key: 'vehicles', label: '🚗 Vehicles View' },
  { key: 'warehouse', label: '🏭 Warehouse View' },
] as const

export default function LoadManagementPage() {
  const [active, setActive] = useState<(typeof SUB_TABS)[number]['key']>('analytics')

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-[var(--border)]">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 text-sm font-semibold ${
              active === tab.key
                ? 'border-b-2 border-[var(--brand)] text-[var(--brand-dark)]'
                : 'text-[var(--muted)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'vehicles' && <VehiclesView />}
      {active === 'warehouse' && <WarehouseView />}
      {active === 'analytics' && <LoadAnalytics />}
    </div>
  )
}
