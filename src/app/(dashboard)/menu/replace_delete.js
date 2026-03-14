const fs = require('fs');

const path = 'c:\\projects\\pos 43\\pos all in one\\kaideeder\\src\\app\\(dashboard)\\menu\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetReturnLocation = `        finally { setSaving(false) }
    }

    return (`;

const insertionHandleDelete = `
    const handleDelete = async () => {
        if (!product?.id) return
        if (!window.confirm(\`คุณแน่ใจหรือไม่ว่าต้องการลบเมนู "\${product.name}"?\`)) return
        setSaving(true)
        try {
            const res = await fetch(\`/api/products/\${product.id}\`, { method: 'DELETE' })
            const json = await res.json()
            if (json.success || json.deleted) {
                toast.success('🗑️ ลบเมนูเรียบร้อย')
                onSaved()
            } else {
                toast.error(json.error || 'ลบไม่สำเร็จ')
            }
        } catch { toast.error('เกิดข้อผิดพลาดในการลบ') }
        finally { setSaving(false) }
    }
`;

if (content.includes(targetReturnLocation)) {
    content = content.replace(targetReturnLocation, `        finally { setSaving(false) }\n    }\n${insertionHandleDelete}\n    return (`);
    console.log("Inserted handleDelete.");
} else {
    // Relaxed search for handleDelete insertion
    const idx = content.indexOf('finally { setSaving(false) }\r\n    }\r\n\r\n    return (');
    if (idx !== -1) {
        content = content.replace('finally { setSaving(false) }\r\n    }\r\n\r\n    return (', `finally { setSaving(false) }\r\n    }\r\n${insertionHandleDelete}\n    return (`);
        console.log("Inserted handleDelete (CRLF).");
    } else {
        const idx2 = content.indexOf('finally { setSaving(false) }\n    }\n\n    return (');
        if (idx2 !== -1) {
            content = content.replace('finally { setSaving(false) }\n    }\n\n    return (', `finally { setSaving(false) }\n    }\n${insertionHandleDelete}\n    return (`);
            console.log("Inserted handleDelete (LF).");
        } else {
            console.log("Failed to insert handleDelete. Using regex.");
            content = content.replace(/finally\s*\{\s*setSaving\(false\)\s*\}\s*\}\s*return\s*\(/g, `finally { setSaving(false) }\n    }\n${insertionHandleDelete}\n    return (`);
            console.log("Regex insert handleDelete finished.");
        }
    }
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
