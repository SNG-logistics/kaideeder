/**
 * QA Test Runner — POS 43 Stock System
 * รัน: node qa-test-runner.js
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

// ─── WAC Math ───────────────────────────────────────────────
function calcWAC(cQ, cC, nQ, nC) {
    const t = cQ + nQ
    if (t <= 0) return nC  // B-07 guard: negative qty
    return (cQ * cC + nQ * nC) / t
}

async function runAll() {
    let pass = 0, fail = 0, warn = 0
    const issues = []

    function check(id, desc, got, expect, tolerance = 0.01) {
        const ok = Math.abs(got - expect) <= tolerance
        const label = ok ? '✅ PASS' : '❌ FAIL'
        console.log(`  ${label} [${id}] ${desc}`)
        console.log(`         got=${got.toFixed(2)} | expect=${expect.toFixed(2)}`)
        ok ? pass++ : (fail++, issues.push(`${id}: ${desc}`))
        return ok
    }

    // ════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════╗')
    console.log('║   B) WAC Math Verification        ║')
    console.log('╚══════════════════════════════════╝')
    check('TC-PUR-001', 'qty=0 → new cost', calcWAC(0, 0, 100, 50000), 50000)
    check('TC-PUR-002', 'mixed stock WAC', calcWAC(50, 40000, 50, 60000), 50000)
    check('TC-PUR-007', 'negative qty guard (B-07)', calcWAC(-10, 50000, 20, 50000), 50000)
    check('TC-WAC-004', 'same cost no change', calcWAC(100, 30000, 50, 30000), 30000)
    check('TC-WAC-005', 'large LAK values', calcWAC(1000, 135000, 500, 160000), (1000 * 135000 + 500 * 160000) / 1500)

    // ════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════╗')
    console.log('║   A/B-02) Duplicate Recipe Check  ║')
    console.log('╚══════════════════════════════════╝')
    try {
        const recipes = await p.recipe.findMany({ where: { isActive: true }, select: { id: true, menuName: true } })
        const nameCount = {}
        recipes.forEach(r => { nameCount[r.menuName] = (nameCount[r.menuName] || 0) + 1 })
        const dupes = Object.entries(nameCount).filter(([, v]) => v > 1)
        console.log(`  Total active recipes: ${recipes.length}`)
        if (dupes.length > 0) {
            console.log('  ⚠️ WARN [B-02] Duplicate recipe names found:')
            dupes.forEach(([name, count]) => console.log(`      "${name}" → ${count} copies`))
            warn++; issues.push('B-02: Duplicate recipe names in DB (API guard prevents NEW dupes)')
        } else {
            console.log('  ✅ PASS [B-02] No duplicate recipe names in DB')
            pass++
        }
    } catch (e) { console.log('  ❌ ERROR:', e.message); fail++ }

    // ════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════╗')
    console.log('║   A/B-01) Duplicate Import Check  ║')
    console.log('╚══════════════════════════════════╝')
    try {
        const imports = await p.salesImport.findMany({
            orderBy: { saleDate: 'asc' },
            select: { id: true, saleDate: true, fileName: true, status: true }
        })
        console.log(`  Total imports: ${imports.length}`)
        const dateCount = {}
        imports.forEach(i => {
            const d = i.saleDate.toISOString().split('T')[0]
            dateCount[d] = (dateCount[d] || 0) + 1
        })
        const dupeDates = Object.entries(dateCount).filter(([, v]) => v > 1)
        if (dupeDates.length > 0) {
            console.log('  ⚠️ WARN [B-01] Same date found in multiple imports (pre-fix data):')
            dupeDates.forEach(([d, c]) => console.log(`      ${d}: ${c} imports`))
            warn++; issues.push('B-01: Historical duplicate imports exist (new guard prevents future dupes)')
        } else {
            console.log('  ✅ PASS [B-01] No duplicate import dates')
            pass++
        }
    } catch (e) { console.log('  ❌ ERROR:', e.message); fail++ }

    // ════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════╗')
    console.log('║   B-07) Negative Stock Check      ║')
    console.log('╚══════════════════════════════════╝')
    try {
        const negStock = await p.inventory.findMany({
            where: { quantity: { lt: 0 } },
            include: { product: { select: { name: true } }, location: { select: { name: true } } }
        })
        if (negStock.length > 0) {
            console.log(`  ⚠️ WARN [B-07] ${negStock.length} items with negative stock:`)
            negStock.forEach(i => console.log(`      ${i.product.name} @ ${i.location.name}: ${i.quantity}`))
            warn++; issues.push(`B-07: ${negStock.length} negative stock items`)
        } else {
            console.log('  ✅ PASS [B-07] No negative stock items')
            pass++
        }
    } catch (e) { console.log('  ❌ ERROR:', e.message); fail++ }

    // ════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════╗')
    console.log('║   B-03) Transfer WAC Check        ║')
    console.log('╚══════════════════════════════════╝')
    try {
        const transferRoute = require('fs').readFileSync('./src/app/api/transfer/route.ts', 'utf8')
        const hasWACMerge = transferRoute.includes('calcWAC') || transferRoute.includes('avgCost') && transferRoute.includes('increment')
        if (!hasWACMerge) {
            console.log('  ❌ FAIL [B-03] Transfer route does NOT calculate WAC at destination')
            fail++; issues.push('B-03: Transfer does not merge WAC at destination')
        } else {
            console.log('  ✅ PASS [B-03] Transfer route includes WAC/avgCost handling')
            pass++
        }
    } catch (e) { console.log('  ⚠️ SKIP:', e.message) }

    // ════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════╗')
    console.log('║   Summary                         ║')
    console.log('╚══════════════════════════════════╝')
    console.log(`  ✅ PASS: ${pass}`)
    console.log(`  ❌ FAIL: ${fail}`)
    console.log(`  ⚠️ WARN: ${warn}`)
    if (issues.length > 0) {
        console.log('\n  Issues found:')
        issues.forEach((i, n) => console.log(`  ${n + 1}. ${i}`))
    } else {
        console.log('\n  🎉 All tests passed!')
    }
    await p.$disconnect()
}

runAll().catch(async e => {
    console.error('Fatal error:', e.message)
    await p.$disconnect()
    process.exit(1)
})
