import { NextRequest } from 'next/server'
import { withAuth, ok, err } from '@/lib/api'
import { getAiConfig } from '@/lib/ai-config'
import { shouldExcludeFromStock, guessUnit } from '@/lib/sku-matcher'

/**
 * POST /api/ai/scan-stock-sheet
 * Body: { image: string (base64 data URL) }
 * อ่านใบสต็อคของสด (ใบรับสินค้าเข้าคลัง) ด้วย AI — Two-step approach for better accuracy
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const { image } = await req.json() as { image: string }
        if (!image) return err('ไม่พบรูปภาพ')

        const base64 = image.includes(',') ? image.split(',')[1] : image
        const mimeType = image.startsWith('data:') ? image.split(';')[0].replace('data:', '') : 'image/jpeg'

        const { apiKey, apiUrl, model } = getAiConfig()
        if (!apiKey) return err('ไม่พบ COMET_API_KEY')

        // ── STEP 1: Read raw text from the image ───────────────────────────
        const step1Prompt = `This is a Thai restaurant stock sheet (ใบสต็อคของสด / ใบรับสินค้า / ใบนับสต็อค).

Please read this image carefully and extract ALL rows from the table.

For EACH row, extract:
1. Row number (ลำดับ) if visible  
2. Product/ingredient name (ชื่อวัตถุดิบ) - read the Thai text carefully
3. Unit (หน่วยนับ): kg, กิโลกรัม, แผ่น, ฟอง, ขวด, ชิ้น, อัน, etc.
4. ANY number/quantity you can see in the columns — describe which column each number is in
5. Date if visible on the sheet

Format your response as a list like:
Row 1: [name] | [unit] | received=[number or empty] | remaining=[number or empty] | costPerUnit=[number or empty] | totalCost=[number or empty]
Row 2: ...

Read every row even if some columns are empty. If a cell is empty, write "empty".
If text is unclear, write your best guess with a ? mark.`

        const step1Res = await fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                max_tokens: 3000,
                temperature: 0,
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
                        { type: 'text', text: step1Prompt }
                    ]
                }]
            })
        })

        if (!step1Res.ok) {
            const errText = await step1Res.text()
            console.error('CometAPI step1 error:', errText)
            return err(`AI error: ${step1Res.status}`)
        }

        const step1Json = await step1Res.json()
        const rawText = (step1Json.choices?.[0]?.message?.content || '').trim()

        console.log(`\n\x1b[36m📋 [AI Stock Sheet] Raw OCR Result:\x1b[0m\n${rawText}\n`)
        console.log(`Step1 Tokens: ${step1Json.usage?.total_tokens || 0}`)

        if (!rawText || rawText.length < 30) {
            return err('AI ไม่สามารถอ่านรูปได้ กรุณาถ่ายรูปให้ชัดขึ้น และให้แสงพอ')
        }

        // ── STEP 2: Parse the raw text into structured JSON ─────────────────
        const step2Prompt = `Given this list of stock sheet rows extracted from an image:

${rawText}

Convert this into JSON. For each row:
- Use "received" column as quantityIn if it has a number > 0
- If "received" is empty, use "remaining" as quantityIn  
- If both empty, set quantityIn = 0
- Remove "?" from guessed values but still include them
- Skip any row that has no product name

Return ONLY valid JSON (no markdown):
{
  "sheetDate": "YYYY-MM-DD or null",
  "items": [
    {
      "name": "Thai product name",
      "unit": "unit",
      "quantityIn": 0.0,
      "costPerUnit": 0.0,
      "totalCost": 0.0,
      "remaining": null
    }
  ]
}`

        const step2Res = await fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                max_tokens: 2500,
                temperature: 0,
                messages: [{ role: 'user', content: step2Prompt }]
            })
        })

        if (!step2Res.ok) {
            const errText = await step2Res.text()
            console.error('CometAPI step2 error:', errText)
            return err(`AI parse error: ${step2Res.status}`)
        }

        const step2Json = await step2Res.json()
        const jsonStr = (step2Json.choices?.[0]?.message?.content || '').trim()
            .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        console.log(`Step2 Tokens: ${step2Json.usage?.total_tokens || 0}`)

        const parsed = JSON.parse(jsonStr)

        // Normalize + filter + auto-fix unit
        if (Array.isArray(parsed.items)) {
            const beforeCount = parsed.items.length
            parsed.items = parsed.items
                .map((item: Record<string, unknown>) => ({
                    name:        String(item.name || ''),
                    unit:        String(item.unit || 'กิโลกรัม'),
                    quantityIn:  Number(item.quantityIn)  || 0,
                    costPerUnit: Number(item.costPerUnit) || 0,
                    totalCost:   Number(item.totalCost)   || 0,
                    remaining:   item.remaining != null ? Number(item.remaining) : null,
                }))
                // ── FILTER: ตัดเครื่องดื่ม + บริการออกก่อน ──────────────────
                .filter((item: { name: string }) => !shouldExcludeFromStock(item.name))
                // ── AUTO-UNIT: ถ้า unit ยังเป็น default (กิโลกรัม/กก./ชิ้น) → ลอง guess จากชื่อ ─
                .map((item: { name: string; unit: string; quantityIn: number; costPerUnit: number; totalCost: number; remaining: number | null }) => {
                    const genericUnit = /^(กิโลกรัม|กิโล|kilogram|kg)$/i.test(item.unit.trim())
                    if (genericUnit) {
                        const guessed = guessUnit(item.name, item.unit)
                        if (guessed !== item.unit) {
                            console.log(`  🔧 unit fix: "${item.name}" → ${item.unit} → ${guessed}`)
                        }
                        return { ...item, unit: guessed }
                    }
                    return item
                })

            const excluded = beforeCount - parsed.items.length
            if (excluded > 0) {
                console.log(`\x1b[33m⚠️  [AI Stock] ตัดรายการเครื่องดื่ม/บริการออก ${excluded} รายการ\x1b[0m`)
            }
        }

        return ok(parsed)


    } catch (e: unknown) {
        console.error('scan-stock-sheet error:', e)
        if (e instanceof SyntaxError) return err('AI อ่านได้แต่ parse ผิดพลาด กรุณาลองใหม่')
        return err('เกิดข้อผิดพลาดในการเชื่อมต่อ AI')
    }
}, ['OWNER', 'MANAGER', 'WAREHOUSE'])
