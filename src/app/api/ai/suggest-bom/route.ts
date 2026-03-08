import { NextRequest } from 'next/server'
import { withAuth, ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { getAiConfig } from '@/lib/ai-config'

/**
 * POST /api/ai/suggest-bom
 * Body: { menuName, clarification?, debug? }
 */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { menuName, clarification, debug } = body as { menuName?: string; clarification?: string; debug?: boolean }
    if (!menuName) return err('กรุณาระบุชื่อเมนู')

    const { apiKey, apiUrl, model } = getAiConfig()
    if (!apiKey) return err('ไม่พบ COMET_API_KEY ใน .env')

    const rawMaterials = await prisma.product.findMany({
      where: { isActive: true },
      select: { sku: true, name: true, unit: true, productType: true },
      orderBy: { name: 'asc' }
    })

    const existingRecipes = await prisma.recipe.findMany({
      take: 30,
      where: { isActive: true },
      select: {
        menuName: true,
        bom: { select: { quantity: true, unit: true, product: { select: { sku: true, name: true } } } }
      }
    })

    const materialList = rawMaterials.map(p => `- [${p.sku}] ${p.name} (${p.unit})`).join('\n')
    const existingList = existingRecipes.length > 0
      ? existingRecipes.map(r =>
        `  "${r.menuName}": ${r.bom.map((b: { product: { sku: string; name: string }; quantity: number; unit: string }) =>
          `[${b.product.sku}] ${b.product.name} x${b.quantity}${b.unit}`).join(', ')}`
      ).join('\n')
      : '  (ยังไม่มีสูตรในระบบ)'

    const clarificationNote = clarification ? `\nข้อมูลเพิ่มเติม: "${clarification}"` : ''

    const prompt = `คุณเป็น chef มืออาชีพ ผู้เชี่ยวชาญครัวไทย-ลาว ร้าน 43 Garden Cafe & Restaurant วังเวียง

===== SKU วัตถุดิบในระบบ (ใช้ MATCH เท่านั้น — ห้ามเอาไปใส่สูตรถ้าไม่ใช้จริง) =====
${materialList}

===== สูตรที่บันทึกแล้ว (reference) =====
${existingList}

===== เมนูที่ต้องการ BOM =====
"${menuName}"${clarificationNote}

===== กฎ: ห้ามผิด =====

[กฎ 0] เมนูขายตั้งตัว — ถ้าชื่อเมนูคือเมนูเหล่านี้ ให้ตอบ BOM สำหรับทำเมนูนั้น; แต่ห้ามนำไปใส่เป็น ingredient ของเมนูอื่น:
  ถั่วแระญี่ปุ่น/Edamame: BOM = ถั่วแระญี่ปุ่นสด 150g + เกลือ 5g (ต้มเกลือ เสิร์ฟอุ่น)
  ป๊อปคอร์น, ชีปส, แคร็กเกอร์ = ขนมขาย ไม่มี BOM ซับซ้อน
  เครื่องดื่ม/ค็อกเทล = ใช้ส่วนผสมบาร์เท่านั้น ไม่ใช่วัตถุดิบครัว

[กฎ 1] คิดสูตรจากความรู้ครัวก่อน แล้วค่อย match SKU:
  ห้ามเอา SKU จากรายการมาใส่ถ้าเมนูนั้นไม่ได้ใช้จริง

[กฎ 2] ข้าวผัด (ข้าวผัดหมู/ไก่/ทะเล ฯลฯ):
  หลัก: ข้าวสวย 250g, เนื้อสัตว์ชิ้น/ซอย 100g, ไข่ 1-2 ฟอง, กระเทียม 5g, น้ำมันพืช 15ml, ซีอิ๊วขาว 5ml, น้ำมันหอย 5ml
  ผักที่ใส่ได้: แครรอท, ข้าวโพดเม็ด, ถั่วลันเตา, ผัก 3 สี, ต้นหอม, ผักชี
  garnish: แตงกวาหั่น, มะเขือเทศ (วางข้างจาน)
  ห้าม: ถั่วฝักยาว, ใบกะเพรา, ใบโหระพา, ผักกาด, มะนาว

[กฎ 3] ต้มยำ (ต้มยำกุ้ง/ไก่/ทะเล ฯลฯ):
  หลัก: โปรตีน 150-200g (กุ้งสดทั้งตัว/ไก่ชิ้น/ทะเล), เห็ด 30g
  เครื่องต้มยำ: ตะไคร้, ใบมะกรูด, ข่า, พริกขี้หนูสด, น้ำพริกเผา, น้ำปลา, น้ำมะนาว
  ผักเสริม: ฟักทอง/ผักที่ร้านใส่, มะเขือเทศเชอรี่
  ห้าม: แครรอท, ถั่ว (ทุกชนิด), กะหล่ำปลี, ผักที่ไม่ใช่ต้มยำ

[กฎ 4] เมนูย่าง (เสือร้องไห้, คอหมูย่าง, สันในย่าง, ซี่โครงย่าง ฯลฯ):
  หลัก: เนื้อสัตว์ชิ้นใหญ่ 200-300g
  หมัก: กระเทียม, พริกไทย, ซอสพริก/น้ำปลา/ซีอิ๊ว/น้ำตาล (ตามเมนู)
  เสือร้องไห้: เนื้อวัวสันใน 200g + หมัก (ซอสพริกไทย+น้ำปลา+น้ำตาล) + น้ำจิ้มแจ่ว
  คอหมูย่าง: คอหมู 250g + หมัก (กระเทียม+พริกไทย+น้ำปลา+ซอสพริก+น้ำตาล)
  เสิร์ฟ: แตงกวา, มะเขือเทศ, ผักแนม + น้ำจิ้ม
  ห้าม: ข้าวสวย (ยกเว้นระบุชัด), ถั่ว, ผักสุกที่ไม่ใช่แนมย่าง

[กฎ 5] กะเพรา:
  หลัก: เนื้อสัตว์สับ 100g, ใบกะเพรา 15g, กระเทียม 5g, พริก 2g
  ซอส: น้ำมันพืช, น้ำมันหอย, ซีอิ๊วขาว, น้ำปลา
  ห้าม: ผักอื่นที่ไม่ใช่ส่วนผสมกะเพรา

[กฎ 6] เนื้อสัตว์:
  ผัด/ข้าวผัด/เส้น = ชิ้น/ซอย (ไม่ใช่สับ)
  กะเพรา/ลาบ/ยำ = สับ
  ย่าง/อบ = ชิ้นใหญ่ ไม่สับ
  ต้มยำกุ้ง = กุ้งสดทั้งตัว

[กฎ 7] ข้าว:
  ข้าวสวย = 200-250g/จานใหญ่
  ถ้า DB มีแค่ข้าวสาร ใช้ 100g แทน

[กฎ 8] เมนูทอด (ไก่ทอด, ปีกไก่ทอด, ปลาทอด, กุ้งทอด ฯลฯ):
  หลัก: เนื้อสัตว์ 200-400g
  แป้งชุบ: แป้งข้าวเจ้า/แป้งทอดกรอบ 50-100g
  น้ำมันทอด: น้ำมันพืช (ปริมาณมากสำหรับ deep fry)
  ปีกไก่ทอดสมุนไพร: ปีกไก่ 300g + หมัก(กระเทียม+พริกไทย+น้ำปลา) + สมุนไพร(ตะไคร้+ใบมะกรูด+ข่า) + แป้งทอด
  เสิร์ฟ: ซอสพริก/น้ำจิ้ม + ผักแนม (แตงกวา/มะเขือเทศ)
  ห้าม: ถั่ว, แครรอท, ผักสุก ที่ไม่ใช่ garnish

[กฎ 9] เมนูดิบ/แช่/ยำ (กุ้งแช่น้ำปลา, ลาบ, ส้มตำ ฯลฯ):
  กุ้งแช่น้ำปลา: กุ้งสด 150-200g + น้ำปลา 30ml + กระเทียมสับ + พริกขี้หนูสด + น้ำมะนาว + ผักชี
  ลาบ: เนื้อสัตว์สับ 150g + ข้าวคั่ว + พริกป่น + หอมแดง + ตะไคร้ + ใบสะระแหน่ + น้ำปลา + น้ำมะนาว
  ส้มตำ: มะละกอดิบ + มะเขือเทศ + ถั่วฝักยาว + กระเทียม + พริก + น้ำปลา + มะนาว + น้ำตาล
  ห้าม: วัตถุดิบสุก/ผัด ที่ไม่ในสูตร

===== ขั้นตอน =====
1. คิดสูตรจริงของ "${menuName}" จากความรู้ครัว
2. ตรวจ: "วัตถุดิบนี้ใช้จริงในเมนูนี้หรือไม่?" — ถ้าไม่ใช้ ห้ามใส่
3. Match กับ SKU ในระบบ (ถ้าไม่มีใน DB → NOT_FOUND:ชื่อ)

ตอบ JSON array เท่านั้น:
[
  { "sku": "SKU_หรือ_NOT_FOUND:ชื่อ", "ingredientName": "ชื่อวัตถุดิบ", "quantity": 250, "unit": "g", "location": "KIT_STOCK|BAR_STOCK|WH_MAIN" }
]
หรือถ้าคลุมเครือ: { "question": "คำถาม" }`

    if (debug) {
      return ok({ type: 'debug', prompt, menuName })
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
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('AI API error:', errText)
      return err(`AI API error: ${response.status}`)
    }

    const data = await response.json()
    const content = (data.choices?.[0]?.message?.content || '').trim()

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
          return { sku: b.sku, ingredientName, productId: null, productName: ingredientName, locationId: null, locationCode: b.location, quantity: b.quantity, unit: b.unit, found: false, missing: true }
        }

        const product = await prisma.product.findFirst({ where: { sku: b.sku }, select: { id: true, name: true, unit: true } })
        const location = await prisma.location.findFirst({ where: { code: b.location } })
        return {
          sku: b.sku, ingredientName: product?.name || ingredientName,
          productId: product?.id || null, productName: product?.name || b.sku,
          locationId: location?.id || null, locationCode: b.location,
          quantity: b.quantity, unit: b.unit || product?.unit || 'ชิ้น',
          found: !!product && !!location, missing: false,
        }
      })
    )

    return ok({
      type: 'bom', menuName,
      suggestions: allIngredients.filter(e => e.found),
      notFound: allIngredients.filter(e => !e.found && !e.missing).map(e => e.sku),
      missingIngredients: allIngredients.filter(e => e.missing).map(e => ({ name: e.ingredientName, quantity: e.quantity, unit: e.unit, location: e.locationCode })),
      allIngredients: allIngredients.map(e => ({ ingredientName: e.ingredientName, sku: e.sku, quantity: e.quantity, unit: e.unit, location: e.locationCode, found: e.found, missing: e.missing, productId: e.productId, locationId: e.locationId })),
      rawResponse: content,
    })

  } catch (error) {
    console.error('AI suggest error:', error)
    return err('เกิดข้อผิดพลาดในการเชื่อมต่อ AI')
  }
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])
