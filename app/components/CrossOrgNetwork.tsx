'use client'

// app/components/CrossOrgNetwork.tsx
//
// NETWORK CONNECTIONS PR 2 — ADMIN CROSS-ORG VIEW (candidate-side surface).
// Renders "who can warm-intro this candidate" across every org. Invisible when
// the candidate isn't connected to anyone (the common case), so it adds no noise
// to ordinary candidate profiles.

import { useEffect, useState } from 'react'

interface OrgGroup { org_id: string; org_name: string; employees: string[] }
interface CrossOrg { total_orgs: number; total_employees: number; orgs: OrgGroup[] }

export default function CrossOrgNetwork({ personId }: { personId: string }) {
  const [data, setData] = useState<CrossOrg | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/network/cross-org?person_id=${personId}`)
      .then((r) => r.json())
      .then((d) => { if (alive && d && !d.error) setData(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [personId])

  if (!data || data.total_orgs === 0) return null

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Network — {data.total_employees} {data.total_employees === 1 ? 'person' : 'people'} across {data.total_orgs} {data.total_orgs === 1 ? 'org' : 'orgs'}
      </h2>
      <div className="space-y-2">
        {data.orgs.map((g) => (
          <div key={g.org_id} className="flex items-start gap-3 p-3 bg-background rounded-lg">
            <div className="min-w-[140px] font-medium text-sm">{g.org_name}</div>
            <div className="text-muted-foreground text-sm">{g.employees.join(', ')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
