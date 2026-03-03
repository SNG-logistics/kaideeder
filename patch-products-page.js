// @ts-nocheck
// patch-products-page.js — adds drink tab + fixes category codes
const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'src/app/(dashboard)/products/page.tsx')

// Read and normalize line endings to \n
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')

// 1. Replace category codes + TabKey
const old1 = `const RAW_CATEGORY_CODES = ['RAW_MEAT', 'RAW_PORK', 'RAW_SEA', 'RAW_VEG', 'DRY_GOODS', 'PACKAGING', 'OTHER']
const MEAT_CODES = ['RAW_MEAT', 'RAW_PORK', 'RAW_SEA']
const VEG_CODES = ['RAW_VEG', 'DRY_GOODS', 'OTHER']
const PKG_CODES = ['PACKAGING']
const STOCK_TYPES = ['RAW_MATERIAL', 'PACKAGING']

type TabKey = 'meat' | 'veg' | 'pkg' | 'all'`

const new1 = `const DRINK_CODES = ['BEER', 'BEER_DRAFT', 'WINE', 'COCKTAIL', 'DRINK', 'WATER']
const MEAT_CODES = ['RAW_MEAT', 'RAW_PORK', 'RAW_SEA']
const VEG_CODES = ['RAW_VEG', 'DRY_GOODS', 'OTHER']
const PKG_CODES = ['PACKAGING']
const RAW_CATEGORY_CODES = [...MEAT_CODES, ...VEG_CODES, ...PKG_CODES, ...DRINK_CODES]
const STOCK_TYPES = ['RAW_MATERIAL', 'PACKAGING']

type TabKey = 'meat' | 'veg' | 'pkg' | 'drink' | 'all'`

if (content.includes(old1)) {
    content = content.replace(old1, new1)
    console.log('1. ✓ DRINK_CODES + TabKey updated')
} else {
    console.log('1. ⚠ Already patched or pattern not found — skipping')
}

// 2. Update useEffect — add drink case BEFORE else
const old2 = `        } else if (activeTab === 'pkg') {
            setCategories(allCategories.filter(c => PKG_CODES.includes(c.code)))
        } else {
            setCategories(allCategories.filter(c => RAW_CATEGORY_CODES.includes(c.code)))
        }`

const new2 = `        } else if (activeTab === 'pkg') {
            setCategories(allCategories.filter(c => PKG_CODES.includes(c.code)))
        } else if (activeTab === 'drink') {
            setCategories(allCategories.filter(c => DRINK_CODES.includes(c.code)))
        } else {
            setCategories(allCategories.filter(c => RAW_CATEGORY_CODES.includes(c.code)))
        }`

if (content.includes(old2)) {
    content = content.replace(old2, new2)
    console.log('2. ✓ useEffect drink case added')
} else {
    console.log('2. ⚠ Already patched or pattern not found — skipping')
}

// 3. Update filteredProducts — add drink case
const old3 = `        if (activeTab === 'pkg') return PKG_CODES.includes(p.category?.code)
        return true`

const new3 = `        if (activeTab === 'pkg') return PKG_CODES.includes(p.category?.code)
        if (activeTab === 'drink') return DRINK_CODES.includes(p.category?.code)
        return true`

if (content.includes(old3)) {
    content = content.replace(old3, new3)
    console.log('3. ✓ filteredProducts drink case added')
} else {
    console.log('3. ⚠ Already patched or pattern not found — skipping')
}

// 4. Add drink tab to tabs array
const old4 = `        { key: 'veg', label: 'ผัก / ของแห้ง', icon: '🥬' },
        { key: 'pkg', label: 'บรรจุภัณฑ์', icon: '📦' },`

const new4 = `        { key: 'veg', label: 'ผัก / ของแห้ง', icon: '🥬' },
        { key: 'drink', label: 'เครื่องดื่ม', icon: '🍺' },
        { key: 'pkg', label: 'บรรจุภัณฑ์', icon: '📦' },`

if (content.includes(old4)) {
    content = content.replace(old4, new4)
    console.log('4. ✓ drink tab added to tabs array')
} else {
    console.log('4. ⚠ Already patched or pattern not found — skipping')
}

// Write back (UTF-8, LF endings)
fs.writeFileSync(filePath, content, 'utf8')
console.log('\n✅ products/page.tsx patched!')
console.log('Final checks:')
console.log('  DRINK_CODES   :', content.includes('DRINK_CODES') ? '✓' : '✗')
console.log('  drink tab     :', content.includes("key: 'drink'") ? '✓' : '✗')
console.log('  drink filter  :', content.includes("activeTab === 'drink') return DRINK") ? '✓' : '✗')
