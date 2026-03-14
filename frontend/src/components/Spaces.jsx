/**
 * Spaces.jsx
 * Live audio rooms — like X Spaces / Clubhouse.
 * WebRTC audio routed peer-to-peer; relay handles signaling only.
 *
 * Roles:
 *   Host   — creates space, streams mic audio to all listeners
 *   Listener — joins space, receives audio from host
 */

import { useState, useEffect, useRef } from 'react'
import { NODE_URL } from '../api'

const RELAY_URL = 'wss://relay.nixdata.net:4444'

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export function Spaces() {
  const [spaces, setSpaces]       = useState([])
  const [activeSpace, setActive]  = useState(null)  // { id, role, title }
  const [ws, setWS]               = useState(null)
  const [myKey, setMyKey]         = useState(null)
  const [title, setTitle]         = useState('')
  const [speaking, setSpeaking]   = useState(false)
  const [listeners, setListeners] = useState([])
  const [status, setStatus]       = useState('')

  const peerConns   = useRef({})   // peerKey → RTCPeerConnection
  const localStream = useRef(null)
  const audioEls    = useRef({})

  // Get local identity
  useEffect(() => {
    fetch(`${NODE_URL}/api/identity`)
      .then(r => r.json())
      .then(d => setMyKey(d.coreKey))
      .catch(() => {})
  }, [])

  // Connect to relay
  useEffect(() => {
    let socket
    const connect = () => {
      try {
        socket = new WebSocket(RELAY_URL)
        socket.onopen = () => {
          socket.send(JSON.stringify({ type: 'SPACES_LIST' }))
          socket.send(JSON.stringify({ type: 'SUBSCRIBE', feedKey: 'spaces' }))
          setWS(socket)
        }
        socket.onmessage = (e) => handleRelayMessage(JSON.parse(e.data), socket)
        socket.onclose   = () => { setWS(null); setTimeout(connect, 3000) }
        socket.onerror   = () => {}
      } catch {}
    }
    connect()
    return () => socket?.close()
  }, [])   // eslint-disable-line

  const handleRelayMessage = (msg, socket) => {
    switch (msg.type) {
      case 'SPACES_LIST':
        setSpaces(msg.spaces ?? [])
        break

      case 'SPACE_PEER_JOINED':
        // We are host — a new listener joined, create offer for them
        setListeners(l => [...l, msg.peerKey])
        hostSendOffer(msg.peerKey, msg.id, socket)
        break

      case 'SPACE_PEER_LEFT':
        setListeners(l => l.filter(k => k !== msg.peerKey))
        peerConns.current[msg.peerKey]?.close()
        delete peerConns.current[msg.peerKey]
        break

      case 'SPACE_OFFER':
        // We are listener — host sent us an offer
        listenerHandleOffer(msg.sdp, msg.from, msg.id, socket)
        break

      case 'SPACE_ANSWER':
        // We are host — listener answered
        peerConns.current[msg.from]?.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
        break

      case 'SPACE_ICE':
        peerConns.current[msg.from]?.addIceCandidate(msg.candidate).catch(() => {})
        break

      case 'SPACE_ENDED':
        setStatus('Space ended by host.')
        leaveCleanup()
        break
    }
  }

  // ── Host: create offer for a new listener ────────────────────────────────────
  const hostSendOffer = async (peerKey, spaceId, socket) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peerConns.current[peerKey] = pc

    // Add our mic track
    if (localStream.current) {
      localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current))
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.send(JSON.stringify({ type: 'SPACE_ICE', id: spaceId, to: peerKey, candidate: e.candidate }))
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socket.send(JSON.stringify({ type: 'SPACE_OFFER', id: spaceId, to: peerKey, sdp: offer.sdp }))
  }

  // ── Listener: handle incoming offer ─────────────────────────────────────────
  const listenerHandleOffer = async (sdp, hostKey, spaceId, socket) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peerConns.current[hostKey] = pc

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.send(JSON.stringify({ type: 'SPACE_ICE', id: spaceId, from: myKey, candidate: e.candidate }))
      }
    }

    pc.ontrack = (e) => {
      let el = audioEls.current[hostKey]
      if (!el) {
        el = document.createElement('audio')
        el.autoplay = true
        document.body.appendChild(el)
        audioEls.current[hostKey] = el
      }
      el.srcObject = e.streams[0]
    }

    await pc.setRemoteDescription({ type: 'offer', sdp })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    socket.send(JSON.stringify({ type: 'SPACE_ANSWER', id: spaceId, from: myKey, sdp: answer.sdp }))
  }

  // ── Create a space ───────────────────────────────────────────────────────────
  const createSpace = async () => {
    if (!myKey || !ws) return
    setStatus('Getting mic...')
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch {
      setStatus('Mic access denied.')
      return
    }
    ws.send(JSON.stringify({ type: 'SPACE_CREATE', hostKey: myKey, title: title || 'Vibeport Space' }))
    setActive({ id: myKey, role: 'host', title: title || 'Vibeport Space' })
    setSpeaking(true)
    setStatus('Space is live.')
  }

  // ── Join a space ─────────────────────────────────────────────────────────────
  const joinSpace = (space) => {
    if (!myKey || !ws) return
    ws.send(JSON.stringify({ type: 'SPACE_JOIN', id: space.id, peerKey: myKey }))
    setActive({ id: space.id, role: 'listener', title: space.title })
    setStatus('Joined — waiting for host audio...')
  }

  // ── Leave / end ──────────────────────────────────────────────────────────────
  const leaveSpace = () => {
    if (!activeSpace || !ws) return
    if (activeSpace.role === 'host') {
      ws.send(JSON.stringify({ type: 'SPACE_END', id: activeSpace.id }))
    } else {
      ws.send(JSON.stringify({ type: 'SPACE_LEAVE', id: activeSpace.id, peerKey: myKey }))
    }
    leaveCleanup()
  }

  const leaveCleanup = () => {
    localStream.current?.getTracks().forEach(t => t.stop())
    localStream.current = null
    for (const pc of Object.values(peerConns.current)) pc.close()
    peerConns.current = {}
    for (const el of Object.values(audioEls.current)) el.remove()
    audioEls.current = {}
    setActive(null)
    setSpeaking(false)
    setListeners([])
    setStatus('')
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (activeSpace) {
    return (
      <section className="spaces">
        <h2>
          {activeSpace.role === 'host' ? '🎙 Hosting' : '👂 Listening'}: {activeSpace.title}
        </h2>

        {activeSpace.role === 'host' && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: speaking ? 'var(--accent)' : 'var(--surface)',
              color: speaking ? '#000' : 'var(--muted)',
              padding: '0.4rem 0.8rem',
              border: '1px solid var(--accent)',
              fontSize: '0.8rem',
            }}>
              <span style={{ fontSize: '1rem' }}>🎙</span>
              {speaking ? 'Live — you are broadcasting' : 'Mic off'}
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
              {listeners.length} listener{listeners.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {activeSpace.role === 'listener' && (
          <p style={{ color: 'var(--accent2)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            🔊 Audio playing through your speakers
          </p>
        )}

        {status && <p className="status">{status}</p>}

        <button
          onClick={leaveSpace}
          className="btn-primary"
          style={{ background: '#c00', marginTop: '0.5rem' }}
        >
          {activeSpace.role === 'host' ? 'End Space' : 'Leave Space'}
        </button>
      </section>
    )
  }

  return (
    <section className="spaces">
      <h2>Spaces</h2>
      <p className="hint">Live audio rooms. No recording. No replay. Ephemeral by design.</p>

      {/* Create */}
      <div style={{
        border: '1px solid var(--accent)', padding: '1rem',
        marginBottom: '1.5rem', background: 'var(--surface)',
      }}>
        <p style={{ color: 'var(--accent)', fontSize: '0.8rem', marginBottom: '0.6rem',
                    textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Start a Space
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Space title..."
            maxLength={80}
            style={{ flex: 1 }}
          />
          <button
            className="btn-primary"
            onClick={createSpace}
            disabled={!ws}
            style={{ whiteSpace: 'nowrap' }}
          >
            🎙 Go Live
          </button>
        </div>
        {status && <p className="status">{status}</p>}
      </div>

      {/* Live spaces list */}
      <h3>Live Now</h3>
      {spaces.length === 0 ? (
        <p className="empty">No spaces live right now. Start one!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {spaces.map(s => (
            <div key={s.id} style={{
              border: '1px solid var(--border)', padding: '0.8rem',
              background: 'var(--surface)', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--accent)',
                    boxShadow: '0 0 6px var(--accent)',
                    animation: 'pulse-dot 2s ease infinite',
                    display: 'inline-block',
                  }} />
                  <span style={{ color: 'var(--text)', fontWeight: 'bold' }}>{s.title}</span>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                  {s.listeners} listening · {s.hostKey?.slice(0, 20)}…
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={() => joinSpace(s)}
                disabled={s.hostKey === myKey}
                style={{ fontSize: '0.8rem' }}
              >
                Join
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
