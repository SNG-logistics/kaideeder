const fs = require('fs');
const path = require('path');

const files = [
    'src/app/(dashboard)/sales-import/page.tsx',
    'src/app/(dashboard)/reports/reportssalespage.tsx',
    'src/app/(dashboard)/reports/daily-summary/page.tsx',
    'src/app/(dashboard)/purchase/page.tsx',
    'src/app/(dashboard)/menu/page.tsx',
    'src/app/(dashboard)/inventory/page.tsx',
    'src/app/(dashboard)/dashboard/page.tsx',
    'src/app/(dashboard)/products/page.tsx'
];

const basePath = process.cwd();

for (const relPath of files) {
    const fullPath = path.join(basePath, relPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`File not found: ${fullPath}`);
        continue;
    }

    let code = fs.readFileSync(fullPath, 'utf8');

    // 1. Replace imports
    if (code.includes('import { formatLAK, formatLAKShort } from \'@/lib/utils\'')) {
        code = code.replace('import { formatLAK, formatLAKShort } from \'@/lib/utils\'', '');
    } else if (code.includes('import { formatLAK, formatNumber } from \'@/lib/utils\'')) {
        code = code.replace('import { formatLAK, formatNumber } from \'@/lib/utils\'', 'import { formatNumber } from \'@/lib/utils\'');
    } else if (code.includes('import { formatLAK } from \'@/lib/utils\'')) {
        code = code.replace('import { formatLAK } from \'@/lib/utils\'', '');
    }

    // Add useCurrency import if not there
    if (!code.includes('import { useCurrency } from \'@/context/TenantContext\'')) {
        // Add after the last import
        const importMatch = code.match(/import .*\n/gi);
        if (importMatch && importMatch.length > 0) {
            const lastImportIndex = code.lastIndexOf(importMatch[importMatch.length - 1]);
            code = code.slice(0, lastImportIndex + importMatch[importMatch.length - 1].length) +
                'import { useCurrency } from \'@/context/TenantContext\'\n' +
                code.slice(lastImportIndex + importMatch[importMatch.length - 1].length);
        } else {
            // just put it at top (after 'use client' if it exists)
            code = code.replace(/^('use client'|"use client");?\s*/, '$&\nimport { useCurrency } from \'@/context/TenantContext\';\n');
        }
    }

    // Ensure 'use client' is present
    if (!code.includes('use client')) {
        code = "'use client'\n" + code;
    }

    // Add const { fmt } = useCurrency() inside default export function
    // Look for export default function Name() {
    const functionMatch = code.match(/export default function\s+\w+\([^)]*\)\s*\{/);
    if (functionMatch && !code.includes('useCurrency()')) {
        const insertPos = functionMatch.index + functionMatch[0].length;
        code = code.slice(0, insertPos) + '\n    const { fmt } = useCurrency();\n' + code.slice(insertPos);
    }

    // Replace formatLAK( -> fmt(
    code = code.replace(/formatLAK\(/g, 'fmt(');
    // Replace formatLAKShort( -> fmt(
    code = code.replace(/formatLAKShort\(/g, 'fmt(');

    fs.writeFileSync(fullPath, code);
    console.log(`Updated ${relPath}`);
}
