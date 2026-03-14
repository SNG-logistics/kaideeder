const fs = require('fs');

const path = 'c:\\projects\\pos 43\\pos all in one\\kaideeder\\src\\app\\(dashboard)\\products\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetReturnLocation = `        finally { setSaving(false) }
    }

    // Prepare combobox list for categories
`;

const insertionHandleDelete = `
    const handleDelete = async () => {
        if (!product?.id) return
        if (!window.confirm(\`คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า "\${product.name}"?\`)) return
        setSaving(true)
        try {
            const res = await fetch(\`/api/products/\${product.id}\`, { method: 'DELETE' })
            const json = await res.json()
            if (json.success || json.deleted) {
                toast.success('🗑️ ลบสินค้าเรียบร้อย')
                onSaved()
            } else {
                toast.error(json.error || 'ลบไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาดในการลบ') }
        finally { setSaving(false) }
    }
`;

if (content.includes(targetReturnLocation)) {
    content = content.replace(targetReturnLocation, `        finally { setSaving(false) }\n    }\n${insertionHandleDelete}\n    // Prepare combobox list for categories\n`);
    console.log("Inserted handleDelete.");
} else {
    // Relaxed search for handleDelete insertion
    console.log("Failed to insert handleDelete. Using regex.");
    content = content.replace(/finally\s*\{\s*setSaving\(false\)\s*\}\s*\}\s*\/\/\s*Prepare\s*combobox\s*list\s*for\s*categories/g, `finally { setSaving(false) }\n    }\n${insertionHandleDelete}\n    // Prepare combobox list for categories`);
    console.log("Regex insert handleDelete finished.");
}

const targetFooterLocation = `                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                    <button onClick={onClose} className="btn-secondary" style={{ flex: 1, minHeight: 44 }}>ยกเลิก</button>`;

const insertionDeleteButton = `                    {isEdit && (
                        <button onClick={handleDelete} disabled={saving} className="btn-secondary" style={{ flex: 1, minHeight: 44, background: '#FEE2E2', color: '#DC2626', borderColor: '#FCA5A5' }}>🗑️ ลบ</button>
                    )}
`;

if (content.includes(targetFooterLocation)) {
    content = content.replace(targetFooterLocation, `                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>\n${insertionDeleteButton}                    <button onClick={onClose} className="btn-secondary" style={{ flex: 1, minHeight: 44 }}>ยกเลิก</button>`);
    console.log("Inserted delete button.");
} else {
    // Relaxed search for delete button insertion
    const rx = /<div style=\{\{\s*display:\s*'flex',\s*gap:\s*10,\s*marginTop:\s*18\s*\}\}>\s*<button onClick=\{onClose\}/;
    content = content.replace(rx, `<div style={{ display: 'flex', gap: 10, marginTop: 18 }}>\n${insertionDeleteButton}                    <button onClick={onClose}`);
    console.log("Regex insert delete button finished.");
}

fs.writeFileSync(path, content, 'utf8');
console.log("Script complete.");
