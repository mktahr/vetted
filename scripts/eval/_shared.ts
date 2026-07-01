// scripts/eval/_shared.ts — side-effect-free helpers shared by the eval scripts.

export const csvCell = (v:any)=>{ const s=String(v??''); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s }
export const arrJoin = (a:any)=> Array.isArray(a)? a.join('; ') : ''

// Stratified sort: walk tiers (0=top .. 2=bottom), round-robin across disciplines
// within each tier so the top of the sheet spans every flavor.
export function stratify(rows:any[]):any[] {
  const out:any[] = []
  const tiers = [...new Set(rows.map(r=>r.tier))].sort((a,b)=>a-b)
  for (const tier of tiers) {
    const byDisc = new Map<string, any[]>()
    for (const r of rows.filter(r=>r.tier===tier)) { if(!byDisc.has(r.discipline)) byDisc.set(r.discipline,[]); byDisc.get(r.discipline)!.push(r) }
    const queues=[...byDisc.values()]; let live=true
    while(live){ live=false; for(const q of queues){ if(q.length){ out.push(q.shift()); live=true } } }
  }
  return out
}
