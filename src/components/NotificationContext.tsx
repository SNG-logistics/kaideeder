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
function playBellChime(audioCtx: AudioContext, vol = 1.0, message?: string) {
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
        audioCtx.resume().then(doPlay).catch(() => console.warn('[Notification] AudioContext resume failed'))
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
    const unlockAudio = useCallback(() => {
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
            }).catch((e) => {
                console.warn('[Notification] ⚠️ AudioContext resume failed:', e)
                // Still mark as unlocked — some browsers don't support resume() but audio works
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

    // Reset seen-IDs when role loads so existing notifications trigger sound
    // Without this: first fetch (no role) remembers IDs → role arrives → refetch
    // → same IDs → hasNewHigh=false → no sound!
    useEffect(() => {
        if (isCashierRole || isKitchenRole) {
            console.log('[Notification] Role ready:', user?.role, '— resetting seen IDs for fresh detection')
            prevHighIdsRef.current = new Set()
        }
    }, [isCashierRole, isKitchenRole, user?.role])

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
                    playBellChime(audioCtxRef.current, 1.0, msg)
                }
                // Repeat every 10 seconds until acknowledged
                alarmIntervalRef.current = setInterval(() => {
                    if (audioUnlocked && audioCtxRef.current) {
                        playBellChime(audioCtxRef.current, 0.7) // without speech on repeats
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

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications')
            if (!res.ok) return
            const data = await res.json()
            const notifs: NotificationInfo[] = data.data ?? []

            // Detect brand-new HIGH alerts (not seen in previous poll)
            const newHighNotifs = notifs.filter(
                n => n.priority === 'HIGH' && !prevHighIdsRef.current.has(n.id)
            )
            const hasNewHigh = newHighNotifs.length > 0;
            
            prevHighIdsRef.current = new Set(
                notifs.filter(n => n.priority === 'HIGH').map(n => n.id)
            )

            // Debug logging
            if (notifs.length > 0) {
                console.log(`[Notification] Poll: ${notifs.length} total, ${newHighNotifs.length} new HIGH | role=${user?.role} cashier=${isCashierRole} kitchen=${isKitchenRole} audioOK=${audioUnlocked} ctxOK=${!!audioCtxRef.current}`)
            }

            // Play immediately when a new order arrives (before interval kicks in)
            if (hasNewHigh && (isCashierRole || isKitchenRole) && audioUnlocked && audioCtxRef.current) {
                const latestHigh = newHighNotifs[0];
                // Kitchen/bar: only announce ORDER_NEW, not bill requests
                const shouldAnnounce = isCashierRole || latestHigh.type === 'ORDER_NEW';
                if (shouldAnnounce) {
                    const tbl = latestHigh.metadata?.table
                    const tablePart = tbl ? `โต๊ะ${tbl.name}` : ''
                    const zonePart = tbl?.zone ? ` โซน${tbl.zone}` : ''

                    let msg: string | undefined
                    if (latestHigh.type === 'ORDER_NEW') {
                        msg = tablePart
                            ? `${tablePart}${zonePart} สั่งอาหาร`
                            : 'มีออเดอร์ใหม่'
                    } else if (latestHigh.type === 'BILL_REQUEST' && isCashierRole) {
                        msg = tablePart
                            ? `${tablePart}${zonePart} เรียกเช็คบิล`
                            : 'ลูกค้าเรียกเช็คบิล'
                    }
                    playBellChime(audioCtxRef.current, 1.0, msg)
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
        } catch (e) {
            console.error('Failed to fetch notifications', e)
        }
    }, [updateAlarm, isCashierRole, isKitchenRole, audioUnlocked, user?.role])

    useEffect(() => {
        fetchNotifications()
        const iv = setInterval(fetchNotifications, 4000)
        return () => clearInterval(iv)
    }, [fetchNotifications])

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

            {/* Prompt user to tap once so browser unlocks audio */}
            {!audioUnlocked && notifications.some(n => n.priority === 'HIGH') && (
                <div
                    onClick={unlockAudio}
                    style={{
                        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 10000, background: '#1e293b', border: '1px solid rgba(245,158,11,0.5)',
                        borderRadius: 99, padding: '8px 20px', fontSize: '0.78rem',
                        color: '#f59e0b', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 7,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)', whiteSpace: 'nowrap',
                        animation: 'bellPromptBounce 0.9s ease-in-out infinite',
                    }}
                >
                    🔔 แตะที่นี่เพื่อเปิดเสียงแจ้งเตือน
                </div>
            )}
            <style>{`
                @keyframes bellPromptBounce {
                    0%,100% { transform: translateX(-50%) translateY(0); }
                    50%      { transform: translateX(-50%) translateY(-5px); }
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
