'use client'
import { useState, useEffect } from 'react'
import { adminFetch } from '@/lib/admin-fetch'

export default function PlatformConfigPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

    const [form, setForm] = useState({
        REGISTER_URL: '',
        CONTACT_URL: '',
    })

    useEffect(() => {
        // Fetch public config
        fetch('/api/admin/config')
            .then(r => r.json())
            .then(d => {
                if (d.success && d.data) {
                    setForm({
                        REGISTER_URL: d.data.REGISTER_URL || '',
                        CONTACT_URL: d.data.CONTACT_URL || '',
                    })
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMsg(null)
        try {
            const res = await adminFetch('/api/admin/config', {
                method: 'PATCH',
                body: JSON.stringify(form)
            })
            const d = await res.json()
            if (res.ok && d.success) {
                setMsg({ ok: true, text: 'บันทึกการตั้งค่าแพลตฟอร์มเรียบร้อยแล้ว' })
            } else {
                setMsg({ ok: false, text: d.error || 'เกิดข้อผิดพลาดในการบันทึก' })
            }
        } catch {
            setMsg({ ok: false, text: 'Network Error' })
        }
        setSaving(false)
    }

    if (loading) return <div className="p-8 text-slate-400">Loading settings...</div>

    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Platform Settings</h1>
                <p className="text-sm text-slate-400 mt-1">ตั้งค่าลิงก์และข้อมูลพื้นฐานของระบบส่วนกลาง (จุดที่ไม่ได้ผูกติดกับร้านค้าใดร้านค้าหนึ่ง)</p>
            </div>

            {msg && (
                <div className={`p-4 rounded-xl text-sm flex items-center gap-3 border ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    <span>{msg.ok ? '✅' : '⚠️'}</span>
                    {msg.text}
                </div>
            )}

            <form onSubmit={handleSave} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-6">

                {/* Registration Link */}
                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">ลิงก์หน้าลงทะเบียน (Registration URL)</label>
                    <input
                        type="url"
                        value={form.REGISTER_URL}
                        onChange={e => setForm({ ...form, REGISTER_URL: e.target.value })}
                        placeholder="https://register.kaideeder.com/home"
                        className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                    />
                    <p className="text-xs text-slate-500 mt-2">ลิงก์นี้จะแสดงอยู่ที่หน้าเข้าสู่ระบบ (Login) หากปล่อยว่างไว้ ระบบจะซ่อนปุ่มลงทะเบียน</p>
                </div>

                {/* Contact Link */}
                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">ลิงก์ติดต่อเรา (Contact Us URL)</label>
                    <input
                        type="url"
                        value={form.CONTACT_URL}
                        onChange={e => setForm({ ...form, CONTACT_URL: e.target.value })}
                        placeholder="https://facebook.com/yourpage"
                        className="w-full bg-white/[0.03] border border-white/10 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all"
                    />
                    <p className="text-xs text-slate-500 mt-2">ลิงก์สำหรับติดต่อแอดมินหรือศูนย์ช่วยเหลือ</p>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg"
                    >
                        {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
                    </button>
                </div>
            </form>
        </div>
    )
}
