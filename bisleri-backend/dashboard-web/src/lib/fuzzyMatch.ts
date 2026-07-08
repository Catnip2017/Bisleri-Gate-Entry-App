// Lightweight subsequence-based fuzzy match — lets "and mum" match
// "BIPL- ANDHERI -NEW PLANMUM" without needing contiguous substrings.
// Returns a score (lower = better match) or null if no match at all.
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.trim().toLowerCase()
  const t = target.toLowerCase()
  if (!q) return 0

  // Fast path: plain substring match scores best (tightest match).
  const idx = t.indexOf(q)
  if (idx !== -1) return idx

  // Subsequence match: every character of q appears in order in t.
  let qi = 0
  let firstMatch = -1
  let lastMatch = -1
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (firstMatch === -1) firstMatch = ti
      lastMatch = ti
      qi++
    }
  }
  if (qi < q.length) return null // not all query chars found, in order

  // Score by how spread out the match is — tighter matches rank higher.
  return 1000 + (lastMatch - firstMatch)
}

export function fuzzyFilter<T>(query: string, items: T[], getLabel: (item: T) => string): T[] {
  if (!query.trim()) return items
  return items
    .map((item) => ({ item, score: fuzzyScore(query, getLabel(item)) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score)
    .map((r) => r.item)
}
