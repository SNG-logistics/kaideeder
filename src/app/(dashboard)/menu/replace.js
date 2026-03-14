const fs = require('fs');

const path = 'c:\\projects\\pos 43\\pos all in one\\kaideeder\\src\\app\\(dashboard)\\menu\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

const searchStr = '<label className="label">SKU{!isEdit && <span style={{ color: \'#059669\', fontWeight: 500 }}> (อัตโนมัติ)</span>}</label>';

const idx = content.indexOf(searchStr);
if (idx === -1) {
    console.log("Could not find label");
    process.exit(1);
}

// Find the preceding <div>
const divIdx = content.lastIndexOf('<div>', idx);
if (divIdx === -1) {
    console.log("Could not find opening div");
    process.exit(1);
}

// Find the end of the input element which is followed by </div>
const inputEndIdx = content.indexOf('</div>', idx);
if (inputEndIdx === -1) {
    console.log("Could not find closing div");
    process.exit(1);
}

const closingDivEnd = inputEndIdx + 6;

const replacement = `<div ref={skuRef} style={{ position: 'relative' }}>
                            <label className="label">SKU (!isEdit ? ' (ตั้งใหม่ หรือค้นหาสต็อก)' : '')</label>
                            <input
                                value={skuLoading ? '...' : (isEdit ? form.sku : skuSearch)}
                                readOnly={isEdit}
                                onChange={e => {
                                    setSkuSearch(e.target.value)
                                    setForm(f => ({ ...f, sku: e.target.value, id: '' }))
                                    setSkuOpen(true)
                                }}
                                onFocus={() => !isEdit && setSkuOpen(true)}
                                className="input" style={{ minHeight: 40, background: isEdit ? undefined : '#F3F4F6', fontWeight: 700, color: 'var(--accent)' }}
                                placeholder="ค้นหา รหัส, ชื่อวัตถุดิบ..."
                            />
                            {!isEdit && skuOpen && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                    background: '#fff', border: '1px solid var(--border)',
                                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    zIndex: 100, maxHeight: 200, overflowY: 'auto',
                                }}>
                                    {filteredStockProducts.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => {
                                                setForm(f => ({
                                                    ...f,
                                                    id: p.id,
                                                    sku: p.sku,
                                                    name: p.name,
                                                    categoryId: p.category?.id || f.categoryId,
                                                    unit: p.unit,
                                                    costPrice: p.costPrice,
                                                    salePrice: p.salePrice || f.salePrice,
                                                }))
                                                setSkuSearch(p.sku)
                                                setCatSearch(p.category?.name || catSearch)
                                                setSkuOpen(false)
                                            }}
                                            style={{
                                                padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                                                display: 'flex', flexDirection: 'column', gap: 2,
                                                background: form.id === p.id ? '#F0FDF4' : 'transparent',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                                            onMouseLeave={e => (e.currentTarget.style.background = form.id === p.id ? '#F0FDF4' : 'transparent')}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#059669' }}>{p.sku}</span>
                                                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{p.category.name}</span>
                                            </div>
                                            <span style={{ fontSize: '0.85rem' }}>{p.name}</span>
                                        </div>
                                    ))}
                                    {filteredStockProducts.length === 0 && skuSearch.trim() && (
                                        <div style={{ padding: '12px', color: '#9CA3AF', textAlign: 'center', fontSize: '0.82rem' }}>เพิ่มใหม่รหัส: {skuSearch}</div>
                                    )}
                                </div>
                            )}
                        </div>`;

content = content.substring(0, divIdx) + replacement + content.substring(closingDivEnd);
fs.writeFileSync(path, content, 'utf8');
console.log("Success with substring logic.");
