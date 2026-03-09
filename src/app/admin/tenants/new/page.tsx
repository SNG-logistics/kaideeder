'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewTenantPage() {
    const router = useRouter()
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [form, setForm] = useState({ code: '', name: '' })

    const field = (key: keyof typeof form) => ({
        value: form[key],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
        className: 'w-full bg-white/[0.03] border border-white/10 text-slate-200 text-sm md:text-base rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:bg-indigo-500/5 transition-all placeholder:text-slate-600',
    })

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMsg(null)
        const res = await fetch('/api/admin/tenants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        const d = await res.json()
        setSaving(false)
        if (d.success) {
            router.push(`/admin/tenants/${d.data.id}`)
        } else {
            setMsg({ ok: false, text: d.error ?? 'Error creating tenant' })
        }
    }

    return (
        <div className="max-w-2xl mx-auto w-full">
            {/* Header & Breadcrumb */}
            <div className="mb-6 md:mb-8">
                <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500 mb-2">
                    <Link href="/admin/tenants" className="hover:text-indigo-400 transition-colors">Tenants</Link>
                    <span>/</span>
                    <span className="text-slate-300 font-medium">New Tenant</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 flex items-center gap-3">
                    <span className="bg-gradient-to-br from-indigo-500/20 to-purple-500/10 text-indigo-400 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl border border-indigo-500/20 shadow-lg">➕</span>
                    Create Tenant
                </h1>
                <p className="text-slate-400 text-sm mt-2 md:mt-3">สร้างพื้นที่ร้านค้าใหม่ (Tenant) สำหรับลูกค้า</p>
            </div>

            {msg && (
                <div className="px-4 py-3 mb-6 rounded-xl text-sm md:text-base bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
                    <span className="text-lg">⚠️</span> {msg.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 md:p-8 space-y-6 md:space-y-8 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">

                {/* Tenant Code */}
                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                        รหัสร้านค้า (Tenant Code) <span className="text-red-400">*</span>
                    </label>
                    <input
                        {...field('code')}
                        placeholder="e.g. store-001 หรือ mycafe"
                        required
                        pattern="[a-z0-9\-]+"
                    />
                    <p className="text-[0.7rem] md:text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                        <span className="text-indigo-400">ℹ️</span> ใช้ตัวอักษรพิมพ์เล็ก (a-z), ตัวเลข (0-9) หรือขีดกลาง (-) เท่านั้น ห้ามเว้นวรรค และห้ามซ้ำกับร้านอื่น
                    </p>
                </div>

                {/* Display Name */}
                <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                        ชื่อร้านค้า (Display Name) <span className="text-red-400">*</span>
                    </label>
                    <input
                        {...field('name')}
                        placeholder="ชื่อร้านที่จะแสดงผลให้ลูกค้าเห็น เช่น ร้านขายดีเด้อ สาขา 1"
                        required
                    />
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-white/5 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 justify-end">
                    <Link
                        href="/admin/tenants"
                        className="w-full sm:w-auto text-center bg-white/5 hover:bg-white/10 text-slate-300 text-sm md:text-base font-semibold px-6 py-3 md:py-2.5 rounded-xl transition-colors border border-transparent hover:border-white/10"
                    >
                        ยกเลิก
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 text-white text-sm md:text-base font-bold px-8 py-3 md:py-2.5 rounded-xl transition-all shadow-[0_4px_16px_rgba(99,102,241,0.3)] disabled:shadow-none"
                    >
                        {saving ? (
                            <>
                                <span className="animate-spin text-lg">⏳</span> กำลังสร้าง...
                            </>
                        ) : (
                            <>
                                <span>🚀</span> ยืนยันสร้างร้านค้า
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
