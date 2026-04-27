'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { NotificationInfo } from '@/app/api/notifications/route'

type NotificationContextType = {
    notifications: NotificationInfo[]
    unreadCount: number
    highPriorityCount: number
    normalPriorityCount: number
    markAsSeen: (id: string) => void
    removeNotification: (id: string) => void
    refresh: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

// ── Web Audio bell synthesizer ────────────────────────────────────────────
function playBellChime(audioCtx: AudioContext, vol = 1.0, message?: string, onFail?: () => void) {
    // Always resume — context may slip back to 'suspended' after tab inactivity
    const doPlay = () => {
        try {
            const t = audioCtx.currentTime
            // Two-tone chime: high ding + lower dong
            const tones: [number, number, number][] = [
                [1046, 0,    vol],       // C6 — first ding
                [880,  0.3,  vol * 0.8], // A5 — second ding
                [698,  0.65, vol * 0.6], // F5 — softer dong
                [1046, 1.0,  vol],       // Repeats for more urgency
                [880,  1.3,  vol * 0.8]
            ]
            tones.forEach(([freq, delay, gain]) => {
                const osc = audioCtx.createOscillator()
                const gainNode = audioCtx.createGain()
                osc.connect(gainNode)
                gainNode.connect(audioCtx.destination)
                osc.type = 'triangle'
                osc.frequency.value = freq
                gainNode.gain.setValueAtTime(0, t + delay)
                gainNode.gain.linearRampToValueAtTime(gain, t + delay + 0.02)
                gainNode.gain.exponentialRampToValueAtTime(0.01, t + delay + 1.2)
                osc.start(t + delay)
                osc.stop(t + delay + 1.3)
            })
            console.log('[Notification] 🔔 Bell chime played', message ?? '')
        } catch (e) {
            console.error('[Notification] Failed to play bell chime', e)
        }
    }

    // Resume if suspended, then play
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(doPlay).catch((e) => {
            console.warn('[Notification] AudioContext resume failed', e)
            if (onFail) onFail()
        })
    } else {
        doPlay()
    }

    // Text to Speech for clear announcement if a message is provided
    if (message && 'speechSynthesis' in window) {
        setTimeout(() => {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = 'th-TH';
            utterance.rate = 1.0;
            utterance.volume = 1.0;
            const voices = window.speechSynthesis.getVoices();
            const thaiVoice = voices.find(v => v.lang === 'th-TH' || v.lang === 'th');
            if (thaiVoice) utterance.voice = thaiVoice;
            window.speechSynthesis.speak(utterance);
            console.log('[Notification] 🗣️ Speech:', message)
        }, 1500);
    }
}

import { useCurrentUser } from '@/hooks/useCurrentUser'

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<NotificationInfo[]>([])
    const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
    const [audioUnlocked, setAudioUnlocked] = useState(false)
    const audioUnlockedRef = useRef(false)
    useEffect(() => { audioUnlockedRef.current = audioUnlocked }, [audioUnlocked])
    const user = useCurrentUser()

    const audioCtxRef = useRef<AudioContext | null>(null)
    const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const prevHighIdsRef = useRef<Set<string>>(new Set())

    // Create AudioContext eagerly — will be in 'suspended' until user gesture
    useEffect(() => {
        if (typeof window !== 'undefined' && !audioCtxRef.current) {
            try {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
            } catch { }
        }
    }, [])

    // Unlock audio on EVERY user interaction until confirmed unlocked
    const unlockAudio = useCallback((playTest = false) => {
        if (audioUnlocked) return
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
                console.log('[Notification] AudioContext created, state:', audioCtxRef.current.state)
            }
            // Must call resume() — AudioContext starts suspended on Chrome/Safari
            audioCtxRef.current.resume().then(() => {
                console.log('[Notification] ✅ Audio unlocked, state:', audioCtxRef.current?.state)
                setAudioUnlocked(true)
                // Play short test chime so staff know audio is working
                if (audioCtxRef.current) {
                    playBellChime(audioCtxRef.current, 0.5)
                }
            }).catch((e) => {
                console.warn('[Notification] ⚠️ AudioContext resume failed:', e)
                setAudioUnlocked(true)
            })
        } catch (e) {
            console.error('[Notification] ❌ AudioContext creation failed:', e)
        }
        // Warm up speech synthesis
        if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance('')
            u.volume = 0
            window.speechSynthesis.speak(u)
        }
    }, [audioUnlocked])

    useEffect(() => {
        document.addEventListener('click', unlockAudio)
        document.addEventListener('touchstart', unlockAudio)
        return () => {
            document.removeEventListener('click', unlockAudio)
            document.removeEventListener('touchstart', unlockAudio)
        }
    }, [unlockAudio])


    const isCashierRole = user?.role === 'cashier' || user?.role === 'owner' || user?.role === 'manager';
    const isKitchenRole = user?.role === 'kitchen' || user?.role === 'bar';

    // Reset seen-IDs when role loads OR when audio unlocks
    // This ensures any orders that arrived while audio was locked (or role was loading)
    // will be treated as "new" on the next poll, triggering the first chime + speech!
    useEffect(() => {
        if ((isCashierRole || isKitchenRole) && audioUnlocked) {
            console.log('[Notification] Role & Audio ready — resetting seen IDs for fresh detection')
            prevHighIdsRef.current = new Set()
        }
    }, [isCashierRole, isKitchenRole, user?.role, audioUnlocked])

    // Start/stop repeating alarm based on unacknowledged HIGH-priority count
    const updateAlarm = useCallback((notifs: NotificationInfo[], seen: Set<string>) => {
        const unackedHigh = notifs.filter(n => n.priority === 'HIGH' && !seen.has(n.id))
        const hasUnacked = unackedHigh.length > 0

        // Play alarms for cashier roles AND kitchen/bar (so kitchen hears new orders too)
        if (!isCashierRole && !isKitchenRole) {
            if (alarmIntervalRef.current) {
                clearInterval(alarmIntervalRef.current)
                alarmIntervalRef.current = null
            }
            return
        }

        if (hasUnacked) {
            if (!alarmIntervalRef.current) {
                const latestHigh = unackedHigh[0];
                // Kitchen/bar only hear ORDER_NEW (not bill requests)
                const isBillOnly = latestHigh.type === 'BILL_REQUEST';
                if (isKitchenRole && isBillOnly) return;

                const tbl = latestHigh.metadata?.table
                const tablePart = tbl ? `โต๊ะ${tbl.name}` : ''
                const zonePart = tbl?.zone ? ` โซน${tbl.zone}` : ''

                let msg: string | undefined
                if (latestHigh.type === 'ORDER_NEW') {
                    msg = tablePart ? `${tablePart}${zonePart} สั่งอาหาร` : 'มีออเดอร์ใหม่'
                } else if (latestHigh.type === 'BILL_REQUEST' && isCashierRole) {
                    msg = tablePart ? `${tablePart}${zonePart} เรียกเช็คบิล` : 'ลูกค้าเรียกเช็คบิล'
                }
                
                // Play first chime immediately
                if (audioUnlocked && audioCtxRef.current) {
                    playBellChime(audioCtxRef.current, 1.0, msg, () => setAudioUnlocked(false))
                }
                // Repeat every 10 seconds until acknowledged
                alarmIntervalRef.current = setInterval(() => {
                    // Use audioUnlockedRef to avoid stale closure (in case interval was created when it was false)
                    if (audioUnlockedRef.current && audioCtxRef.current) {
                        playBellChime(audioCtxRef.current, 0.7, undefined, () => setAudioUnlocked(false)) // without speech on repeats
                    }
                }, 10000)
            }
        } else {
            // All HIGH alerts cleared — stop ringing
            if (alarmIntervalRef.current) {
                clearInterval(alarmIntervalRef.current)
                alarmIntervalRef.current = null
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                }
            }
        }
    }, [isCashierRole, isKitchenRole, audioUnlocked])

    useEffect(() => {
        return () => {
            if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current)
        }
    }, [])

    // Core logic: process a batch of notifications, trigger sound if new HIGH
    const processNotifications = useCallback((notifs: NotificationInfo[]) => {
        // Detect brand-new HIGH alerts (not seen in previous poll)
        const newHighNotifs = notifs.filter(
            n => n.priority === 'HIGH' && !prevHighIdsRef.current.has(n.id)
        )
        const hasNewHigh = newHighNotifs.length > 0;

        prevHighIdsRef.current = new Set(
            notifs.filter(n => n.priority === 'HIGH').map(n => n.id)
        )

        // Debug logging
        if (notifs.length > 0 || hasNewHigh) {
            console.log(`[Notification] Push: ${notifs.length} total, ${newHighNotifs.length} new HIGH | role=${user?.role} cashier=${isCashierRole} kitchen=${isKitchenRole} audioOK=${audioUnlocked} ctxOK=${!!audioCtxRef.current}`)
        }

        // Play immediately when a new order arrives
        if (hasNewHigh && (isCashierRole || isKitchenRole) && audioUnlocked && audioCtxRef.current) {
            const latestHigh = newHighNotifs[0];
            const shouldAnnounce = isCashierRole || latestHigh.type === 'ORDER_NEW';
            if (shouldAnnounce) {
                const tbl = latestHigh.metadata?.table
                const tablePart = tbl ? `โต๊ะ${tbl.name}` : ''
                const zonePart = tbl?.zone ? ` โซน${tbl.zone}` : ''

                let msg: string | undefined
                if (latestHigh.type === 'ORDER_NEW') {
                    msg = tablePart ? `${tablePart}${zonePart} สั่งอาหาร` : 'มีออเดอร์ใหม่'
                } else if (latestHigh.type === 'BILL_REQUEST' && isCashierRole) {
                    msg = tablePart ? `${tablePart}${zonePart} เรียกเช็คบิล` : 'ลูกค้าเรียกเช็คบิล'
                }
                playBellChime(audioCtxRef.current, 1.0, msg, () => setAudioUnlocked(false))
            } else {
                console.log('[Notification] Skipped sound: shouldAnnounce=false for', latestHigh.type)
            }
        } else if (hasNewHigh) {
            console.log(`[Notification] ⚠️ New HIGH but no sound: cashier=${isCashierRole} kitchen=${isKitchenRole} audio=${audioUnlocked} ctx=${!!audioCtxRef.current}`)
        }

        setNotifications(notifs)
        setSeenIds(prev => {
            updateAlarm(notifs, prev)
            return prev
        })
    }, [updateAlarm, isCashierRole, isKitchenRole, audioUnlocked, user?.role])

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications')
            if (!res.ok) return
            const data = await res.json()
            processNotifications(data.data ?? [])
        } catch (e) {
            console.error('Failed to fetch notifications', e)
        }
    }, [processNotifications])

    // SSE real-time stream — orders detected within ~1.5s instead of 4s polling
    useEffect(() => {
        let es: EventSource | null = null
        let fallbackIv: ReturnType<typeof setInterval> | null = null
        let sseOk = false

        function connectSSE() {
            try {
                es = new EventSource('/api/notifications/stream')

                es.onopen = () => {
                    sseOk = true
                    console.log('[Notification] ✅ SSE connected — real-time mode')
                    // Cancel fallback polling if SSE is working
                    if (fallbackIv) { clearInterval(fallbackIv); fallbackIv = null }
                }

                es.onmessage = (ev) => {
                    try {
                        const payload = JSON.parse(ev.data)
                        if (payload.type === 'notifications') {
                            processNotifications(payload.data)
                        }
                    } catch { }
                }

                es.onerror = () => {
                    if (!sseOk) {
                        // SSE never connected — fall back to polling
                        console.warn('[Notification] SSE unavailable — falling back to polling')
                        es?.close()
                        es = null
                        if (!fallbackIv) {
                            fetchNotifications()
                            fallbackIv = setInterval(fetchNotifications, 3000)
                        }
                    }
                }
            } catch (e) {
                console.warn('[Notification] EventSource failed:', e)
                fetchNotifications()
                fallbackIv = setInterval(fetchNotifications, 3000)
            }
        }

        connectSSE()

        return () => {
            es?.close()
            if (fallbackIv) clearInterval(fallbackIv)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchNotifications, processNotifications])

    // Manual refresh still calls fetchNotifications directly

    const markAsSeen = useCallback((id: string) => {
        setSeenIds(prev => {
            const next = new Set([...prev, id])
            setNotifications(curr => {
                updateAlarm(curr, next)
                return curr
            })
            return next
        })
    }, [updateAlarm])

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => {
            const next = prev.filter(n => n.id !== id)
            setSeenIds(seen => {
                updateAlarm(next, seen)
                return seen
            })
            return next
        })
    }, [updateAlarm])

    const unreadNotifications = notifications.filter(n => !seenIds.has(n.id))
    const unreadCount = unreadNotifications.length
    const highPriorityCount = unreadNotifications.filter(n => n.priority === 'HIGH').length
    const normalPriorityCount = unreadNotifications.filter(n => n.priority === 'NORMAL').length

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            highPriorityCount,
            normalPriorityCount,
            markAsSeen,
            removeNotification,
            refresh: fetchNotifications
        }}>
            {children}

            {/* Always show unlock button until audio is confirmed unlocked */}
            {!audioUnlocked && (
                <div
                    onClick={unlockAudio}
                    style={{
                        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 10000,
                        background: 'linear-gradient(135deg, #b45309, #d97706)',
                        border: 'none',
                        borderRadius: 99, padding: '10px 22px', fontSize: '0.82rem',
                        color: '#fff', fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 4px 24px rgba(217,119,6,0.6)', whiteSpace: 'nowrap',
                        animation: 'bellPromptBounce 0.9s ease-in-out infinite',
                        userSelect: 'none',
                    }}
                >
                    🔔 แตะที่นี่เพื่อเปิดเสียงแจ้งเตือน
                </div>
            )}
            <style>{`
                @keyframes bellPromptBounce {
                    0%,100% { transform: translateX(-50%) translateY(0); }
                    50%      { transform: translateX(-50%) translateY(-6px); }
                }
            `}</style>
        </NotificationContext.Provider>
    )
}

export function useNotification() {
    const context = useContext(NotificationContext)
    if (!context) throw new Error('useNotification must be used within a NotificationProvider')
    return context
}
