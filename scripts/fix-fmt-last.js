const fs = require('fs')
const path = require('path')

const basePath = process.cwd()

function retryWrite(filePath, fn) {
    const fullPath = path.join(basePath, filePath)
    if (!fs.existsSync(fullPath)) return;
    
    let success = false
    let retries = 5
    while (retries > 0 && !success) {
        try {
            let code = fs.readFileSync(fullPath, 'utf8')
            const newCode = fn(code)
            if (newCode !== code) {
                fs.writeFileSync(fullPath, newCode, 'utf8')
                console.log('Fixed', filePath)
            }
            success = true
        } catch (e) {
            console.log('Retry', filePath, e.message)
            retries--
            const wait = new Int32Array(new SharedArrayBuffer(4));
            Atomics.wait(wait, 0, 0, 500); // Wait 500ms
        }
    }
}

// 1. MenuCard in menu/page.tsx
retryWrite('src/app/(dashboard)/menu/page.tsx', (code) => {
    const search = "function MenuCard({ product: p, onEdit, onPhoto }: {\r\n    product: Product; onEdit: () => void; onPhoto: () => void\r\n}) {\r\n    return (\r\n"
    const searchLF = search.replace(/\r\n/g, '\n')
    
    if (code.includes(search)) {
        return code.replace(search, "function MenuCard({ product: p, onEdit, onPhoto }: {\r\n    product: Product; onEdit: () => void; onPhoto: () => void\r\n}) {\r\n    const { fmt } = useCurrency();\r\n    return (\r\n")
    } else if (code.includes(searchLF)) {
        return code.replace(searchLF, "function MenuCard({ product: p, onEdit, onPhoto }: {\n    product: Product; onEdit: () => void; onPhoto: () => void\n}) {\n    const { fmt } = useCurrency();\n    return (\n")
    }
    return code
})

// 2. products/page.tsx
retryWrite('src/app/(dashboard)/products/page.tsx', (code) => {
    let newCode = code
    if (newCode.includes("import { useCurrency } from '@/context/TenantContext'")) {
        newCode = newCode.replace("import { useCurrency } from '@/context/TenantContext'\r\n", "")
        newCode = newCode.replace("import { useCurrency } from '@/context/TenantContext'\n", "")
        
        if (!newCode.includes("import { useCurrency }")) {
            newCode = newCode.replace("import toast from 'react-hot-toast'", "import toast from 'react-hot-toast'\nimport { useCurrency } from '@/context/TenantContext'")
        }
    }
    return newCode
})

// 3. purchase/page.tsx (Missing useCurrency inside PurchasePage?)
retryWrite('src/app/(dashboard)/purchase/page.tsx', (code) => {
    let newCode = code
    // Check if fmt is already defined inside PurchasePage
    if (!newCode.includes('const { fmt } = useCurrency()')) {
        const search = 'export default function PurchasePage() {'
        if (newCode.includes(search)) {
            newCode = newCode.replace(search, search + '\n    const { fmt } = useCurrency();')
        }
    }
    return newCode
})

console.log('Done.')
