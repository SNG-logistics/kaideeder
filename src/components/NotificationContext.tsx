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
    // Audio unlock state — exposed so TopBar/Sidebar can show status button
    audioUnlocked: boolean
    unlockAudio: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

// ── Web Audio URGENT buzzer for new ORDER (distinct from BILL_REQUEST bell) ─
function playUrgentBuzzer(audioCtx: AudioContext, vol = 1.0, message?: string, onFail?: () => void) {
    const doPlay = () => {
        try {
            const t = audioCtx.currentTime
            // 3-pulse urgent beep: square wave, aggressive, clearly different from bell
            const pulses: [number, number, number][] = [
                [880,  0.0,  vol],       // first beep
                [880,  0.28, vol],       // second beep
                [1046, 0.56, vol * 1.2], // third higher beep (urgency)
            ]
            pulses.forEach(([freq, delay, gain]) => {
                const osc = audioCtx.createOscillator()
                const gainNode = audioCtx.createGain()
                osc.connect(gainNode)
                gainNode.connect(audioCtx.destination)
                osc.type = 'square'    // square wave = harsh/urgent vs triangle = soft bell
                osc.frequency.value = freq
                gainNode.gain.setValueAtTime(0, t + delay)
                gainNode.gain.linearRampToValueAtTime(gain * 0.4, t + delay + 0.01)
                gainNode.gain.setValueAtTime(gain * 0.4, t + delay + 0.18)
                gainNode.gain.linearRampToValueAtTime(0, t + delay + 0.24)
                osc.start(t + delay)
                osc.stop(t + delay + 0.28)
            })
            console.log('[Notification] 📢 Urgent buzzer played', message ?? '')
        } catch (e) {
            console.error('[Notification] Failed to play urgent buzzer', e)
        }
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(doPlay).catch((e) => {
            console.warn('[Notification] AudioContext resume failed', e)
            if (onFail) onFail()
        })
    } else {
        doPlay()
    }

    // Speech announcement for new orders
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
        }, 900);
    }
}


// ── Web Audio gentle bell for BILL_REQUEST ──────────────────────────────────
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
    const [uiDismissed, setUiDismissed] = useState(false)
    const [audioUnlocked, setAudioUnlocked] = useState(false)
    const audioUnlockedRef = useRef(false)
    useEffect(() => { audioUnlockedRef.current = audioUnlocked }, [audioUnlocked])
    const user = useCurrentUser()

    const audioCtxRef = useRef<AudioContext | null>(null)
    const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const prevHighIdsRef = useRef<Set<string>>(new Set())
    // Stable refs for role — avoids recreating processNotifications on every role change
    const isCashierRoleRef = useRef(false)
    const isKitchenRoleRef = useRef(false)

    // On mount: if localStorage says unlocked, try to actually resume AudioContext immediately
    // (Browser resets AudioContext state on every page load regardless of localStorage)
    useEffect(() => {
        if (typeof window === 'undefined') return
        const wasUnlocked = localStorage.getItem('audioUnlockedUI') === 'true'
        if (wasUnlocked) {
            setUiDismissed(true)
            // Try to auto-resume — will succeed if user has previously interacted
            // (modern browsers allow resume if the tab was previously interactive)
            if (!audioCtxRef.current) {
                try { audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)() } catch { }
            }
            audioCtxRef.current?.resume()
                .then(() => {
                    if (audioCtxRef.current?.state === 'running') {
                        setAudioUnlocked(true)
                        console.log('[Notification] ✅ Auto-resumed AudioContext from localStorage hint')
                    }
                })
                .catch(() => {
                    // Browser blocked auto-resume — need user gesture, show banner again
                    setUiDismissed(false)
                    console.log('[Notification] ⚠️ Auto-resume blocked — showing banner again')
                })
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Unlock audio on EVERY user interaction until confirmed unlocked
    const unlockAudio = useCallback((e?: Event | boolean) => {
        const fromBanner = typeof e === 'boolean' ? e : false;

        if (audioCtxRef.current?.state === 'running') {
            setAudioUnlocked(true)
            if (!uiDismissed) {
                setUiDismissed(true)
                localStorage.setItem('audioUnlockedUI', 'true')
            }
            return
        }
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
                console.log('[Notification] AudioContext created, state:', audioCtxRef.current.state)
            }
            
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume().then(() => {
                    console.log('[Notification] ✅ Audio unlocked, state:', audioCtxRef.current?.state)
                    setAudioUnlocked(true)
                    
                    // Play short test chime ONLY if the UI banner was not dismissed yet
                    // This ensures the bell only rings on the very first permission grant in the session
                    if (!uiDismissed && audioCtxRef.current) {
                        playBellChime(audioCtxRef.current, 0.5)
                    }

                    setUiDismissed(true)
                    localStorage.setItem('audioUnlockedUI', 'true')
                }).catch((e) => {
                    console.warn('[Notification] ⚠️ AudioContext resume failed:', e)
                })
            } else {
                setAudioUnlocked(true)
                if (!uiDismissed) {
                    setUiDismissed(true)
                    localStorage.setItem('audioUnlockedUI', 'true')
                }
            }
        } catch (e) {
            console.error('[Notification] ❌ AudioContext creation failed:', e)
        }
        // Warm up speech synthesis
        if ('speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance('')
            u.volume = 0
            window.speechSynthesis.speak(u)
        }
    }, [uiDismissed])

    useEffect(() => {
        document.addEventListener('click', unlockAudio)
        document.addEventListener('touchstart', unlockAudio)
        return () => {
            document.removeEventListener('click', unlockAudio)
            document.removeEventListener('touchstart', unlockAudio)
        }
    }, [unlockAudio])


    const isCashierRole = ['cashier', 'owner', 'manager'].includes(user?.role?.toLowerCase() ?? '')
    const isKitchenRole = ['kitchen', 'bar'].includes(user?.role?.toLowerCase() ?? '')
    // Keep refs in sync so callbacks can read current values without being recreated
    isCashierRoleRef.current = isCashierRole
    isKitchenRoleRef.current = isKitchenRole

    // Reset seen-IDs when role loads OR when audio unlocks
    // This ensures any orders that arrived while audio was locked (or role was loading)
    // will be treated as "new" on the next poll, triggering the first chime + speech!
    useEffect(() => {
        if ((isCashierRole || isKitchenRole) && audioUnlocked) {
            console.log('[Notification] Role & Audio ready — resetting seen IDs for fresh detection')
            prevHighIdsRef.current = new Set()
        }
    }, [isCashierRole, isKitchenRole, user?.role, audioUnlocked])

    // Start/stop repeating alarm based on unacknowledged ORDER_NEW / BILL_REQUEST only
    const updateAlarm = useCallback((notifs: NotificationInfo[], seen: Set<string>) => {
        // Only alarm for ORDER_NEW and BILL_REQUEST — not DELIVERY or others
        const alarmTypes = ['ORDER_NEW', 'BILL_REQUEST'] as const
        const unackedHigh = notifs.filter(n => n.priority === 'HIGH' && alarmTypes.includes(n.type as any) && !seen.has(n.id))
        const hasUnacked = unackedHigh.length > 0

        // Use refs so this callback doesn't need to be recreated on role change
        const cashier = isCashierRoleRef.current
        const kitchen = isKitchenRoleRef.current

        if (!cashier && !kitchen) {
            if (alarmIntervalRef.current) {
                clearInterval(alarmIntervalRef.current)
                alarmIntervalRef.current = null
            }
            return
        }

        if (hasUnacked) {
            if (!alarmIntervalRef.current) {
                const latestHigh = unackedHigh[0];
                const isBillOnly = latestHigh.type === 'BILL_REQUEST';
                if (kitchen && isBillOnly) return;

                const tbl = latestHigh.metadata?.table
                const tablePart = tbl ? `โต๊ะ${tbl.name}` : ''
                const zonePart = tbl?.zone ? ` โซน${tbl.zone}` : ''

                let msg: string | undefined
                if (latestHigh.type === 'ORDER_NEW') {
                    msg = tablePart ? `${tablePart}${zonePart} สั่งอาหาร` : 'มีออเดอร์ใหม่'
                } else if (latestHigh.type === 'BILL_REQUEST' && cashier) {
                    msg = tablePart ? `${tablePart}${zonePart} เรียกเช็คบิล` : 'ลูกค้าเรียกเช็คบิล'
                }

                if (audioUnlockedRef.current && audioCtxRef.current) {
                    if (latestHigh.type === 'ORDER_NEW') {
                        playUrgentBuzzer(audioCtxRef.current, 1.0, msg, () => setAudioUnlocked(false))
                    } else {
                        playBellChime(audioCtxRef.current, 1.0, msg, () => setAudioUnlocked(false))
                    }
                }
                alarmIntervalRef.current = setInterval(() => {
                    if (audioUnlockedRef.current && audioCtxRef.current) {
                        if (latestHigh.type === 'ORDER_NEW') {
                            playUrgentBuzzer(audioCtxRef.current, 0.7, undefined, () => setAudioUnlocked(false))
                        } else {
                            playBellChime(audioCtxRef.current, 0.7, undefined, () => setAudioUnlocked(false))
                        }
                    }
                }, 8000)
            }
        } else {
            if (alarmIntervalRef.current) {
                clearInterval(alarmIntervalRef.current)
                alarmIntervalRef.current = null
                if ('speechSynthesis' in window) window.speechSynthesis.cancel()
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])  // ← stable: reads live values via refs only

    useEffect(() => {
        return () => {
            if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current)
        }
    }, [])

    // Core logic: process a batch of notifications, trigger sound only for ORDER_NEW / BILL_REQUEST
    // useCallback with [] deps — reads live values via refs to stay stable and not force SSE reconnect
    const processNotifications = useCallback((notifs: NotificationInfo[]) => {
        const soundTypes = ['ORDER_NEW', 'BILL_REQUEST'] as const
        const newHighNotifs = notifs.filter(
            n => n.priority === 'HIGH' && soundTypes.includes(n.type as any) && !prevHighIdsRef.current.has(n.id)
        )
        const hasNewHigh = newHighNotifs.length > 0

        prevHighIdsRef.current = new Set(
            notifs.filter(n => n.priority === 'HIGH').map(n => n.id)
        )

        // Debug logging
        console.log(`[Notification] Push: ${notifs.length} total, ${newHighNotifs.length} new HIGH | cashier=${isCashierRoleRef.current} kitchen=${isKitchenRoleRef.current} audioOK=${audioUnlockedRef.current} ctx=${!!audioCtxRef.current}`)

        // Play immediately when a new order arrives (reads from refs — always current)
        if (hasNewHigh && (isCashierRoleRef.current || isKitchenRoleRef.current) && audioUnlockedRef.current && audioCtxRef.current) {
            const latestHigh = newHighNotifs[0]
            const tbl = latestHigh.metadata?.table
            const tablePart = tbl ? `โต๊ะ${tbl.name}` : ''
            const zonePart = tbl?.zone ? ` โซน${tbl.zone}` : ''

            if (latestHigh.type === 'ORDER_NEW') {
                const msg = tablePart ? `${tablePart}${zonePart} สั่งอาหาร` : 'มีออเดอร์ใหม่'
                playUrgentBuzzer(audioCtxRef.current, 1.0, msg, () => setAudioUnlocked(false))
            } else if (latestHigh.type === 'BILL_REQUEST' && isCashierRoleRef.current) {
                const msg = tablePart ? `${tablePart}${zonePart} เรียกเช็คบิล` : 'ลูกค้าเรียกเช็คบิล'
                playBellChime(audioCtxRef.current, 1.0, msg, () => setAudioUnlocked(false))
            }
        } else if (hasNewHigh) {
            console.log(`[Notification] ⚠️ New HIGH but no sound: cashier=${isCashierRoleRef.current} kitchen=${isKitchenRoleRef.current} audio=${audioUnlockedRef.current} ctx=${!!audioCtxRef.current}`)
        }

        setNotifications(notifs)
        setSeenIds(prev => {
            updateAlarm(notifs, prev)
            return prev
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateAlarm])  // ← only updateAlarm dep; everything else via refs

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

    // Stable refs so SSE closure (which runs once) always calls the latest fn version
    const processNotificationsRef = useRef(processNotifications)
    const fetchNotificationsRef = useRef(fetchNotifications)
    useEffect(() => { processNotificationsRef.current = processNotifications }, [processNotifications])
    useEffect(() => { fetchNotificationsRef.current = fetchNotifications }, [fetchNotifications])

    // SSE real-time stream — runs once, uses refs for live state access
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
                    if (fallbackIv) { clearInterval(fallbackIv); fallbackIv = null }
                }

                es.onmessage = (ev) => {
                    try {
                        const payload = JSON.parse(ev.data)
                        if (payload.type === 'notifications') {
                            processNotificationsRef.current(payload.data)
                        }
                    } catch { }
                }

                es.onerror = () => {
                    if (!sseOk) {
                        console.warn('[Notification] SSE unavailable — falling back to polling')
                        es?.close(); es = null
                        if (!fallbackIv) {
                            fetchNotificationsRef.current()
                            fallbackIv = setInterval(() => fetchNotificationsRef.current(), 3000)
                        }
                    }
                }
            } catch (e) {
                console.warn('[Notification] EventSource failed:', e)
                fetchNotificationsRef.current()
                fallbackIv = setInterval(() => fetchNotificationsRef.current(), 3000)
            }
        }

        connectSSE()

        return () => {
            es?.close()
            if (fallbackIv) clearInterval(fallbackIv)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])  // ← runs ONCE only

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
            refresh: fetchNotifications,
            audioUnlocked,
            unlockAudio: () => unlockAudio(true),
        }}>
            {children}

            {/* Show banner whenever AudioContext is not running — browser resets state on every reload */}
            {!audioUnlocked && (
                <div
                    onClick={() => unlockAudio(true)}
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
