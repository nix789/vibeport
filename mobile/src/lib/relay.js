/**
 * relay.js
 * WebSocket relay client for the mobile app.
 * Connects to wss://relay.nixdata.net:4444
 */

import Constants from 'expo-constants'

const RELAY_URL     = Constants.expoConfig?.extra?.relayUrl ?? 'wss://relay.nixdata.net:4444'
const RECONNECT_MS  = 3000

let ws         = null
let listeners  = {}   // type → [callback]
let reconnectT = null
let isConnected = false

export function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  ws = new WebSocket(RELAY_URL)

  ws.onopen = () => {
    isConnected = true
    clearTimeout(reconnectT)
    emit('__connected', true)
    console.log('[relay] connected')
  }

  ws.onmessage = (e) => {
    if (typeof e.data === 'string') {
      try {
        const msg = JSON.parse(e.data)
        emit(msg.type, msg)
      } catch {}
    } else {
      emit('__binary', e.data)
    }
  }

  ws.onclose = () => {
    isConnected = false
    emit('__connected', false)
    reconnectT = setTimeout(connect, RECONNECT_MS)
  }

  ws.onerror = () => ws.close()
}

export function send(obj) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj))
  }
}

export function subscribe(feedKey, fromSeq = 0) {
  send({ type: 'SUBSCRIBE', feedKey, fromSeq })
}

export function on(type, cb) {
  if (!listeners[type]) listeners[type] = []
  listeners[type].push(cb)
  return () => { listeners[type] = listeners[type].filter(x => x !== cb) }
}

export function getStatus() {
  return isConnected
}

function emit(type, data) {
  ;(listeners[type] ?? []).forEach(cb => cb(data))
}
