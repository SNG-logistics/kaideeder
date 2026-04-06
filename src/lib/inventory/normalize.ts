/**
 * Inventory name normalization utilities.
 * Used for soft duplicate detection – NOT a hard uniqueness constraint.
 */

/** Thai characters that look like spaces or are zero-width */
const THAI_WHITESPACE_RE = /[\u200b\u200c\u200d\ufeff\u00a0]+/g

/** Remove punctuation that doesn't change meaning */
const PUNCT_RE = /[!@#$%^&*()\-_+=\[\]{}|;:'",.<>?/\\`~]/g

/**
 * Normalize an inventory item name for duplicate comparison.
 * - Lowercases ASCII
 * - Collapses all whitespace (including Thai zero-width) to single space
 * - Removes common punctuation
 * - Trims
 */
export function normalizeName(name: string): string {
  return name
    .replace(THAI_WHITESPACE_RE, ' ')
    .replace(PUNCT_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Compute a simple token-set overlap ratio between two normalized strings.
 * Returns 0–1 where 1 = identical token sets.
 */
export function tokenOverlap(a: string, b: string): number {
  const tokA = new Set(a.split(' ').filter(Boolean))
  const tokB = new Set(b.split(' ').filter(Boolean))
  if (tokA.size === 0 && tokB.size === 0) return 1
  if (tokA.size === 0 || tokB.size === 0) return 0
  let intersection = 0
  for (const t of tokA) if (tokB.has(t)) intersection++
  return intersection / Math.max(tokA.size, tokB.size)
}

/**
 * Levenshtein edit distance between two strings (character-level).
 * Used for near-duplicate detection.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/** Names shorter than or equal to this threshold may indicate generic/vague naming */
const LOW_SPECIFICITY_NAMES = new Set([
  'ปลา', 'กุ้ง', 'หมู', 'ไก่', 'เนื้อ', 'ผัก', 'เห็ด', 'ไข่',
  'น้ำ', 'น้ำมัน', 'แป้ง', 'ข้าว', 'เส้น', 'soup', 'meat', 'fish',
])

export function isLowSpecificity(name: string): boolean {
  const norm = normalizeName(name)
  return norm.length <= 3 || LOW_SPECIFICITY_NAMES.has(norm)
}
