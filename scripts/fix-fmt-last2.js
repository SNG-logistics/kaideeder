const fs = require('fs')
const path = require('path')
const basePath = process.cwd()

function fixMenu() {
    const file = path.join(basePath, 'src/app/(dashboard)/menu/page.tsx')
    let code = fs.readFileSync(file, 'utf8')
    const search = "function MenuCard({ product: p, onEdit, onPhoto }: {\r\n    product: Product; onEdit: () => void; onPhoto: () => void\r\n}) {\r\n    return (\r\n"
    const searchLF = search.replace(/\r\n/g, '\n')
    if (code.includes(search)) {
        code = code.replace(search, "function MenuCard({ product: p, onEdit, onPhoto }: {\r\n    product: Product; onEdit: () => void; onPhoto: () => void\r\n}) {\r\n    const { fmt } = useCurrency();\r\n    return (\r\n")
        fs.writeFileSync(file, code)
        console.log('Fixed menu')
    } else if (code.includes(searchLF)) {
        code = code.replace(searchLF, "function MenuCard({ product: p, onEdit, onPhoto }: {\n    product: Product; onEdit: () => void; onPhoto: () => void\n}) {\n    const { fmt } = useCurrency();\n    return (\n")
        fs.writeFileSync(file, code)
        console.log('Fixed menu LF')
    }
}
fixMenu()

function fixProducts() {
    const file = path.join(basePath, 'src/app/(dashboard)/products/page.tsx')
    let code = fs.readFileSync(file, 'utf8')
    if (code.includes("import { useCurrency } from '@/context/TenantContext'")) {
        code = code.replace("import { useCurrency } from '@/context/TenantContext'\r\n", "")
        code = code.replace("import { useCurrency } from '@/context/TenantContext'\n", "")
        code = code.replace("import toast from 'react-hot-toast'", "import toast from 'react-hot-toast'\nimport { useCurrency } from '@/context/TenantContext'")
        fs.writeFileSync(file, code)
        console.log('Fixed products')
    }
}
fixProducts()

function fixPos() {
    const file = path.join(basePath, 'src/app/pos/page.tsx')
    let code = fs.readFileSync(file, 'utf8')
    if (!code.includes("import { useCurrency } from '@/context/TenantContext'")) {
        code = code.replace("import { useStoreBranding } from '@/hooks/useStoreBranding'", "import { useStoreBranding } from '@/hooks/useStoreBranding'\nimport { useCurrency } from '@/context/TenantContext'")
        fs.writeFileSync(file, code)
        console.log('Fixed pos')
    }
}
fixPos()

function fixSalesImport() {
    const file = path.join(basePath, 'src/app/(dashboard)/sales-import/page.tsx')
    let code = fs.readFileSync(file, 'utf8')
    const search1 = "const { fmt } = useCurrency()\r\n    const { fmt } = useCurrency();"
    const search2 = search1.replace(/\r\n/g, '\n')
    if (code.includes(search1)) {
        code = code.replace(search1, "const { fmt } = useCurrency()")
        fs.writeFileSync(file, code)
        console.log('Fixed sales import')
    } else if (code.includes(search2)) {
        code = code.replace(search2, "const { fmt } = useCurrency()")
        fs.writeFileSync(file, code)
        console.log('Fixed sales import LF')
    }
}
fixSalesImport()

function fixInventory() {
    const file = path.join(basePath, 'src/app/(dashboard)/inventory/page.tsx')
    let code = fs.readFileSync(file, 'utf8')
    const search = "function EditModal({ inv, onClose, onSaved }: { inv: InvItem; onClose: () => void; onSaved: () => void }) {\r\n    const [qty, setQty] = useState(String(inv.quantity))"
    const searchLF = search.replace(/\r\n/g, '\n')
    if (code.includes(search)) {
        code = code.replace(search, "function EditModal({ inv, onClose, onSaved }: { inv: InvItem; onClose: () => void; onSaved: () => void }) {\r\n    const { fmt } = useCurrency();\r\n    const [qty, setQty] = useState(String(inv.quantity))")
        fs.writeFileSync(file, code)
        console.log('Fixed inventory')
    } else if (code.includes(searchLF)) {
        code = code.replace(searchLF, "function EditModal({ inv, onClose, onSaved }: { inv: InvItem; onClose: () => void; onSaved: () => void }) {\n    const { fmt } = useCurrency();\n    const [qty, setQty] = useState(String(inv.quantity))")
        fs.writeFileSync(file, code)
        console.log('Fixed inventory LF')
    }
}
fixInventory()

function fixPurchase() {
    const file = path.join(basePath, 'src/app/(dashboard)/purchase/page.tsx')
    let code = fs.readFileSync(file, 'utf8')
    const search = "export default function PurchasePage() {\r\n"
    const searchLF = search.replace(/\r\n/g, '\n')
    if (code.includes(search) && !code.includes("const { fmt } = useCurrency();")) {
        code = code.replace(search, "export default function PurchasePage() {\r\n    const { fmt } = useCurrency();\r\n")
        fs.writeFileSync(file, code)
        console.log('Fixed purchase')
    } else if (code.includes(searchLF) && !code.includes("const { fmt } = useCurrency();")) {
        code = code.replace(searchLF, "export default function PurchasePage() {\n    const { fmt } = useCurrency();\n")
        fs.writeFileSync(file, code)
        console.log('Fixed purchase LF')
    }
}
fixPurchase()
