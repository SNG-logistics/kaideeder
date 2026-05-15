import { NextRequest } from 'next/server'
import { withAuth, ok, err } from '@/lib/api'
import { getAiConfig } from '@/lib/ai-config'

export const POST = withAuth(async (req: NextRequest) => {
    try {
        const { items } = await req.json() as { items: string[] }
        if (!items?.length) return err('ไม่มีรายการ')

        const { apiKey, apiUrl, model } = getAiConfig()
        if (!apiKey) return err('ไม่พบ API Key สำหรับ AI')

        const prompt = `คุณเป็นผู้เชี่ยวชาญด้านการจัดการสต็อกร้านอาหาร
ให้แนะนำหน่วยนับที่เหมาะสมสำหรับรายการสินค้าต่อไปนี้ โดยตอบเป็น JSON array เท่านั้น ไม่มีข้อความอื่น

กฎการแนะนำหน่วย:
- เนื้อสัตว์, หมู, ไก่, กุ้ง, ปลา, เนื้อวัว, วัตถุดิบสด → กก.
- ไข่ไก่, ไข่เป็ด, ไข่นกกระทา → ฟอง
- น้ำดื่ม, นม, เครื่องดื่มบรรจุกล่อง/ขวด (เป็นแพ็ค) → แพ็ค
- ซอส, น้ำปลา, น้ำมัน (ขวดเดี่ยว) → ขวด
- ข้าวสาร, แป้ง, น้ำตาล, เกลือ → กก.
- ผัก, ผลไม้ → กก.
- บะหมี่, เส้นก๋วยเตี๋ยว → กก.
- ถุง, บรรจุภัณฑ์, กล่องโฟม → แพ็ค
- ถ้าไม่แน่ใจ → ชิ้น

รายการสินค้า: ${JSON.stringify(items)}

ตอบเป็น JSON array เช่น: ["กก.", "ฟอง", "ขวด"]
ต้องมีจำนวน element เท่ากับรายการที่ให้มา (${items.length} รายการ)
ตอบเฉพาะ JSON array เท่านั้น ห้ามมีข้อความอื่น`

        const response = await fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                temperature: 0.2,
                max_tokens: 300,
            }),
        })

        if (!response.ok) {
            const e = await response.text()
            console.error('AI suggest-units error:', e)
            return err('AI ไม่ตอบสนอง')
        }

        const data = await response.json()
        const raw = data.choices?.[0]?.message?.content?.trim() || '[]'

        // Extract JSON array from response
        const match = raw.match(/\[[\s\S]*\]/)
        const units: string[] = match ? JSON.parse(match[0]) : items.map(() => 'ชิ้น')

        // Ensure length matches
        while (units.length < items.length) units.push('ชิ้น')

        return ok(units.slice(0, items.length))
    } catch (e: any) {
        console.error('suggest-units error:', e)
        return err('เกิดข้อผิดพลาด: ' + (e?.message || ''))
    }
})
