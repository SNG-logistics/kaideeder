'use client'
import { useState, useRef, useEffect } from 'react'

export type LayoutTable = {
    id: string
    number: number
    name: string
    zone: string
    seats: number
    isActive: boolean
    posX: number
    posY: number
    width: number
    height: number
    shape: string // 'square', 'rectangle', 'circle'
}

interface Props {
    zone: string
    tables: LayoutTable[]
    onSave: (tables: LayoutTable[]) => Promise<void>
    onClose: () => void
}

export default function TableLayoutEditor({ zone, tables: initialTables, onSave, onClose }: Props) {
    const [tables, setTables] = useState<LayoutTable[]>(initialTables)
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const canvasRef = useRef<HTMLDivElement>(null)

    // Dragging state
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

    const handlePointerDown = (e: React.PointerEvent, id: string) => {
        if (!canvasRef.current) return
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        // Offset inside the table element
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        })
        setDraggingId(id)
        setSelectedTableId(id)
    }

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!draggingId || !canvasRef.current) return
        
        const canvasRect = canvasRef.current.getBoundingClientRect()
        // Calculate new X, Y relative to canvas
        let newX = e.clientX - canvasRect.left - dragOffset.x
        let newY = e.clientY - canvasRect.top - dragOffset.y

        // Snap to grid (e.g. 20px)
        const gridSize = 20
        newX = Math.round(newX / gridSize) * gridSize
        newY = Math.round(newY / gridSize) * gridSize

        // Boundaries
        newX = Math.max(0, newX)
        newY = Math.max(0, newY)

        setTables(prev => prev.map(t => t.id === draggingId ? { ...t, posX: newX, posY: newY } : t))
    }

    const handlePointerUp = (e: React.PointerEvent) => {
        if (draggingId) {
            e.currentTarget.releasePointerCapture(e.pointerId)
            setDraggingId(null)
        }
    }

    const changeShape = (shape: string) => {
        if (!selectedTableId) return
        setTables(prev => prev.map(t => {
            if (t.id !== selectedTableId) return t
            let w = t.width, h = t.height
            if (shape === 'square' || shape === 'circle') { w = 80; h = 80 }
            else if (shape === 'rectangle') { w = 120; h = 80 }
            return { ...t, shape, width: w, height: h }
        }))
    }

    const rotateTable = () => {
        if (!selectedTableId) return
        setTables(prev => prev.map(t => {
            if (t.id !== selectedTableId || t.shape !== 'rectangle') return t
            // Swap width and height
            return { ...t, width: t.height, height: t.width }
        }))
    }

    const handleSave = async () => {
        setSaving(true)
        await onSave(tables)
        setSaving(false)
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: '#0f1221', display: 'flex', flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                padding: '1rem 1.5rem', background: '#1e293b', borderBottom: '1px solid #334155',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button onClick={onClose} style={{
                        background: 'none', border: '1px solid #475569', color: '#cbd5e1', padding: '0.4rem 0.8rem',
                        borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem'
                    }}>← กลับ</button>
                    <div>
                        <h2 style={{ color: '#f8fafc', margin: 0, fontSize: '1.1rem' }}>🗺️ จัดผังร้าน: โซน {zone}</h2>
                        <p style={{ color: '#94a3b8', margin: '2px 0 0', fontSize: '0.8rem' }}>ลากเพื่อย้ายตำแหน่งโต๊ะ (Grid Snap 20px)</p>
                    </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {selectedTableId && (
                        <div style={{ display: 'flex', gap: 8, background: '#0f1221', padding: '0.4rem', borderRadius: 8, border: '1px solid #334155' }}>
                            <button onClick={() => changeShape('square')} title="โต๊ะสี่เหลี่ยมจัตุรัส" style={toolBtnStyle(tables.find(t=>t.id===selectedTableId)?.shape === 'square')}>⬜</button>
                            <button onClick={() => changeShape('rectangle')} title="โต๊ะสี่เหลี่ยมผืนผ้า" style={toolBtnStyle(tables.find(t=>t.id===selectedTableId)?.shape === 'rectangle')}>▭</button>
                            <button onClick={() => changeShape('circle')} title="โต๊ะกลม" style={toolBtnStyle(tables.find(t=>t.id===selectedTableId)?.shape === 'circle')}>⚪</button>
                            {tables.find(t=>t.id===selectedTableId)?.shape === 'rectangle' && (
                                <button onClick={rotateTable} title="หมุนโต๊ะ" style={toolBtnStyle(false)}>🔄</button>
                            )}
                        </div>
                    )}
                    <button onClick={handleSave} disabled={saving} style={{
                        background: '#3b82f6', color: '#fff', border: 'none', padding: '0.6rem 1.25rem',
                        borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
                    }}>
                        {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกผังร้าน'}
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div style={{ flex: 1, overflow: 'auto', padding: '2rem', display: 'flex', justifyContent: 'center', background: '#0f1221' }}>
                <div 
                    ref={canvasRef}
                    onPointerDown={() => setSelectedTableId(null)}
                    style={{
                        position: 'relative', width: 1200, height: 1600, // Large virtual canvas
                        background: '#1e293b', borderRadius: 16, border: '2px dashed #334155',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
                        backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)',
                        backgroundSize: '20px 20px', // Matches grid size
                        overflow: 'hidden'
                    }}
                >
                    {tables.map(table => {
                        const isSelected = selectedTableId === table.id
                        const isDragging = draggingId === table.id
                        return (
                            <div
                                key={table.id}
                                onPointerDown={(e) => handlePointerDown(e, table.id)}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                style={{
                                    position: 'absolute',
                                    left: table.posX,
                                    top: table.posY,
                                    width: table.width,
                                    height: table.height,
                                    borderRadius: table.shape === 'circle' ? '50%' : 8,
                                    background: isSelected ? '#3b82f6' : '#475569',
                                    border: isSelected ? '2px solid #60a5fa' : '1px solid #334155',
                                    color: '#fff', display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    cursor: isDragging ? 'grabbing' : 'grab',
                                    boxShadow: isSelected ? '0 0 15px rgba(59,130,246,0.5)' : '0 4px 6px -1px rgba(0,0,0,0.3)',
                                    zIndex: isSelected ? 10 : 1,
                                    touchAction: 'none', // Prevent scrolling on touch
                                    userSelect: 'none'
                                }}
                            >
                                <span style={{ fontWeight: 800, fontSize: table.shape === 'rectangle' ? '1.1rem' : '1rem' }}>{table.name}</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{table.seats} ที่นั่ง</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function toolBtnStyle(active: boolean): React.CSSProperties {
    return {
        background: active ? 'rgba(59,130,246,0.2)' : 'transparent',
        border: 'none',
        color: active ? '#60a5fa' : '#94a3b8',
        padding: '0.4rem',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: '1.2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    }
}
