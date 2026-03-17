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

    const clarificationNote = clarification ? `\n\nOwner's note: "${clarification}"` : ''

    // ── STEP 1: Pure culinary question — no inventory constraints ──
    const prompt = `You are a professional chef with expertise in Thai, Lao, and Asian cuisine.

A restaurant owner is asking: "What ingredients do I need to make ${menuName}?"${clarificationNote}

## YOUR JOB
List ALL ingredients needed for ONE serving of "${menuName}" based on authentic culinary knowledge.
Do NOT limit yourself to any pre-defined inventory — suggest what the dish truly requires.

## RULES
1. Think like a chef: proteins, starches, aromatics, sauces, garnishes — include them all
2. Use realistic quantities per 1 serving (not for a whole pot)
3. Write ingredient names in Thai (ภาษาไทย)
4. If the dish name is unclear or ambiguous → ask for clarification: { "question": "คำถามเป็นภาษาไทย" }
5. Respond ONLY with a valid JSON array, no markdown, no explanation:

[
  { "ingredientName": "ชื่อวัตถุดิบภาษาไทย", "quantity": 200, "unit": "g" }
]`

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
        temperature: 0.2,
        max_tokens: 800,
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

    // Parse AI response
    let chefSuggestions: { ingredientName: string; quantity: number; unit: string }[] = []
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) chefSuggestions = JSON.parse(jsonMatch[0])
    } catch {
      return err('AI ตอบผิดรูปแบบ กรุณาลองใหม่')
    }

    if (chefSuggestions.length === 0) return err('AI ไม่พบวัตถุดิบ ลองระบุชื่อเมนูให้ละเอียดขึ้น')

    // ── STEP 2: Try to match each ingredient to store's product list ──
    const allIngredients = await Promise.all(
      chefSuggestions.map(async (s) => {
        // Fuzzy match: try exact name, then partial
        const product = await prisma.product.findFirst({
          where: { tenantId, name: { equals: s.ingredientName }, isActive: true },
          select: { id: true, name: true, unit: true },
        }) || await prisma.product.findFirst({
          where: { tenantId, name: { contains: s.ingredientName.slice(0, 4) }, isActive: true },
          select: { id: true, name: true, unit: true },
        })

        // Find appropriate location
        const location = await prisma.location.findFirst({
          where: { tenantId, isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        })

        return {
          ingredientName: s.ingredientName,
          quantity: s.quantity,
          unit: product?.unit || s.unit,
          productId: product?.id || null,
          productName: product?.name || s.ingredientName,
          locationId: location?.id || null,
          locationCode: location?.code || defaultLocation,
          found: !!product && !!location,
        }
      })
    )

    // All ingredients back as suggestions — matched ones become BOM rows, unmatched become items to add
    const suggestions = allIngredients.filter(e => e.found).map(e => ({
      productId: e.productId,
      locationId: e.locationId,
      quantity: e.quantity,
      unit: e.unit,
    }))

    const missingIngredients = allIngredients.filter(e => !e.found).map(e => ({
      name: e.ingredientName,
      quantity: e.quantity,
      unit: e.unit,
      location: defaultLocation,
    }))

    return ok({
      type: 'bom',
      menuName,
      suggestions,
      missingIngredients,
      // Full list for reference (ingredientName pre-filled for UI)
      allIngredients: allIngredients.map(e => ({
        ingredientName: e.ingredientName,
        productId: e.productId,
        locationId: e.locationId,
        quantity: e.quantity,
        unit: e.unit,
        found: e.found,
      })),
      rawResponse: content,
    })

  } catch (error) {
    console.error('AI suggest error:', error)
    return err('เกิดข้อผิดพลาดในการเชื่อมต่อ AI')
  }
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])
