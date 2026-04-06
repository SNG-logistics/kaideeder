'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Item {
  id: string
  name: string
  normalizedName: string
}

interface DuplicateGroup {
  groupName: string
  items: Item[]
}

export default function DuplicateMergePage() {
  const router = useRouter()
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null)
  const [masterId, setMasterId] = useState<string>('')
  const [merging, setMerging] = useState(false)

  const fetchDuplicates = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/items/duplicates')
      const data = await res.json()
      if (data.success) {
        setDuplicateGroups(data.data.normalizedGroups || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDuplicates()
  }, [])

  const handleMerge = async () => {
    if (!selectedGroup || !masterId) return
    const aliasIds = selectedGroup.items.filter((i) => i.id !== masterId).map((i) => i.id)

    if (aliasIds.length === 0) return

    setMerging(true)
    try {
      const res = await fetch('/api/items/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterId, aliasIds }),
      })
      const data = await res.json()
      if (data.success) {
        alert(data.data.message || 'ยุบรวมสำเร็จ')
        setSelectedGroup(null)
        setMasterId('')
        fetchDuplicates()
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setMerging(false)
    }
  }

  return (
    <div style={{ padding: '24px', backgroundColor: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
              color: '#4F46E5', fontSize: '20px'
            }}>
              🔗
            </span>
            ยุบรวมข้อมูลซ้ำซ้อน (Merge Duplicates)
          </h1>
          <p style={{ color: '#64748B', marginTop: '4px', fontSize: '14px' }}>
            ตรวจพบชื่อรายการผอมหรือพิมพ์ซ้ำ ให้เลือกตัวหลัก (Master) แล้วยุบตัวโคลนทิ้ง
          </p>
        </div>
        <Link href="/inventory-catalog" passHref>
          <button style={{
            padding: '10px 16px', borderRadius: '12px', 
            backgroundColor: '#FFF', border: '1px solid #E2E8F0',
            color: '#475569', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            กลับหน้า Catalog
          </button>
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: '#94A3B8' }}>กำลังค้นหาประวัติที่ซ้ำกัน...</div>
      ) : duplicateGroups.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px', backgroundColor: '#FFF', 
          borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
          <h3 style={{ color: '#0F172A', fontWeight: 600, fontSize: '18px' }}>ฐานข้อมูลสะอาดยอดเยี่ยม!</h3>
          <p style={{ color: '#64748B', marginTop: '8px' }}>ยังไม่พบข้อมูลที่น่าจะซ้ำซ้อนในขณะนี้</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedGroup ? '1fr 1fr' : '1fr', gap: '24px' }}>
          
          {/* ขวา หรือ เต็มจอ: รายการ Groups */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {duplicateGroups.map((group) => (
              <div 
                key={group.groupName}
                onClick={() => {
                  setSelectedGroup(group)
                  setMasterId(group.items[0].id)
                }}
                style={{
                  padding: '20px', backgroundColor: '#FFF', borderRadius: '16px',
                  border: selectedGroup?.groupName === group.groupName ? '2px solid #8B5CF6' : '1px solid #E2E8F0',
                  boxShadow: selectedGroup?.groupName === group.groupName ? '0 10px 25px -5px rgba(139, 92, 246, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  transform: selectedGroup?.groupName === group.groupName ? 'scale(1.01)' : 'scale(1)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ color: '#1E293B', fontWeight: 600, fontSize: '18px' }}>
                    กลุ่มคำ: "{group.groupName}"
                  </h3>
                  <span style={{ backgroundColor: '#FEE2E2', color: '#EF4444', padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 }}>
                    พบ {group.items.length} รายการ
                  </span>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {group.items.map(item => (
                    <span key={item.id} style={{ backgroundColor: '#F1F5F9', color: '#475569', padding: '6px 12px', borderRadius: '8px', fontSize: '14px' }}>
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* ขวา: หน้าจอทำ Merge */}
          {selectedGroup && (
            <div style={{
              backgroundColor: '#FFF', borderRadius: '24px', padding: '32px',
              border: '1px solid #E2E8F0', boxShadow: '0 10px 40px rgba(0,0,0,0.06)',
              position: 'sticky', top: '24px', alignSelf: 'start'
            }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
                จัดการการยุบรวม (Merge)
              </h2>
              <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
                โปรดเลือกตัวที่เป็น "Master" ระบบจะโอนย้ายความสัมพันธ์ทั้งหมดไปยัง Master เลิกใช้งานตัวอื่นและเก็บเป็น Alias โดยอัตโนมัติ
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                {selectedGroup.items.map((item) => {
                  const isMaster = masterId === item.id
                  return (
                    <div 
                      key={item.id}
                      onClick={() => setMasterId(item.id)}
                      style={{
                        padding: '16px', borderRadius: '12px', cursor: 'pointer',
                        border: isMaster ? '2px solid #10B981' : '1px solid #E2E8F0',
                        backgroundColor: isMaster ? '#F0FDF4' : '#FFF',
                        display: 'flex', alignItems: 'center', gap: '16px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        border: isMaster ? '7px solid #10B981' : '2px solid #CBD5E1',
                        backgroundColor: '#FFF'
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: isMaster ? '#065F46' : '#334155', fontWeight: 600 }}>{item.name}</div>
                        <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '2px', fontFamily: 'monospace' }}>ID: {item.id}</div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: isMaster ? '#10B981' : '#94A3B8' }}>
                        {isMaster ? 'ยึดเป็น Master' : 'ตกลงไปเป็น Alias'}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setSelectedGroup(null)}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: '#F1F5F9',
                    color: '#64748B', fontWeight: 600, cursor: 'pointer', border: 'none'
                  }}>
                  ยกเลิก
                </button>
                <button 
                  onClick={handleMerge}
                  disabled={merging}
                  style={{
                    flex: 2, padding: '14px', borderRadius: '12px', 
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
                    color: '#FFF', fontWeight: 600, cursor: merging ? 'not-allowed' : 'pointer', border: 'none',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)', opacity: merging ? 0.7 : 1
                  }}>
                  {merging ? 'กำลังยุบรวม...' : `ผนวก ${selectedGroup.items.length - 1} รายการเข้า Master`}
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
