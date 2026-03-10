/**
 * lib/sku-matcher.ts
 * Auto-map scoring engine for import pipeline (Phase 2 / TASK-3)
 *
 * Score = 60% name_similarity + 20% unit_compatibility + 20% category_proximity
 * Thresholds:
 *   ≥ 0.85 → AUTO  (mapped immediately)
 *   0.60–0.84 → REVIEW  (SkuSuggestion with matchedProductId)
 *   < 0.60 → SUGGEST_NEW (SkuSuggestion without matchedProductId)
 */

// ── Normalization ──────────────────────────────────────────────────────────────

export function normalizeName(s: string): string {
    return (s ?? '')
        .toLowerCase()
        .trim()
        .replace(/[()[\]_/.,|:;'"]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

// ── Bigram Dice Coefficient similarity ────────────────────────────────────────

function bigrams(s: string): Set<string> {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) {
        set.add(s.slice(i, i + 2))
    }
    return set
}

export function similarity(a: string, b: string): number {
    const na = normalizeName(a)
    const nb = normalizeName(b)
    if (na === nb) return 1.0
    if (na.length < 2 || nb.length < 2) return 0.0

    // exact substring bonus
    if (na.includes(nb) || nb.includes(na)) {
        const longer = Math.max(na.length, nb.length)
        const shorter = Math.min(na.length, nb.length)
        return 0.7 + 0.3 * (shorter / longer)
    }

    const ba = bigrams(na)
    const bb = bigrams(nb)
    let intersection = 0
    for (const bg of ba) {
        if (bb.has(bg)) intersection++
    }
    return (2 * intersection) / (ba.size + bb.size)
}

// ── Unit Compatibility ─────────────────────────────────────────────────────────

// Groups of interchangeable / related units
const UNIT_GROUPS: string[][] = [
    ['kg', 'กก', 'กก.', 'kilogram', 'กิโลกรัม', 'กิโล'],
    ['g', 'กรัม', 'gram'],
    ['l', 'ล', 'ลิตร', 'litre', 'liter'],
    ['ml', 'มล', 'มล.', 'milliliter', 'ซีซี', 'cc'],
    ['ขวด', 'bottle', 'btl'],
    ['กระป๋อง', 'can', 'กป๋อง'],
    ['ถุง', 'bag', 'ซอง', 'pack', 'แพ็ค', 'แพ็ก'],
    ['กล่อง', 'box', 'กล.'],
    ['จาน', 'plate', 'dish'],
    ['ชิ้น', 'piece', 'pcs', 'pc'],
    ['อัน', 'unit'],
    ['ทาวเวอร์', 'tower'],
    ['ถัง', 'bucket', 'barrel'],
]

function unitGroup(unit: string): number {
    const u = (unit ?? '').toLowerCase().trim()
    for (let i = 0; i < UNIT_GROUPS.length; i++) {
        if (UNIT_GROUPS[i].includes(u)) return i
    }
    return -1
}

export function unitCompatible(a: string, b: string): number {
    if (!a || !b) return 0.5  // unknown → neutral
    const ua = (a).toLowerCase().trim()
    const ub = (b).toLowerCase().trim()
    if (ua === ub) return 1.0
    const ga = unitGroup(ua)
    const gb = unitGroup(ub)
    if (ga === -1 || gb === -1) return 0.2  // unknown group
    if (ga === gb) return 1.0
    // kg ↔ g are mass-compatible
    const massGroups = [unitGroup('kg'), unitGroup('g')]
    if (massGroups.includes(ga) && massGroups.includes(gb)) return 0.8
    // l ↔ ml are volume-compatible
    const volGroups = [unitGroup('l'), unitGroup('ml')]
    if (volGroups.includes(ga) && volGroups.includes(gb)) return 0.8
    return 0.0
}

// ── Category Proximity ─────────────────────────────────────────────────────────

const CAT_GROUP: Record<string, string> = {
    PROTEIN_PORK: 'INGREDIENT', PROTEIN_MEAT: 'INGREDIENT', SEAFOOD: 'INGREDIENT',
    EGG: 'INGREDIENT', DAIRY: 'INGREDIENT', VEGHERB: 'INGREDIENT',
    MUSHROOM: 'INGREDIENT', DRY_GOODS: 'INGREDIENT', FROZEN: 'INGREDIENT',
    BOX_BAG: 'SUPPLY', TISSUE_CLEAN: 'SUPPLY', DISPOSABLE: 'SUPPLY',
    BEER: 'SALE_ALCOHOL', BEER_DRAFT: 'SALE_ALCOHOL', WINE: 'SALE_ALCOHOL', SOJU: 'SALE_ALCOHOL',
    WATER: 'SALE_NON_ALCOHOL', SOFT_DRINK: 'SALE_NON_ALCOHOL',
    COFFEE: 'SALE_CAFE', TEA: 'SALE_CAFE', SMOOTHIE: 'SALE_CAFE',
    FOOD_GRILL: 'FOOD', FOOD_FRY: 'FOOD', FOOD_BOIL: 'FOOD', FOOD_SALAD: 'FOOD',
    FOOD_STIR: 'FOOD', FOOD_SNACK: 'FOOD', FOOD_SEA: 'FOOD', FOOD_RICE: 'FOOD',
    SET: 'OTHER', KARAOKE: 'OTHER', ENTERTAIN: 'OTHER', OTHER: 'OTHER',
}

export function categoryProximity(codeA: string, codeB: string): number {
    if (!codeA || !codeB) return 0.5
    if (codeA === codeB) return 1.0
    const gA = CAT_GROUP[codeA] ?? 'OTHER'
    const gB = CAT_GROUP[codeB] ?? 'OTHER'
    return gA === gB ? 0.5 : 0.0
}

// ── Composite Score ────────────────────────────────────────────────────────────

export interface MatchCandidate {
    productId: string
    sku: string
    name: string
    unit: string
    categoryCode: string
    aliases: string[]   // all known aliases for this product
}

export interface MatchResult {
    productId: string
    sku: string
    score: number
    nameSim: number
    unitSim: number
    catSim: number
    verdict: 'AUTO' | 'REVIEW' | 'SUGGEST_NEW'
}

export function scoreMatch(
    rawName: string,
    rawUnit: string,
    rawCategoryCode: string,
    candidate: MatchCandidate
): MatchResult {
    // Best name similarity across product name + all aliases
    const targets = [candidate.name, ...candidate.aliases]
    const nameSim = Math.max(...targets.map(t => similarity(rawName, t)))
    const unitSim = unitCompatible(rawUnit, candidate.unit)
    const catSim = categoryProximity(rawCategoryCode, candidate.categoryCode)

    const score = 0.60 * nameSim + 0.20 * unitSim + 0.20 * catSim

    const verdict: 'AUTO' | 'REVIEW' | 'SUGGEST_NEW' =
        score >= 0.85 ? 'AUTO' :
            score >= 0.60 ? 'REVIEW' :
                'SUGGEST_NEW'

    return { productId: candidate.productId, sku: candidate.sku, score, nameSim, unitSim, catSim, verdict }
}

/** Find best match from a pool of candidates */
export function findBestMatch(
    rawName: string,
    rawUnit: string,
    rawCategoryCode: string,
    candidates: MatchCandidate[]
): MatchResult | null {
    if (candidates.length === 0) return null

    const scored = candidates
        .map(c => scoreMatch(rawName, rawUnit, rawCategoryCode, c))
        .sort((a, b) => b.score - a.score)

    const best = scored[0]
    // Minimum threshold to even be considered
    return best.score >= 0.40 ? best : null
}

// ── Auto-unit detection ────────────────────────────────────────────────────────

/** Keywords → unit. Evaluated in order (first match wins). */
const UNIT_KEYWORD_MAP: [RegExp, string][] = [
    [/กระป๋อง|can\b/i,                  'กระป๋อง'],
    [/ขวด|btl|bottle/i,                  'ขวด'],
    [/ทาวเวอร์|tower/i,                  'ทาวเวอร์'],
    [/แผ่น|sheet|slice/i,                'แผ่น'],
    [/ก้อน|block/i,                      'ก้อน'],
    [/แพ็ค|pack\b|แพ็ก/i,               'แพ็ค'],
    [/ถุง|bag\b|ซอง/i,                   'ถุง'],
    [/กล่อง|box\b/i,                     'กล่อง'],
    [/แก้ว|glass\b/i,                    'แก้ว'],
    [/ชิ้น|piece|pcs/i,                  'ชิ้น'],
    [/ฟอง|ไข่/i,                         'ฟอง'],
    [/กำ|bunch/i,                        'กำ'],
    [/หัว|head\b/i,                      'หัว'],
    [/ลูก|fruit\b/i,                     'ลูก'],
    [/ต้น|stalk/i,                       'ต้น'],
    [/เข่ง|basket/i,                     'เข่ง'],
    [/ถัง|bucket|barrel/i,               'ถัง'],
    [/ชั่วโมง|hour\b|คน|person|room/i,   'ชั่วโมง'],  // service — will also be filtered
    [/กก\.|กิโล|kg\b|kilogram/i,         'กก.'],
    [/กรัม|\bg\b|gram/i,                 'กรัม'],
    [/ลิตร|litre|liter|\bl\b/i,          'ลิตร'],
    [/มล\.|ml\b|milliliter|ซีซี|cc\b/i, 'มล.'],
]

/**
 * Guess the most appropriate unit from the product name.
 * Returns `fallback` if nothing matches.
 */
export function guessUnit(name: string, fallback = 'กก.'): string {
    const n = (name ?? '').toLowerCase()
    for (const [re, unit] of UNIT_KEYWORD_MAP) {
        if (re.test(n)) return unit
    }
    return fallback
}

// ── Exclude-from-stock filter ────────────────────────────────────────────────

/** Category names / codes that should NEVER appear in a stock import */
const EXCLUDE_CATEGORY_SET = new Set([
    // codes
    'BEER', 'BEER_DRAFT', 'WINE', 'SOJU',
    'WATER', 'SOFT_DRINK',
    'COFFEE', 'TEA', 'SMOOTHIE',
    'ENTERTAIN', 'KARAOKE', 'SET',
    // Thai names (from category.name)
    'เบียร์ขวด/กระป๋อง', 'เบียร์สด/ทาวเวอร์',
    'ไวน์/สุรา/วิสกี้', 'โซจู',
    'น้ำอัดลม/มิกเซอร์', 'น้ำดื่ม/น้ำแข็ง',
    'กาแฟ', 'ชา/โกโก้', 'โซดาผสม/น้ำผลไม้/ปั่น',
    'Entertain/PR',
])

/** Name-level keywords that indicate a service / non-stock item */
const EXCLUDE_NAME_RE = /ชั่วโมง|เหมา|ค่าเอ็น|แตก|แจกฟรี|ค่าเปิด|ค่าขวด|โปร\b|ทาวเวอร์|tower/i

/**
 * Returns true if this item should be EXCLUDED from stock import.
 * @param name  product name from bill / sheet
 * @param category  category name or code string (can be empty)
 */
export function shouldExcludeFromStock(name: string, category = ''): boolean {
    if (EXCLUDE_CATEGORY_SET.has(category.trim())) return true
    if (EXCLUDE_NAME_RE.test(name)) return true
    return false
}

