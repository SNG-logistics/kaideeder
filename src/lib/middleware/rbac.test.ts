// ============================================================
// tests/rbac.test.ts — Unit tests for requireRole middleware
// Run: npx jest tests/rbac.test.ts
// ============================================================

import { requireRole } from '@/lib/middleware/rbac'
import { CAN_MANAGE_ZONE_TABLE } from '@/lib/policy'
import type { AuthRequest } from '@/lib/middleware/rbac'
import type { Response, NextFunction } from 'express'

function mockUser(role: string) {
    return { id: 'u1', email: 'test@test.com', role, tenantId: 'T1', name: 'Test' }
}

function mockExpressCtx(role: string) {
    const req = { user: mockUser(role) } as AuthRequest
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    } as unknown as Response
    const next = jest.fn() as NextFunction
    return { req, res, next }
}

// ── requireRole ───────────────────────────────────────────────
describe('requireRole — CAN_MANAGE_ZONE_TABLE', () => {
    const middleware = requireRole(CAN_MANAGE_ZONE_TABLE)

    test('OWNER → passes (next called)', () => {
        const { req, res, next } = mockExpressCtx('OWNER')
        middleware(req, res, next)
        expect(next).toHaveBeenCalled()
        expect((res.status as jest.Mock)).not.toHaveBeenCalled()
    })

    test('MANAGER → passes (next called)', () => {
        const { req, res, next } = mockExpressCtx('MANAGER')
        middleware(req, res, next)
        expect(next).toHaveBeenCalled()
    })

    test('STAFF → 403 Forbidden', () => {
        const { req, res, next } = mockExpressCtx('STAFF')
        middleware(req, res, next)
        expect((res.status as jest.Mock)).toHaveBeenCalledWith(403)
        expect((res.json as jest.Mock)).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Forbidden' })
        )
        expect(next).not.toHaveBeenCalled()
    })

    test('CASHIER → 403 Forbidden', () => {
        const { req, res, next } = mockExpressCtx('CASHIER')
        middleware(req, res, next)
        expect((res.status as jest.Mock)).toHaveBeenCalledWith(403)
        expect(next).not.toHaveBeenCalled()
    })

    test('KITCHEN → 403 Forbidden', () => {
        const { req, res, next } = mockExpressCtx('KITCHEN')
        middleware(req, res, next)
        expect((res.status as jest.Mock)).toHaveBeenCalledWith(403)
        expect(next).not.toHaveBeenCalled()
    })
})

// ── tenantScope ───────────────────────────────────────────────
describe('tenantScope', () => {
    const { tenantScope } = require('@/lib/middleware/rbac')

    test('returns where clause with tenantId', () => {
        const user = mockUser('OWNER') as any
        const scope = tenantScope(user, { isActive: true })
        expect(scope).toEqual({ tenantId: 'T1', isActive: true })
    })

    test('cannot override tenantId via extra params', () => {
        const user = mockUser('OWNER') as any
        const scope = tenantScope(user, { tenantId: 'HACKER' })
        // tenantScope spreads user.tenantId first → extra extra tenantId gets overridden
        // or use Object.freeze / explicit assignment depending on impl
        expect(scope.tenantId).toBe('T1')
    })
})
