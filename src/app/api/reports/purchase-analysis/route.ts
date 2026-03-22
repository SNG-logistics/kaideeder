import { NextRequest } from 'next/server'
import { withAuth, ok, err } from '@/lib/api'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/reports/purchase-analysis
 * วิเคราะห์การซื้อซ้ำเกินจำนวน เทียบกับยอดใช้จริง
 * Body: { period: 'day' | 'week' | 'month' }
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const { period = 'week' } = await req.json() as { period?: 'day' | 'week' | 'month' }

        const apiKey = process.env.COMET_API_KEY
        const apiUrl = process.env.COMET_API_URL || 'https://api.cometapi.com/v1'
        const model = process.env.COMET_MODEL || 'gpt-4o-mini'
        if (!apiKey) return err('ไม่พบ COMET_API_KEY')

        const now = new Date()
        const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : 30
        const since = new Date(now.getTime() - periodDays * 86400000)

        // 1) ยอดซื้อเข้าในช่วง period (PURCHASE movements)
        const purchaseMoves = await prisma.stockMovement.findMany({
            where: { type: 'PURCHASE', createdAt: { gte: since } },
            select: {
                productId: true, quantity: true, totalCost: true, createdAt: true,
                product: { select: { sku: true, name: true, unit: true, productType: true, category: { select: { name: true } } } }
            }
        })

        // 2) ยอดใช้จริง = SALE + TRANSFER OUT (ตัดออกจากสต็อค)
        const usageMoves = await prisma.stockMovement.findMany({
            where: { type: { in: ['SALE', 'WASTE'] }, createdAt: { gte: since } },
            select: { productId: true, quantity: true, totalCost: true }
        })

        // 3) ยอด adjustment (บวก/ลบ)
        const adjMoves = await prisma.stockMovement.findMany({
            where: { type: 'ADJUSTMENT', createdAt: { gte: since } },
            select: { productId: true, quantity: true }
        })

        // 4) สต็อคปัจจุบัน
        const currentInventory = await prisma.inventory.findMany({
            select: { productId: true, quantity: true, updatedAt: true }
        })
        const stockMap = Object.fromEntries(currentInventory.map(i => [i.productId, i.quantity]))

        // Aggregate by product
        const productIds = [...new Set([...purchaseMoves.map(m => m.productId)])]

        const stats = productIds.map(productId => {
            const pm = purchaseMoves.filter(m => m.productId === productId)
            const um = usageMoves.filter(m => m.productId === productId)
            const am = adjMoves.filter(m => m.productId === productId)

            const totalPurchased = pm.reduce((s, m) => s + m.quantity, 0)
            const totalPurchasedCost = pm.reduce((s, m) => s + m.totalCost, 0)
            const totalUsed = um.reduce((s, m) => s + m.quantity, 0)
            const totalAdj = am.reduce((s, m) => s + m.quantity, 0)
            const currentStock = stockMap[productId] || 0
            const purchaseCount = pm.length  // จำนวนครั้งที่ซื้อ

            // ซื้อเกิน = totalPurchased - totalUsed (surplus)
            const surplus = totalPurchased - totalUsed
            const surplusPercent = totalPurchased > 0 ? Math.round((surplus / totalPurchased) * 100) : 0

            const info = pm[0]?.product
            return {
                productId,
                sku: info?.sku || '',
                name: info?.name || '',
                category: info?.category?.name || '',
                unit: info?.unit || '',
                productType: info?.productType || '',
                totalPurchased,
                totalPurchasedCost,
                totalUsed,
                surplus,
                surplusPercent,
                currentStock,
                purchaseCount,
                // ซื้อซ้ำมากเกิน = ซื้อ > 2x ยอดใช้
                isOverBought: surplus > 0 && totalUsed > 0 && surplusPercent > 30,
                isNeverUsed: totalUsed === 0 && totalPurchased > 0,
            }
        })

        // Sort: ของที่ซื้อเกินมากสุดก่อน
        stats.sort((a, b) => b.surplusPercent - a.surplusPercent)

        const totalPurchaseCost = stats.reduce((s, p) => s + p.totalPurchasedCost, 0)
        const overBought = stats.filter(s => s.isOverBought || s.isNeverUsed)
        const overBoughtCost = overBought.reduce((s, p) => s + p.totalPurchasedCost, 0)

        // 5) AI วิเคราะห์
        const itemSummary = stats.slice(0, 30).map(s =>
            `- [${s.sku}] ${s.name} | ซื้อ: ${s.totalPurchased}${s.unit} (${s.purchaseCount}ครั้ง) | ใช้: ${s.totalUsed}${s.unit} | เกิน: ${s.surplus}${s.unit} (${s.surplusPercent}%) | สต็อคปัจจุบัน: ${s.currentStock}${s.unit}`
        ).join('\n')

        const prompt = `คุณเป็นผู้เชี่ยวชาญด้านต้นทุนระบบ KAIDEEDER (Restaurant & Stock Management Platform)

ข้อมูลการซื้อเทียบยอดใช้จริง ช่วง${period === 'day' ? '1 วัน' : period === 'week' ? '7 วัน' : '30 วัน'}ที่ผ่านมา:

${itemSummary}

มูลค่าซื้อรวม: ${totalPurchaseCost.toLocaleString()} KIP | รายการที่ซื้อเกิน: ${overBought.length} รายการ

วิเคราะห์และตอบเป็น JSON:
{
  "summary": "สรุปสถานการณ์ 2-3 ประโยค",
  "totalWasteRisk": ตัวเลข KIP ที่เสี่ยงสูญ,
  "topProblems": [
    { "sku": "...", "name": "...", "issue": "ปัญหาที่พบ", "suggestion": "คำแนะนำปรับการสั่งซื้อ" }
  ],
  "buyingPattern": "วิเคราะห์รูปแบบการสั่งซื้อที่มีปัญหา",
  "recommendations": ["แนะนำ 1", "แนะนำ 2", "แนะนำ 3"],
  "okItems": ["SKU ที่ซื้อสมเหตุสมผล"]
}

ตอบ JSON เท่านั้น ห้ามมีข้อความอื่น`

        const aiRes = await fetch(`${apiUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], stream: false, temperature: 0.2, max_tokens: 1000 })
        })

        if (!aiRes.ok) return err(`AI error: ${aiRes.status}`)
        const aiData = await aiRes.json()
        const content = (aiData.choices?.[0]?.message?.content || '').trim()

        let analysis = null
        try {
            const m = content.match(/\{[\s\S]*\}/)
            if (m) analysis = JSON.parse(m[0])
        } catch { /* fallback */ }

        return ok({
            period, periodDays, since: since.toISOString(),
            stats,
            overBought,
            totalPurchaseCost,
            overBoughtCost,
            analysis,
            generatedAt: now.toISOString(),
        })

    } catch (error) {
        console.error('purchase-analysis error:', error)
        return err('เกิดข้อผิดพลาด')
    }
}, ['OWNER', 'MANAGER', 'PURCHASER'])
