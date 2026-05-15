import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err } from '@/lib/api'
import { z } from 'zod'

type ConsumeFailType =
    | 'NO_BOM'
    | 'BOM_INCOMPLETE'
    | 'NO_UOM_CONV'
    | 'STOCK_EMPTY'
    | 'WRONG_WAREHOUSE'
    | 'NO_GR'
    | 'SYSTEM_ERROR'

interface FailEntry {
    menuId?: string
    menuName?: string
    ingredientId?: string
    ingredientName?: string
    locationId?: string
    failReason: ConsumeFailType
    requiredQty: number
    requiredUnit?: string
    availableQty: number
    detail: string
}

const closeOrderSchema = z.object({
    paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD', 'QRCODE']),
    receivedAmount: z.number().min(0),
    reference: z.string().optional(),
    discount: z.number().min(0).optional(),
    discountType: z.enum(['PERCENT', 'AMOUNT']).optional(),
    serviceCharge: z.number().min(0).optional(),
    vat: z.number().min(0).optional(),
})

export const POST = withAuth(async (req: NextRequest, ctx) => {
    const { tenantId } = ctx as any
    const params = await ctx.params
    const id = params?.id
    if (!id) return err('Missing order id')

    try {
        const body = await req.json()
        const data = closeOrderSchema.parse(body)

        const order = await prisma.order.findFirst({
            where: { id, tenantId },
            include: {
                items: {
                    where: { isCancelled: false },
                    include: { product: { include: { category: true } } },
                },
                table: true,
            },
        })

        if (!order) return err('ไม่พบออเดอร์', 404)
        if (order.status !== 'OPEN') return err('ออเดอร์นี้ปิดแล้ว')

        const subtotal = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        const discount = data.discount ?? order.discount
        const discountType = data.discountType ?? order.discountType
        const serviceCharge = data.serviceCharge ?? order.serviceCharge
        const vat = data.vat ?? order.vat

        let discountAmount = discount
        if (discountType === 'PERCENT') discountAmount = subtotal * (discount / 100)
        const afterDiscount = subtotal - discountAmount
        const totalAmount = afterDiscount + serviceCharge + vat
        const changeAmount = data.paymentMethod === 'CASH' ? Math.max(0, data.receivedAmount - totalAmount) : 0

        // ─── STOCK DEDUCTION ──────────────────────────────────────────────
        const stockWarnings: string[] = []
        const failEntries: FailEntry[] = []

        const locations = await prisma.location.findMany({ where: { tenantId, isActive: true } })
        const locationMap = Object.fromEntries(locations.map(l => [l.code, l.id]))

        const allConversions = await prisma.uomConversion.findMany({ where: { tenantId } })
        const convMap = new Map<string, Map<string, number>>()
        for (const c of allConversions) {
            if (!convMap.has(c.productId)) convMap.set(c.productId, new Map())
            convMap.get(c.productId)!.set(`${c.fromUnit}|${c.toUnit}`, c.factor)
            convMap.get(c.productId)!.set(`${c.toUnit}|${c.fromUnit}`, 1 / c.factor)
        }

        const allRecipes = await prisma.recipe.findMany({
            where: { tenantId, isActive: true },
            include: { bom: { include: { product: true } } },
        })
        const recipeByName = new Map<string, typeof allRecipes[0]>()
        const recipeByCode = new Map<string, typeof allRecipes[0]>()
        const recipeById = new Map<string, typeof allRecipes[0]>()
        for (const r of allRecipes) {
            recipeByName.set(r.menuName.toLowerCase().trim(), r)
            if (r.posMenuCode) recipeByCode.set(r.posMenuCode.toLowerCase().trim(), r)
            recipeById.set(r.id, r)
        }

        for (const item of order.items) {
            if (item.product.productType === 'ENTERTAIN') continue

            const productName = item.product.name.toLowerCase().trim()
            const productSku = item.product.sku.toLowerCase().trim()
            const matchedRecipe = recipeByName.get(productName)
                ?? recipeByCode.get(productSku)
                ?? recipeByCode.get(productName)
                ?? null

            const bomLines = matchedRecipe?.bom ?? []

            if (bomLines.length === 0) {
                failEntries.push({
                    menuId: item.productId,
                    menuName: item.product.name,
                    ingredientId: item.productId,
                    ingredientName: item.product.name,
                    locationId: undefined,
                    failReason: 'NO_BOM',
                    requiredQty: item.quantity,
                    requiredUnit: item.product.unit,
                    availableQty: 0,
                    detail: `เมนู "${item.product.name}" ยังไม่มีสูตร Recipe — กรุณาสร้างสูตรที่หน้า สูตรอาหาร (Recipe/BOM)`,
                })
                stockWarnings.push(`⚠️ "${item.product.name}": ไม่มีสูตร Recipe`)
                await deductToppingStock({ item, tenantId, id, ctx, stockWarnings, failEntries, convMap, locationMap, recipeById })
                continue
            }

            for (const bom of bomLines) {
                const baseUnit = bom.product.unit
                let actualQty = item.quantity * bom.quantity

                if (bom.unit !== baseUnit) {
                    const factor = resolveConversion(bom.productId, bom.unit, baseUnit, convMap)
                    if (factor === null) {
                        failEntries.push({
                            menuId: item.productId,
                            menuName: item.product.name,
                            ingredientId: bom.productId,
                            ingredientName: bom.product.name,
                            locationId: bom.locationId,
                            failReason: 'NO_UOM_CONV',
                            requiredQty: bom.quantity,
                            requiredUnit: bom.unit,
                            availableQty: 0,
                            detail: `ไม่มีหน่วยแปลง "${bom.unit}" → "${baseUnit}" สำหรับ "${bom.product.name}"`,
                        })
                        stockWarnings.push(`❌ "${bom.product.name}": ไม่มีหน่วยแปลง (${bom.unit}→${baseUnit})`)
                        continue
                    }
                    actualQty = item.quantity * bom.quantity * factor
                }

                await deductInventory({
                    tenantId,
                    productId: bom.productId,
                    locationId: bom.locationId,
                    quantity: actualQty,
                    unitCost: bom.product.costPrice,
                    orderId: id,
                    userId: (ctx as any).user?.userId || null,
                    warnings: stockWarnings,
                    failEntries,
                    menuId: item.productId,
                    menuName: item.product.name,
                    bomUnit: baseUnit,
                    convMap,
                    productBaseUnit: baseUnit,
                    locationMap,
                })
            }

            await deductToppingStock({ item, tenantId, id, ctx, stockWarnings, failEntries, convMap, locationMap, recipeById })
        }

        // ─── ConsumeFailLog (non-fatal — ไม่ block order close) ──────────
        if (failEntries.length > 0) {
            try {
                await prisma.consumeFailLog.createMany({
                    data: failEntries.map(f => ({
                        tenantId,
                        orderId: id,
                        orderNumber: order.orderNumber,
                        menuId: f.menuId || null,
                        menuName: f.menuName || null,
                        ingredientId: f.ingredientId || null,
                        ingredientName: f.ingredientName || null,
                        locationId: f.locationId || null,
                        failReason: f.failReason,
                        requiredQty: f.requiredQty,
                        requiredUnit: f.requiredUnit || null,
                        availableQty: f.availableQty,
                        detail: f.detail,
                        status: 'OPEN',
                    })),
                    skipDuplicates: true,
                })
            } catch (logErr) {
                console.error('[close] ConsumeFailLog write failed (non-fatal):', logErr)
            }
        }

        // ─── Update order ─────────────────────────────────────────────────
        const closedOrder = await prisma.order.update({
            where: { id },
            data: {
                status: 'CLOSED',
                subtotal,
                discount,
                discountType,
                serviceCharge,
                vat,
                totalAmount,
                closedAt: new Date(),
            },
            include: {
                table: true,
                items: { include: { product: true } },
                payments: true,
            },
        })

        // ─── Payment ──────────────────────────────────────────────────────
        await prisma.payment.create({
            data: {
                tenantId,
                orderId: id,
                method: data.paymentMethod,
                amount: totalAmount,
                receivedAmount: data.receivedAmount,
                changeAmount,
                reference: data.reference || null,
            },
        })

        // ─── Release table ────────────────────────────────────────────────
        if (order.tableId) {
            await prisma.diningTable.update({
                where: { id: order.tableId },
                data: { status: 'AVAILABLE' },
            })
        }

        // ─── SalesEvent (non-fatal — ไม่ block ถ้า migration ยังไม่ run) ──
        try {
            await prisma.salesEvent.create({
                data: {
                    tenantId,
                    orderId: id,
                    occurredAt: new Date(),
                    payload: {
                        orderId: id,
                        orderNumber: order.orderNumber,
                        tableId: order.tableId,
                        tableName: order.table?.name || null,
                        closedAt: new Date().toISOString(),
                        subtotal,
                        discount: discountAmount,
                        totalAmount,
                        paymentMethod: data.paymentMethod,
                        items: order.items.map(item => ({
                            orderItemId: item.id,
                            productId: item.productId,
                            productName: item.product.name,
                            productSku: item.product.sku,
                            categoryCode: item.product.category?.code || null,
                            stationId: item.stationId || null,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            total: item.quantity * item.unitPrice,
                            kitchenStatus: item.kitchenStatus,
                        })),
                    },
                },
            })
        } catch (eventErr) {
            console.error('[close] SalesEvent write failed (non-fatal):', eventErr)
        }

        return ok({
            order: closedOrder,
            changeAmount,
            stockWarnings: stockWarnings.length > 0 ? stockWarnings : undefined,
            failCount: failEntries.length,
        })
    } catch (error) {
        if (error instanceof z.ZodError) return err(error.errors.map(e => e.message).join(', '))
        console.error('Close order error:', error)
        return err('เกิดข้อผิดพลาดในการปิดบิล')
    }
}, ['OWNER', 'MANAGER', 'CASHIER'])

function resolveConversion(
    productId: string,
    fromUnit: string,
    toUnit: string,
    convMap: Map<string, Map<string, number>>,
): number | null {
    if (fromUnit === toUnit) return 1
    const productConv = convMap.get(productId)
    if (!productConv) return null
    return productConv.get(`${fromUnit}|${toUnit}`) ?? null
}

type RecipeWithBom = {
    id: string
    menuName: string
    posMenuCode: string | null
    bom: {
        id: string
        productId: string
        locationId: string
        quantity: number
        unit: string
        product: {
            id: string
            name: string
            unit: string
            costPrice: number
            category?: { code: string } | null
        }
    }[]
}

interface DeductToppingParams {
    item: {
        toppingsJson: string | null
        productId: string
        quantity: number
        product: { name: string }
    }
    tenantId: string
    id: string
    ctx: any
    stockWarnings: string[]
    failEntries: FailEntry[]
    convMap: Map<string, Map<string, number>>
    locationMap: Record<string, string>
    recipeById: Map<string, RecipeWithBom>
}

async function deductToppingStock(p: DeductToppingParams): Promise<void> {
    if (!p.item.toppingsJson) return
    try {
        const selectedToppings = JSON.parse(p.item.toppingsJson) as {
            id: string
            name: string
            price: number
            recipeId?: string
            productId?: string
            isActive?: boolean
        }[]

        for (const topping of selectedToppings) {
            let toppingRecipe: RecipeWithBom | undefined
            if (topping.recipeId) {
                toppingRecipe = p.recipeById.get(topping.recipeId)
            } else if (topping.productId) {
                for (const [, r] of p.recipeById) {
                    if (r.menuName.toLowerCase().trim() === topping.name.toLowerCase().trim()) {
                        toppingRecipe = r
                        break
                    }
                }
            }

            if (!toppingRecipe || toppingRecipe.bom.length === 0) {
                p.stockWarnings.push(`⚠️ ท็อปปิ้ง "${topping.name}": ไม่มีสูตร Recipe`)
                p.failEntries.push({
                    menuId: p.item.productId,
                    menuName: `${p.item.product.name} + ${topping.name}`,
                    ingredientId: topping.productId,
                    ingredientName: topping.name,
                    locationId: undefined,
                    failReason: 'NO_BOM',
                    requiredQty: p.item.quantity,
                    requiredUnit: 'จาน',
                    availableQty: 0,
                    detail: `ท็อปปิ้ง "${topping.name}" ยังไม่มีสูตร Recipe`,
                })
                continue
            }

            for (const bom of toppingRecipe.bom) {
                const baseUnit = bom.product.unit
                let actualQty = p.item.quantity * bom.quantity
                if (bom.unit !== baseUnit) {
                    const factor = resolveConversion(bom.productId, bom.unit, baseUnit, p.convMap)
                    if (factor === null) {
                        p.failEntries.push({
                            menuId: p.item.productId,
                            menuName: `${p.item.product.name} + ${topping.name}`,
                            ingredientId: bom.productId,
                            ingredientName: bom.product.name,
                            locationId: bom.locationId,
                            failReason: 'NO_UOM_CONV',
                            requiredQty: bom.quantity,
                            requiredUnit: bom.unit,
                            availableQty: 0,
                            detail: `ท็อปปิ้ง "${topping.name}": ไม่มีหน่วยแปลง`,
                        })
                        continue
                    }
                    actualQty = p.item.quantity * bom.quantity * factor
                }
                await deductInventory({
                    tenantId: p.tenantId,
                    productId: bom.productId,
                    locationId: bom.locationId,
                    quantity: actualQty,
                    unitCost: bom.product.costPrice,
                    orderId: p.id,
                    userId: p.ctx?.user?.userId || null,
                    warnings: p.stockWarnings,
                    failEntries: p.failEntries,
                    menuId: p.item.productId,
                    menuName: `${p.item.product.name} + ${topping.name}`,
                    bomUnit: baseUnit,
                    convMap: p.convMap,
                    productBaseUnit: baseUnit,
                    locationMap: p.locationMap,
                })
            }
        }
    } catch (toppingErr) {
        console.error('[close] Topping deduction error:', toppingErr)
    }
}

interface DeductParams {
    tenantId: string
    productId: string
    locationId: string
    quantity: number
    unitCost: number
    orderId: string
    userId: string | null
    warnings: string[]
    failEntries: FailEntry[]
    menuId?: string
    menuName?: string
    bomUnit: string
    convMap: Map<string, Map<string, number>>
    productBaseUnit: string
    locationMap?: Record<string, string>
}

async function deductInventory(p: DeductParams): Promise<void> {
    try {
        if (!p.locationId) {
            const product = await prisma.product.findUnique({ where: { id: p.productId }, select: { name: true } })
            const name = product?.name || p.productId
            p.warnings.push(`⚠️ "${name}": ไม่มี location`)
            p.failEntries.push({
                menuId: p.menuId, menuName: p.menuName,
                ingredientId: p.productId, ingredientName: name,
                failReason: 'SYSTEM_ERROR',
                requiredQty: p.quantity, requiredUnit: p.bomUnit, availableQty: 0,
                detail: 'ไม่พบ location สำหรับตัดสต็อค',
            })
            return
        }

        let inventory = await prisma.inventory.findFirst({
            where: { productId: p.productId, locationId: p.locationId, tenantId: p.tenantId },
        })

        if (!inventory) {
            const product = await prisma.product.findUnique({ where: { id: p.productId }, select: { name: true } })
            const name = product?.name || p.productId
            p.warnings.push(`❌ "${name}": ยังไม่ได้รับเข้าคลัง (ไม่มี GR)`)
            p.failEntries.push({
                menuId: p.menuId, menuName: p.menuName,
                ingredientId: p.productId, ingredientName: name,
                locationId: p.locationId, failReason: 'NO_GR',
                requiredQty: p.quantity, requiredUnit: p.bomUnit, availableQty: 0,
                detail: 'ไม่พบ inventory record — วัตถุดิบนี้ยังไม่เคยถูกรับเข้าคลัง',
            })
            inventory = await prisma.inventory.create({
                data: { tenantId: p.tenantId, productId: p.productId, locationId: p.locationId, quantity: 0, avgCost: p.unitCost },
            })
        }

        if (inventory.quantity < p.quantity) {
            const product = await prisma.product.findUnique({ where: { id: p.productId }, select: { name: true } })
            const name = product?.name || p.productId
            const otherStock = await prisma.inventory.findFirst({
                where: { tenantId: p.tenantId, productId: p.productId, quantity: { gt: 0 }, NOT: { locationId: p.locationId } },
                include: { location: { select: { name: true, code: true } } },
            })
            if (otherStock) {
                p.warnings.push(`⚠️ "${name}": ของอยู่คลัง "${otherStock.location.name}"`)
                p.failEntries.push({
                    menuId: p.menuId, menuName: p.menuName,
                    ingredientId: p.productId, ingredientName: name,
                    locationId: p.locationId, failReason: 'WRONG_WAREHOUSE',
                    requiredQty: p.quantity, requiredUnit: p.bomUnit, availableQty: inventory.quantity,
                    detail: `ของมีในคลัง "${otherStock.location.name}" แต่คลังนี้ไม่พอ`,
                })
            } else {
                p.warnings.push(`⚠️ "${name}": สต็อคไม่พอ`)
                p.failEntries.push({
                    menuId: p.menuId, menuName: p.menuName,
                    ingredientId: p.productId, ingredientName: name,
                    locationId: p.locationId, failReason: 'STOCK_EMPTY',
                    requiredQty: p.quantity, requiredUnit: p.bomUnit, availableQty: inventory.quantity,
                    detail: `สต็อคไม่พอ: มี ${inventory.quantity} ต้องการ ${p.quantity} ${p.bomUnit}`,
                })
            }
        }

        await prisma.inventory.update({
            where: { id: inventory.id },
            data: { quantity: { decrement: p.quantity } },
        })

        await prisma.stockMovement.create({
            data: {
                tenantId: p.tenantId,
                productId: p.productId,
                fromLocationId: p.locationId,
                quantity: p.quantity,
                unitCost: p.unitCost,
                totalCost: p.quantity * p.unitCost,
                type: 'SALE',
                referenceId: p.orderId,
                referenceType: 'POS_ORDER',
                note: 'POS ตัดสต็อคอัตโนมัติ',
                createdById: p.userId,
            },
        })
    } catch (e) {
        console.error(`Stock deduction error for product ${p.productId}:`, e)
        p.warnings.push(`❌ ตัดสต็อคไม่สำเร็จ: ${p.productId}`)
        p.failEntries.push({
            menuId: p.menuId, menuName: p.menuName,
            ingredientId: p.productId,
            failReason: 'SYSTEM_ERROR',
            requiredQty: p.quantity, requiredUnit: p.bomUnit, availableQty: 0,
            detail: `System error: ${e instanceof Error ? e.message : String(e)}`,
        })
    }
}

function getDefaultLocation(categoryCode: string | undefined, locationMap: Record<string, string>): string {
    const anyLocationId = Object.values(locationMap)[0] || ''
    if (!categoryCode) return locationMap['WH_MAIN'] || anyLocationId
    const barCategories = ['BEER', 'BEER_DRAFT', 'WINE', 'COCKTAIL', 'DRINK', 'WATER']
    const kitchenCategories = ['FOOD_GRILL', 'FOOD_FRY', 'FOOD_SEA', 'FOOD_VEG', 'FOOD_LAAB', 'FOOD_RICE', 'FOOD_NOODLE']
    if (barCategories.includes(categoryCode)) return locationMap['BAR_STOCK'] || locationMap['FR_FREEZER'] || locationMap['WH_MAIN'] || anyLocationId
    if (kitchenCategories.includes(categoryCode)) return locationMap['KIT_STOCK'] || locationMap['WH_MAIN'] || anyLocationId
    return locationMap['FR_FREEZER'] || locationMap['WH_MAIN'] || anyLocationId
}
