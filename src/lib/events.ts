import { EventEmitter } from 'events'

// Declare global to preserve instance across HMR in dev
declare global {
    var _globalEventEmitter: EventEmitter | undefined
}

export const getEventEmitter = (): EventEmitter => {
    if (!globalThis._globalEventEmitter) {
        globalThis._globalEventEmitter = new EventEmitter()
        // Increase limit if many clients connect
        globalThis._globalEventEmitter.setMaxListeners(100)
    }
    return globalThis._globalEventEmitter
}
