import { NextRequest } from 'next/server'
import { withAuth, ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { getAiConfig } from '@/lib/ai-config'

/**
 * POST /api/ai/suggest-bom
 * Body: { menuName, clarification?, debug? }
 */
export const POST = withAuth(async (req: NextRequest, ctx: any) => {
  try {
    const { tenantId } = ctx
    const body = await req.json()
    const { menuName, clarification, debug } = body as { menuName?: string; clarification?: string; debug?: boolean }
    if (!menuName) return err('กรุณาระบุชื่อเมนู')

    const { apiKey, apiUrl, model } = getAiConfig()
    if (!apiKey) return err('ไม่พบ COMET_API_KEY ใน .env')

    // ── Tenant-scoped data ─────────────────────────────────────
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, displayName: true },
    })
    const storeName = tenant?.displayName || tenant?.name || 'ร้านอาหาร'

    // Products scoped to THIS tenant only
    const rawMaterials = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      select: { sku: true, name: true, unit: true, productType: true },
      orderBy: { name: 'asc' },
    })

    const locations = await prisma.location.findMany({
      where: { tenantId, isActive: true },
      select: { code: true, name: true },
    })

    const existingRecipes = await prisma.recipe.findMany({
      take: 20,
      where: { tenantId, isActive: true },
      select: {
        menuName: true,
        bom: { select: { quantity: true, unit: true, product: { select: { sku: true, name: true } } } },
      },
    })

    const materialList = rawMaterials.length > 0
      ? rawMaterials.map(p => `- [${p.sku}] ${p.name} (${p.unit}) [${p.productType}]`).join('\n')
      : '(ยังไม่มีวัตถุดิบในระบบ)'

    const locationList = locations.map(l => l.code).join(', ') || 'MAIN'
    const defaultLocation = locations[0]?.code || 'MAIN'

    const existingList = existingRecipes.length > 0
      ? existingRecipes.map(r =>
          `  "${r.menuName}": ${r.bom.map((b: { product: { sku: string; name: string }; quantity: number; unit: string }) =>
            `[${b.product.sku}] ${b.product.name} x${b.quantity}${b.unit}`).join(', ')}`
        ).join('\n')
      : '  (ยังไม่มีสูตรในระบบ)'

    const clarificationNote = clarification ? `\nข้อมูลเพิ่มเติมจากเจ้าของร้าน: "${clarification}"` : ''

    const prompt = `คุณเป็น chef มืออาชีพ ผู้เชี่ยวชาญสูตรอาหารไทย-ลาว ของร้าน "${storeName}"

===== SKU วัตถุดิบในระบบ (ใช้ MATCH เท่านั้น) =====
${materialList}

===== Locations ที่ใช้ตัดสต็อค =====
${locationList}
(ใช้ location ที่เหมาะสมกับวัตถุดิบ เช่น ครัว=KIT_STOCK, บาร์=BAR_STOCK, คลังหลัก=${defaultLocation})

===== สูตรที่บันทึกแล้ว (อ้างอิง style) =====
${existingList}

===== เมนูที่ต้องการ BOM =====
"${menuName}"${clarificationNote}

===== กฎการสร้าง BOM =====

[กฎ 1] คิดสูตรจากความรู้ครัวก่อน แล้วค่อย match SKU — ห้ามใส่วัตถุดิบที่เมนูนั้นไม่ได้ใช้จริง

[กฎ 2] Match ด้วย SKU ที่ให้มาเท่านั้น ถ้าไม่มีใน DB → ใช้ "NOT_FOUND:ชื่อวัตถุดิบ" เป็น sku

[กฎ 3] ปริมาณต่อ 1 จาน/เสิร์ฟ ควรสมเหตุสมผล:
  - ข้าวสวย: 200-250g / มื้อ
  - เนื้อสัตว์หลัก: 150-300g / จาน
  - เครื่องปรุง: 5-30g / จาน

[กฎ 4] ถ้าเมนูไม่ชัดเจนหรือต้องการข้อมูลเพิ่ม → ถามกลับแทนการเดา

[กฎ 5] เลือก location ให้เหมาะสม:
  - วัตถุดิบครัว → KIT_STOCK (ถ้ามี) หรือ ${defaultLocation}
  - เครื่องดื่ม/บาร์ → BAR_STOCK (ถ้ามี) หรือ ${defaultLocation}
  - ของแห้ง → WH_MAIN หรือ ${defaultLocation}

ตอบ JSON array เท่านั้น (ไม่มี markdown):
[
  { "sku": "SKU_หรือ_NOT_FOUND:ชื่อ", "ingredientName": "ชื่อวัตถุดิบ", "quantity": 250, "unit": "g", "location": "${defaultLocation}" }
]
หรือถ้าไม่แน่ใจ: { "question": "คำถาม" }`

    if (debug) {
      return ok({ type: 'debug', prompt, menuName, storeName, locationList })
    }

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: 0.1,
        max_tokens: 1200,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('AI API error:', errText)
      return err(`AI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = (data.choices?.[0]?.message?.content || '').trim()

    // AI asking clarification
    const qMatch = content.match(/\{\s*"question"\s*:\s*"([^"]+)"\s*\}/)
    if (qMatch) return ok({ type: 'question', question: qMatch[1], menuName })

    let bomSuggestions: { sku: string; ingredientName?: string; quantity: number; unit: string; location: string }[] = []
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) bomSuggestions = JSON.parse(jsonMatch[0])
    } catch {
      return err('AI ตอบผิดรูปแบบ กรุณาลองใหม่')
    }

    if (bomSuggestions.length === 0) return err('AI ไม่พบวัตถุดิบ ลองระบุชื่อเมนูให้ละเอียดขึ้น')

    const allIngredients = await Promise.all(
      bomSuggestions.map(async (b) => {
        const isMissing = b.sku.startsWith('NOT_FOUND:')
        const ingredientName = isMissing
          ? (b.ingredientName || b.sku.replace('NOT_FOUND:', '').trim())
          : (b.ingredientName || b.sku)

        if (isMissing) {
          return {
            sku: b.sku, ingredientName, productId: null, productName: ingredientName,
            locationId: null, locationCode: b.location,
            quantity: b.quantity, unit: b.unit,
            found: false, missing: true,
          }
        }

        // Tenant-scoped product lookup
        const product = await prisma.product.findFirst({
          where: { tenantId, sku: b.sku },
          select: { id: true, name: true, unit: true },
        })
        // Tenant-scoped location lookup
        const location = await prisma.location.findFirst({
          where: { tenantId, code: b.location },
        })
        // Fallback to any active location for this tenant
        const fallbackLocation = location || await prisma.location.findFirst({
          where: { tenantId, isActive: true },
        })

        return {
          sku: b.sku, ingredientName: product?.name || ingredientName,
          productId: product?.id || null, productName: product?.name || b.sku,
          locationId: fallbackLocation?.id || null, locationCode: fallbackLocation?.code || b.location,
          quantity: b.quantity, unit: b.unit || product?.unit || 'g',
          found: !!product && !!fallbackLocation,
          missing: false,
        }
      })
    )

    return ok({
      type: 'bom', menuName,
      suggestions: allIngredients.filter(e => e.found),
      notFound: allIngredients.filter(e => !e.found && !e.missing).map(e => e.sku),
      missingIngredients: allIngredients
        .filter(e => e.missing)
        .map(e => ({ name: e.ingredientName, quantity: e.quantity, unit: e.unit, location: e.locationCode })),
      allIngredients: allIngredients.map(e => ({
        ingredientName: e.ingredientName, sku: e.sku,
        quantity: e.quantity, unit: e.unit, location: e.locationCode,
        found: e.found, missing: e.missing,
        productId: e.productId, locationId: e.locationId,
      })),
      rawResponse: content,
    })

  } catch (error) {
    console.error('AI suggest error:', error)
    return err('เกิดข้อผิดพลาดในการเชื่อมต่อ AI')
  }
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])
