import { useState } from 'react'
import DocumentTat from './DocumentTat'
import VehicleTat from './VehicleTat'

const SUB_TABS = [
  { key: 'document', label: '📄 Document TAT' },
  { key: 'vehicle', label: '🚛 Vehicle TAT' },
] as const

export default function TatPage() {
  const [active, setActive] = useState<(typeof SUB_TABS)[number]['key']>('document')

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

      {active === 'document' ? <DocumentTat /> : <VehicleTat />}
    </div>
  )
}
