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
function playBellChime(audioCtx: AudioContext, vol = 0.65) {
    const t = audioCtx.currentTime
    // Two-tone chime: high ding + lower dong
    const tones: [number, number, number][] = [
        [1046, 0,    vol],       // C6 — first ding
        [880,  0.3,  vol * 0.8], // A5 — second ding
        [698,  0.65, vol * 0.6], // F5 — softer dong
    ]
    tones.forEach(([freq, delay, gain]) => {
        const osc = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        osc.connect(gainNode)
        gainNode.connect(audioCtx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gainNode.gain.setValueAtTime(0, t + delay)
        gainNode.gain.linearRampToValueAtTime(gain, t + delay + 0.015)
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + delay + 1.6)
        osc.start(t + delay)
        osc.stop(t + delay + 1.7)
    })
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<NotificationInfo[]>([])
    const [seenIds, setSeenIds] = useState<Set<string>>(new Set())

    const audioUnlocked = useRef(false)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const prevHighIdsRef = useRef<Set<string>>(new Set())

    // Unlock audio on first user interaction (browser policy)
    useEffect(() => {
        function unlock() {
            audioUnlocked.current = true
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
            }
        }
        document.addEventListener('click', unlock, { once: true })
        document.addEventListener('touchstart', unlock, { once: true })
        return () => {
            document.removeEventListener('click', unlock)
            document.removeEventListener('touchstart', unlock)
        }
    }, [])

    // Start/stop repeating alarm based on unacknowledged HIGH-priority count
    const updateAlarm = useCallback((notifs: NotificationInfo[], seen: Set<string>) => {
        const hasUnacked = notifs.some(n => n.priority === 'HIGH' && !seen.has(n.id))

        if (hasUnacked) {
            if (!alarmIntervalRef.current) {
                // Play first chime immediately
                if (audioUnlocked.current && audioCtxRef.current) {
                    playBellChime(audioCtxRef.current)
                }
                // Repeat every 5 seconds until acknowledged
                alarmIntervalRef.current = setInterval(() => {
                    if (audioUnlocked.current && audioCtxRef.current) {
                        playBellChime(audioCtxRef.current)
                    }
                }, 5000)
            }
        } else {
            // All HIGH alerts cleared — stop ringing
            if (alarmIntervalRef.current) {
                clearInterval(alarmIntervalRef.current)
                alarmIntervalRef.current = null
            }
        }
    }, [])

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
            const hasNewHigh = notifs.some(
                n => n.priority === 'HIGH' && !prevHighIdsRef.current.has(n.id)
            )
            prevHighIdsRef.current = new Set(
                notifs.filter(n => n.priority === 'HIGH').map(n => n.id)
            )

            // Play immediately when a new order arrives (before interval kicks in)
            if (hasNewHigh && audioUnlocked.current && audioCtxRef.current) {
                playBellChime(audioCtxRef.current)
            }

            setNotifications(notifs)
            setSeenIds(prev => {
                updateAlarm(notifs, prev)
                return prev
            })
        } catch (e) {
            console.error('Failed to fetch notifications', e)
        }
    }, [updateAlarm])

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
            {!audioUnlocked.current && notifications.some(n => n.priority === 'HIGH') && (
                <div
                    onClick={() => {
                        audioUnlocked.current = true
                        if (!audioCtxRef.current) {
                            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
                        }
                        fetchNotifications()
                    }}
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
