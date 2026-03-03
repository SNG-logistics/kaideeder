'use client'
import { useState, useEffect } from 'react'

export interface CurrentUser {
    userId: string
    username: string
    role: string
    name: string
}

let cachedUser: CurrentUser | null = null

export function useCurrentUser(): CurrentUser | null {
    const [user, setUser] = useState<CurrentUser | null>(cachedUser)

    useEffect(() => {
        if (cachedUser) { setUser(cachedUser); return }
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(j => {
                if (j.success) {
                    cachedUser = j.data
                    setUser(j.data)
                }
            })
            .catch(() => { })
    }, [])

    return user
}
