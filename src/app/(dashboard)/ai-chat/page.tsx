'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    model?: string
    tier?: string
    tokensUsed?: number
    timestamp: Date
}

interface BalanceInfo {
    usage: number
    limit: number | null
    remaining: number | null
    isFreeTier: boolean
    warning: string | null
}

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
    cheap: { bg: '#DCFCE7', text: '#166534', label: '⚡ Fast' },
    mid: { bg: '#DBEAFE', text: '#1E40AF', label: '🧠 Smart' },
    pro: { bg: '#F3E8FF', text: '#6B21A8', label: '🏆 Pro' },
}

export default function AiChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [balance, setBalance] = useState<BalanceInfo | null>(null)
    const [balanceLoading, setBalanceLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Fetch balance on mount
    useEffect(() => {
        fetchBalance()
    }, [])

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    async function fetchBalance() {
        setBalanceLoading(true)
        try {
            const res = await fetch('/api/ai/balance')
            const json = await res.json()
            if (json.success) setBalance(json.data)
        } catch (e) {
            console.error('Balance fetch error:', e)
        } finally {
            setBalanceLoading(false)
        }
    }

    async function handleSend() {
        const text = input.trim()
        if (!text || loading) return

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        }

        const newMessages = [...messages, userMsg]
        setMessages(newMessages)
        setInput('')
        setLoading(true)

        try {
            const apiMessages = newMessages.map(m => ({
                role: m.role,
                content: m.content,
            }))

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages }),
            })

            const json = await res.json()

            if (json.success) {
                const assistantMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: json.data.reply,
                    model: json.data.model,
                    tier: json.data.tier,
                    tokensUsed: json.data.tokensUsed,
                    timestamp: new Date(),
                }
                setMessages(prev => [...prev, assistantMsg])
            } else {
                const errorMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: `❌ ${json.error || 'เกิดข้อผิดพลาด'}`,
                    timestamp: new Date(),
                }
                setMessages(prev => [...prev, errorMsg])
            }
        } catch (e) {
            console.error('Chat error:', e)
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '❌ ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่',
                timestamp: new Date(),
            }
            setMessages(prev => [...prev, errorMsg])
        } finally {
            setLoading(false)
            inputRef.current?.focus()
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    function clearChat() {
        setMessages([])
        setInput('')
        inputRef.current?.focus()
    }

    function getModelShortName(model?: string): string {
        if (!model) return ''
        const parts = model.split('/')
        return parts[parts.length - 1] || model
    }

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">🤖 AI Assistant</h1>
                    <p className="page-subtitle">ผู้ช่วย AI สำหรับ KAIDEEDER — ถามได้ทุกเรื่องเกี่ยวกับร้าน</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Balance indicator */}
                    <div style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: balance?.warning ? '#FEF2F2' : '#F0FDF4',
                        color: balance?.warning ? '#DC2626' : '#16A34A',
                        border: `1px solid ${balance?.warning ? '#FECACA' : '#BBF7D0'}`,
                    }}>
                        {balanceLoading ? '⏳ ...' :
                            balance?.remaining != null
                                ? `💰 $${balance?.remaining?.toFixed(2)}`
                                : balance?.isFreeTier
                                    ? '🆓 Free Tier'
                                    : '💰 Active'}
                    </div>

                    <button
                        onClick={clearChat}
                        className="btn"
                        style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                    >
                        🗑️ ล้างแชท
                    </button>
                </div>
            </div>

            {/* Chat area */}
            <div className="card" style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
                minHeight: 'calc(100vh - 240px)',
                maxHeight: 'calc(100vh - 240px)',
            }}>
                {/* Messages */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                }}>
                    {messages.length === 0 && (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#9CA3AF',
                            gap: 12,
                            padding: '3rem 0',
                        }}>
                            <div style={{ fontSize: 48 }}>🤖</div>
                            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#6B7280' }}>
                                สวัสดี! ยินดีให้บริการ
                            </p>
                            <p style={{ fontSize: '0.85rem', textAlign: 'center', maxWidth: 400 }}>
                                ถามได้ทุกเรื่องเกี่ยวกับร้านใน KAIDEEDER — สต็อก, เมนู, ต้นทุน, วัตถุดิบ, สูตรอาหาร
                            </p>
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: 8,
                                justifyContent: 'center', marginTop: 8,
                            }}>
                                {[
                                    'สรุปยอดขายวันนี้',
                                    'วัตถุดิบไหนใกล้หมด?',
                                    'แนะนำเมนูอาหารเย็น',
                                    'วิเคราะห์ต้นทุนอาหาร',
                                ].map(q => (
                                    <button
                                        key={q}
                                        onClick={() => { setInput(q); inputRef.current?.focus() }}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: 20,
                                            border: '1px solid #E5E7EB',
                                            background: '#fff',
                                            color: '#6B7280',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = '#E8364E'
                                                ; (e.currentTarget as HTMLElement).style.color = '#E8364E'
                                        }}
                                        onMouseLeave={e => {
                                            (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'
                                                ; (e.currentTarget as HTMLElement).style.color = '#6B7280'
                                        }}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                gap: 4,
                            }}
                        >
                            {/* Bubble */}
                            <div style={{
                                maxWidth: '80%',
                                padding: '10px 16px',
                                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                background: msg.role === 'user'
                                    ? 'linear-gradient(135deg, #E8364E, #FF6B81)'
                                    : '#F3F4F6',
                                color: msg.role === 'user' ? '#fff' : '#1A1D26',
                                fontSize: '0.9rem',
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                boxShadow: msg.role === 'user'
                                    ? '0 2px 8px rgba(232,54,78,0.2)'
                                    : '0 1px 4px rgba(0,0,0,0.06)',
                            }}>
                                {msg.content}
                            </div>

                            {/* Meta info for assistant messages */}
                            {msg.role === 'assistant' && msg.tier && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingLeft: 4,
                                }}>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '2px 8px',
                                        borderRadius: 10,
                                        fontSize: '0.65rem',
                                        fontWeight: 600,
                                        background: TIER_COLORS[msg.tier]?.bg || '#F3F4F6',
                                        color: TIER_COLORS[msg.tier]?.text || '#6B7280',
                                    }}>
                                        {TIER_COLORS[msg.tier]?.label || msg.tier}
                                    </span>
                                    <span style={{
                                        fontSize: '0.65rem',
                                        color: '#9CA3AF',
                                    }}>
                                        {getModelShortName(msg.model)}
                                    </span>
                                    {msg.tokensUsed != null && msg.tokensUsed > 0 && (
                                        <span style={{
                                            fontSize: '0.65rem',
                                            color: '#D1D5DB',
                                        }}>
                                            • {msg.tokensUsed} tokens
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Loading indicator */}
                    {loading && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 4,
                        }}>
                            <div style={{
                                padding: '12px 20px',
                                borderRadius: '16px 16px 16px 4px',
                                background: '#F3F4F6',
                                fontSize: '0.9rem',
                                color: '#9CA3AF',
                            }}>
                                <span className="loading-dots">
                                    กำลังคิด
                                    <span style={{ animation: 'blink 1.4s infinite' }}>.</span>
                                    <span style={{ animation: 'blink 1.4s infinite 0.2s' }}>.</span>
                                    <span style={{ animation: 'blink 1.4s infinite 0.4s' }}>.</span>
                                </span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div style={{
                    borderTop: '1px solid #E5E7EB',
                    padding: '12px 16px',
                    background: '#FAFAFA',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-end',
                }}>
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="พิมพ์ข้อความ... (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
                        disabled={loading}
                        rows={1}
                        style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: '1.5px solid #E5E7EB',
                            fontSize: '0.9rem',
                            fontFamily: 'inherit',
                            resize: 'none',
                            outline: 'none',
                            maxHeight: 120,
                            minHeight: 42,
                            lineHeight: 1.5,
                            transition: 'border-color 0.15s ease',
                            background: '#fff',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#E8364E' }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
                        onInput={e => {
                            const el = e.currentTarget
                            el.style.height = 'auto'
                            el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 12,
                            border: 'none',
                            background: loading || !input.trim()
                                ? '#E5E7EB'
                                : 'linear-gradient(135deg, #E8364E, #FF6B81)',
                            color: loading || !input.trim() ? '#9CA3AF' : '#fff',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit',
                            transition: 'all 0.15s ease',
                            boxShadow: loading || !input.trim() ? 'none' : '0 2px 8px rgba(232,54,78,0.25)',
                            minWidth: 70,
                        }}
                    >
                        {loading ? '⏳' : '📤 ส่ง'}
                    </button>
                </div>
            </div>

            {/* Inline keyframe for loading dots */}
            <style>{`
                @keyframes blink {
                    0%, 20% { opacity: 0; }
                    50% { opacity: 1; }
                    100% { opacity: 0; }
                }
            `}</style>
        </div>
    )
}
