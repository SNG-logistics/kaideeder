import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, ok, err, AuthContext } from '@/lib/api'
import { z } from 'zod'

const quickReceiveSchema = z.object({
    locationCode: z.string().min(1),
    productSku: z.string().optional(),
    productName: z.string().optional(),
    unit: z.string().optional(),
    quantity: z.number().positive(),
    unitCost: z.number().optional()
});

export const POST = withAuth(async (req: NextRequest, context: AuthContext) => {
    try {
        const { tenantId } = context as any
        const body = await req.json();
        const data = quickReceiveSchema.parse(body);

        if (!data.productSku && !data.productName) {
            return err('ต้องระบุ productSku หรือ productName', 400);
        }

        const location = await prisma.location.findFirst({ where: { tenantId, code: data.locationCode } });
        if (!location) return err('ไม่พบคลัง: ' + data.locationCode, 404);

        let product;
        if (data.productSku) {
            product = await prisma.product.findFirst({ where: { tenantId, sku: data.productSku } });
            if (!product) return err('ไม่พบ SKU: ' + data.productSku, 404);
        } else if (data.productName) {
            product = await prisma.product.findFirst({
                where: { tenantId, name: { contains: data.productName.trim() }, isActive: true },
            });

            if (!product) {
                const autoSku = 'AUTO-' + Date.now();
                const defCat = await prisma.category.findFirst({ where: { tenantId, code: 'OTHER' } });
                product = await prisma.product.create({
                    data: {
                        tenantId,
                        sku: autoSku,
                        name: data.productName.trim(),
                        unit: data.unit || 'ชิ้น',
                        costPrice: data.unitCost || 0,
                        salePrice: 0,
                        categoryId: defCat!.id,
                        productType: 'RAW_MATERIAL',
                        note: 'Auto-created via Quick Receive',
                    },
                });
            }
        }

        if (!product) return err('ไม่พบสินค้า', 404);

        const totalCost = data.quantity * (data.unitCost || 0);

        await prisma.inventory.upsert({
            where: { tenantId_productId_locationId: { tenantId, productId: product.id, locationId: location.id } },
            create: {
                tenantId,
                productId: product.id,
                locationId: location.id,
                quantity: data.quantity,
                avgCost: data.unitCost || 0,
            },
            update: {
                quantity: { increment: data.quantity },
                avgCost: data.unitCost ?? undefined,
            }
        });

        await prisma.stockMovement.create({
            data: {
                tenantId,
                productId: product.id,
                toLocationId: location.id,
                quantity: data.quantity,
                unitCost: data.unitCost || 0,
                totalCost,
                type: 'PURCHASE',
                referenceType: 'QUICK_RECEIVE',
                note: 'Quick Receive: ' + product.name + ' -> ' + data.locationCode,
                createdById: context.user?.userId || null,
            },
        });

        return ok({
            productName: product.name,
            sku: product.sku,
            quantity: data.quantity,
            unit: product.unit,
            locationCode: data.locationCode,
        });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return err(error.errors.map((e) => e.message).join(', '), 400);
        }
        console.error('Quick receive error:', error);
        return err('Quick Receive Internal Server Error', 500);
    }
}, ['OWNER', 'MANAGER', 'WAREHOUSE']);