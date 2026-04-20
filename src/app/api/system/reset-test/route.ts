import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api'

// POST /api/system/reset-test — OWNER only
// Clears ALL transactional data, keeps master data (products, categories, users, recipes, locations, suppliers)
export const POST = withAuth<any>(async (_req, { user }) => {
    try {
        // Disable FK checks → delete all transactional data → re-enable FK checks
        // This avoids FK constraint errors from any implicit indexes
        await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0')

        try {
            const result = await prisma.$transaction(async (tx) => {
                // ════════════════════════════════════════════════════════════
                // DELETE ORDER: all transactional tables
                // FK checks disabled so order doesn't matter strictly,
                // but we keep logical order for clarity
                // ════════════════════════════════════════════════════════════

                // ── 1. POS Order tree ─────────────────────────────────────
                const deliveryInfos  = await tx.deliveryInfo.deleteMany({})
                const consumeFailLog = await tx.consumeFailLog.deleteMany({})
                const salesEvents    = await tx.salesEvent.deleteMany({})
                const orderItems     = await tx.orderItem.deleteMany({})
                const payments       = await tx.payment.deleteMany({})
                const orders         = await tx.order.deleteMany({})

                // ── 2. Stock movements ────────────────────────────────────
                const movements = await tx.stockMovement.deleteMany({})

                // ── 3. Purchasing ─────────────────────────────────────────
                const purchaseItems  = await tx.purchaseItem.deleteMany({})
                const purchaseOrders = await tx.purchaseOrder.deleteMany({})

                // ── 4. Transfers ──────────────────────────────────────────
                const transferItems  = await tx.transferItem.deleteMany({})
                const stockTransfers = await tx.stockTransfer.deleteMany({})

                // ── 5. Adjustments ────────────────────────────────────────
                const adjustmentItems  = await tx.adjustmentItem.deleteMany({})
                const stockAdjustments = await tx.stockAdjustment.deleteMany({})

                // ── 6. Stock count sheets ─────────────────────────────────
                const stockCountItems = await tx.stockCountItem.deleteMany({})
                const stockCounts     = await tx.stockCount.deleteMany({})

                // ── 7. Prep productions (keep recipes, delete production logs) ──
                const prepProductions = await tx.prepProduction.deleteMany({})

                // ── 8. Sales imports ───────────────────────────────────────
                const salesImportItems = await tx.salesImportItem.deleteMany({})
                const salesImports     = await tx.salesImport.deleteMany({})

                // ── 9. SKU suggestion queue ───────────────────────────────
                const skuSuggestions = await tx.skuSuggestion.deleteMany({})

                // ── 10. AI / catalog metadata ─────────────────────────────
                const aiClassifications = await tx.aiItemClassification.deleteMany({})
                const validationIssues  = await tx.validationIssue.deleteMany({})
                const aiRecommendations = await tx.aiRecommendation.deleteMany({})
                const entityUsage       = await tx.entityUsageSummary.deleteMany({})

                // ════════════════════════════════════════════════════════════
                // RESET (keep records, zero out values)
                // ════════════════════════════════════════════════════════════

                // ── Inventory quantities → 0 ──────────────────────────────
                const invReset = await tx.inventory.updateMany({
                    data: { quantity: 0, reservedQty: 0, avgCost: 0 },
                })

                // ── Dining tables → AVAILABLE ─────────────────────────────
                const tablesReset = await tx.diningTable.updateMany({
                    data: { status: 'AVAILABLE' },
                })

                return {
                    // POS
                    orders: orders.count,
                    orderItems: orderItems.count,
                    payments: payments.count,
                    deliveryInfos: deliveryInfos.count,
                    salesEvents: salesEvents.count,
                    consumeFailLogs: consumeFailLog.count,
                    // Stock
                    movements: movements.count,
                    inventoryReset: invReset.count,
                    // Purchasing
                    purchaseOrders: purchaseOrders.count,
                    purchaseItems: purchaseItems.count,
                    // Transfers & Adjustments
                    stockTransfers: stockTransfers.count,
                    stockAdjustments: stockAdjustments.count,
                    // Stock counts
                    stockCounts: stockCounts.count,
                    // Prep
                    prepProductions: prepProductions.count,
                    // Sales imports
                    salesImports: salesImports.count,
                    // SKU / AI
                    skuSuggestions: skuSuggestions.count,
                    aiClassifications: aiClassifications.count,
                    aiRecommendations: aiRecommendations.count,
                    validationIssues: validationIssues.count,
                    // Tables
                    tablesReset: tablesReset.count,
                }
            }, { timeout: 60000 })

            return NextResponse.json({
                success: true,
                message: 'รีเซ็ตข้อมูลทดสอบสำเร็จ — ครบทุกตาราง',
                data: result,
            })
        } finally {
            // ALWAYS re-enable FK checks even if transaction fails
            await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1')
        }
    } catch (e: any) {
        console.error('[reset-test]', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}, ['OWNER'])
