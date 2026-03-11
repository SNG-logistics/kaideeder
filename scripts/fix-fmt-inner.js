const fs = require('fs');
const path = require('path');

const basePath = process.cwd();

function insertCode(filePath, searchString, insertString) {
    const fullPath = path.join(basePath, filePath);
    if (!fs.existsSync(fullPath)) return;
    let code = fs.readFileSync(fullPath, 'utf8');
    if (!code.includes(insertString.trim())) {
        const index = code.indexOf(searchString);
        if (index !== -1) {
            const pos = index + searchString.length;
            code = code.slice(0, pos) + '\n    ' + insertString + '\n' + code.slice(pos);
            fs.writeFileSync(fullPath, code);
            console.log(`Updated ${filePath}`);
        }
    }
}

// 1. inventory/page.tsx -> EditModal
insertCode('src/app/(dashboard)/inventory/page.tsx', 
           'function EditModal({ inv, onClose, onSaved }: { inv: InvItem; onClose: () => void; onSaved: () => void }) {',
           'const { fmt } = useCurrency();');

// 2. menu/page.tsx -> MenuCard
insertCode('src/app/(dashboard)/menu/page.tsx', 
           'function MenuCard({ product: p, onEdit, onPhoto }: {\n    product: Product; onEdit: () => void; onPhoto: () => void\n}) {',
           'const { fmt } = useCurrency();');

// 3. purchase/page.tsx -> ReviewModal
insertCode('src/app/(dashboard)/purchase/page.tsx', 
           'function ReviewModal({ data, onConfirm, onCancel }: { data: ScanResult; onConfirm: () => void; onCancel: () => void }) {',
           'const { fmt } = useCurrency();');

// 4. products/page.tsx -> import
const prodPath = path.join(basePath, 'src/app/(dashboard)/products/page.tsx');
if (fs.existsSync(prodPath)) {
    let pcode = fs.readFileSync(prodPath, 'utf8');
    if (!pcode.includes('import { useCurrency }')) {
        pcode = pcode.replace("import toast from 'react-hot-toast'\n", "import toast from 'react-hot-toast'\nimport { useCurrency } from '@/context/TenantContext'\n");
        fs.writeFileSync(prodPath, pcode);
        console.log(`Updated products/page.tsx`);
    }
}

// 5. pos/page.tsx -> POSPage
insertCode('src/app/pos/page.tsx', 
           'export default function POSPage() {',
           'const { fmt } = useCurrency();');

console.log('Fixes applied.');
