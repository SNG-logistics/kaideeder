const fs = require('fs');
const path = 'c:\\projects\\pos 43\\pos all in one\\kaideeder\\src\\app\\(dashboard)\\products\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

const insertion = `        finally { setSaving(false) }
    }

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

// Insert handleDelete right after handleSave (which ends with finally { setSaving(false) })
// instead of after handleImageUpload, to avoid regex misses.
const rx = /finally\s*\{\s*setSaving\(false\)\s*\}\s*\r?\n\s*\}/;

if (content.match(rx)) {
    content = content.replace(rx, insertion);
    fs.writeFileSync(path, content, 'utf8');
    console.log("handleDelete inserted successfully.");
} else {
    console.log("Could not find insertion point.");
}
