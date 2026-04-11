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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<NotificationInfo[]>([])
    const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
    
    const audioUnlocked = useRef(false)

    useEffect(() => {
        function unlock() { audioUnlocked.current = true }
        document.addEventListener('click', unlock, { once: true })
        document.addEventListener('touchstart', unlock, { once: true })
        return () => { document.removeEventListener('click', unlock); document.removeEventListener('touchstart', unlock) }
    }, [])

    const playSound = useCallback(() => {
        if (!audioUnlocked.current) return
        try { new Audio('/notification.mp3').play() } catch {}
    }, [])

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications')
            if (!res.ok) return
            const data = await res.json()
            const notifs: NotificationInfo[] = data.data ?? []
            
            // Check for new high/normal priority to play sound
            const hasNewAlerts = notifs.some(n => !seenIds.has(n.id) && (n.priority === 'HIGH' || n.priority === 'NORMAL'))
            if (hasNewAlerts) {
                playSound()
            }
            
            setNotifications(notifs)
        } catch (e) {
            console.error('Failed to fetch notifications', e)
        }
    }, [seenIds, playSound])

    useEffect(() => {
        fetchNotifications()
        const iv = setInterval(fetchNotifications, 4000)
        return () => clearInterval(iv)
    }, [fetchNotifications])

    const markAsSeen = useCallback((id: string) => {
        setSeenIds(prev => new Set([...prev, id]))
    }, [])

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
    }, [])

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
            
            {/* Global Sound Hint */}
            {!audioUnlocked.current && notifications.length > 0 && (
                <div
                    onClick={() => { audioUnlocked.current = true; fetchNotifications(); }}
                    style={{
                        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 10000, background: '#1e293b', border: '1px solid rgba(245,158,11,0.4)',
                        borderRadius: 99, padding: '6px 16px', fontSize: '0.75rem',
                        color: '#f59e0b', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
                    }}
                >
                    🔔 แตะที่นี่เพื่อเปิดเสียงแจ้งเตือน
                </div>
            )}
        </NotificationContext.Provider>
    )
}

export function useNotification() {
    const context = useContext(NotificationContext)
    if (!context) throw new Error('useNotification must be used within a NotificationProvider')
    return context
}
