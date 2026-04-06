import { getAiConfig } from '@/lib/ai-config'
import { isLowSpecificity, normalizeName } from './normalize'

/** Output schema returned by the classifier */
export interface AiClassifyResult {
  suggestedRole: string | null
  suggestedKind: string | null
  suggestedCategory: string | null
  suggestedBaseUnit: string | null
  suggestedPurchaseUnit: string | null
  suggestedCode: string | null
  suggestedProteinFamily: string | null
  suggestedSpeciesType: string | null
  suggestedCutPart: string | null
  suggestedFormState: string | null
  confidenceScore: number
  warnings: string[]
  rawModelResponse: unknown
}

const CLASSIFY_SYSTEM_PROMPT = `คุณเป็น AI ผู้เชี่ยวชาญด้านการจัดหมวดหมู่วัตถุดิบในครัวและร้านอาหาร
ตอบเป็น JSON เท่านั้น ไม่ต้องมีคำอธิบายนอก JSON

โครงสร้าง JSON ที่ต้องตอบ:
{
  "item_role": "RAW|PREP|SUPPLY|SERVICE",
  "item_kind": "INGREDIENT|SEMI_FINISHED|NON_STOCK",
  "category_key": "MEAT|SEAFOOD|VEGETABLE|SAUCE|EGG|DAIRY|GRAIN|BEVERAGE|CONDIMENT|PACKAGING|OTHER",
  "protein_family": "CHICKEN|PORK|BEEF|DUCK|FISH|SHRIMP|SQUID|CRAB|OTHER|null",
  "species_type": "ชื่อสปีชีส์เฉพาะ เช่น WHITE_SHRIMP, TILAPIA หรือ null",
  "cut_part": "ส่วนที่ตัด เช่น BELLY, BREAST, THIGH, LOIN หรือ null",
  "form_state": "FRESH|FROZEN|DRIED|MINCED|MARINATED|PROCESSED|null",
  "base_unit": "หน่วยฐาน เช่น g ml egg piece pack can bottle",
  "purchase_unit": "หน่วยซื้อ เช่น kg tray bottle pack bag can หรือ null",
  "code": "รหัสแนะนำ รูปแบบ ROLE_CATEGORY_DETAIL เช่น RAW_PORK_BELLY_FRESH",
  "confidence": 0.0-1.0,
  "warnings": ["คำเตือน (array อาจว่าง)"]
}`

function buildUserPrompt(name: string, glossary: string[]): string {
  const glossaryText = glossary.length > 0 ? `\nGlossary ร้าน: ${glossary.slice(0, 30).join(', ')}` : ''
  return `ชื่อวัตถุดิบ: "${name}"${glossaryText}\nClassify รายการนี้ตาม schema ที่กำหนด`
}

function parseJsonSafe(text: string): Record<string, unknown> | null {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

/**
 * Classify an inventory item name using CometAPI.
 * Never writes to the database — caller is responsible for persisting.
 */
export async function classifyItem(name: string, glossary: string[] = []): Promise<AiClassifyResult> {
  const warnings: string[] = []

  // Pre-classify warnings
  if (isLowSpecificity(name)) {
    warnings.push('LOW_SPECIFICITY: ชื่อรายการสั้นหรือกว้างเกินไป ควรระบุให้ชัดขึ้น เช่น "หมูสามชั้นสด"')
  }

  const { apiKey, apiUrl, model } = getAiConfig()
  if (!apiKey) {
    return {
      suggestedRole: null,
      suggestedKind: null,
      suggestedCategory: null,
      suggestedBaseUnit: null,
      suggestedPurchaseUnit: null,
      suggestedCode: null,
      suggestedProteinFamily: null,
      suggestedSpeciesType: null,
      suggestedCutPart: null,
      suggestedFormState: null,
      confidenceScore: 0,
      warnings: [...warnings, 'AI_UNAVAILABLE: ไม่พบ API key'],
      rawModelResponse: null,
    }
  }

  let rawModelResponse: unknown = null
  let parsed: Record<string, unknown> | null = null

  try {
    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(name, glossary) },
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 512,
      }),
    })

    if (!response.ok) {
      throw new Error(`CometAPI error: ${response.status}`)
    }

    rawModelResponse = await response.json()
    const content = (rawModelResponse as { choices?: { message?: { content?: string } }[] })
      ?.choices?.[0]?.message?.content ?? ''

    parsed = parseJsonSafe(content)
  } catch (err) {
    console.error('[ai-classifier] CometAPI call failed:', err)
    warnings.push('AI_ERROR: ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้')
  }

  if (!parsed) {
    return {
      suggestedRole: null,
      suggestedKind: null,
      suggestedCategory: null,
      suggestedBaseUnit: null,
      suggestedPurchaseUnit: null,
      suggestedCode: null,
      suggestedProteinFamily: null,
      suggestedSpeciesType: null,
      suggestedCutPart: null,
      suggestedFormState: null,
      confidenceScore: 0,
      warnings: [...warnings, 'PARSE_ERROR: ผล AI ไม่ใช่ JSON ที่ถูกต้อง'],
      rawModelResponse,
    }
  }

  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0
  const aiWarnings = Array.isArray(parsed.warnings) ? (parsed.warnings as string[]) : []
  const allWarnings = [...warnings, ...aiWarnings]

  return {
    suggestedRole: (parsed.item_role as string) || null,
    suggestedKind: (parsed.item_kind as string) || null,
    suggestedCategory: (parsed.category_key as string) || null,
    suggestedBaseUnit: (parsed.base_unit as string) || null,
    suggestedPurchaseUnit: (parsed.purchase_unit as string) || null,
    suggestedCode: (parsed.code as string) || null,
    suggestedProteinFamily: (parsed.protein_family as string) || null,
    suggestedSpeciesType: (parsed.species_type as string) || null,
    suggestedCutPart: (parsed.cut_part as string) || null,
    suggestedFormState: (parsed.form_state as string) || null,
    confidenceScore: confidence,
    warnings: allWarnings,
    rawModelResponse,
  }
}

/** Confidence threshold below which item is marked NEED_REVIEW */
export const CONFIDENCE_REVIEW_THRESHOLD = 0.6
/** Confidence threshold below which an AiRecommendation is created */
export const CONFIDENCE_RECOMMENDATION_THRESHOLD = 0.85

/**
 * Derive the appropriate normalizeName-based glossary for a tenant.
 * Fetches the first 200 item names and aliases we already know about.
 */
export async function buildTenantGlossary(tenantId: string): Promise<string[]> {
  const { prisma } = await import('@/lib/prisma')
  const [items, aliases] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { tenantId, status: { not: 'ARCHIVED' } },
      select: { name: true },
      take: 100,
    }),
    prisma.itemAlias.findMany({
      where: { tenantId, isActive: true },
      select: { aliasName: true },
      take: 100,
    }),
  ])
  return [
    ...items.map((i) => i.name),
    ...aliases.map((a) => a.aliasName),
  ]
}
