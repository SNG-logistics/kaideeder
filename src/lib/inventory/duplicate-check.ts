import { prisma } from '@/lib/prisma'
import { normalizeName, levenshtein, tokenOverlap } from './normalize'

export type MatchType = 'EXACT' | 'NEAR' | 'FUZZY'

export interface DuplicateCandidate {
  itemId: string
  name: string
  code: string
  score: number
  matchType: MatchType
}

interface CheckOptions {
  tenantId: string
  name: string
  /** Exclude this item from results (for update flows) */
  excludeId?: string
}

/**
 * Check for duplicate / similar inventory items.
 *
 * Match levels (in order of strictness):
 *  1. EXACT  — normalizedName is identical
 *  2. NEAR   — Levenshtein distance ≤ 2 (character-level typo)
 *  3. FUZZY  — token overlap ratio ≥ 0.80
 *
 * Returns candidates sorted by score descending, capped at 10.
 */
export async function checkDuplicates(opts: CheckOptions): Promise<DuplicateCandidate[]> {
  const { tenantId, name, excludeId } = opts
  const normalizedInput = normalizeName(name)

  // Load all active/draft items for the tenant (catalog is expected to stay manageable)
  const items = await prisma.inventoryItem.findMany({
    where: {
      tenantId,
      status: { not: 'ARCHIVED' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true, code: true, normalizedName: true },
  })

  const candidates: DuplicateCandidate[] = []

  for (const item of items) {
    const normalized = item.normalizedName

    // 1. Exact match on normalizedName
    if (normalized === normalizedInput) {
      candidates.push({
        itemId: item.id,
        name: item.name,
        code: item.code,
        score: 1.0,
        matchType: 'EXACT',
      })
      continue
    }

    // 2. Near match — Levenshtein ≤ 2
    const dist = levenshtein(normalizedInput, normalized)
    if (dist <= 2) {
      // Normalise score: 0 dist → 1.0, 1 dist → 0.92, 2 dist → 0.85
      const score = 1 - dist * 0.075
      candidates.push({ itemId: item.id, name: item.name, code: item.code, score, matchType: 'NEAR' })
      continue
    }

    // 3. Fuzzy match — token overlap ≥ 0.80
    const overlap = tokenOverlap(normalizedInput, normalized)
    if (overlap >= 0.8) {
      candidates.push({
        itemId: item.id,
        name: item.name,
        code: item.code,
        score: parseFloat(overlap.toFixed(3)),
        matchType: 'FUZZY',
      })
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 10)
}
