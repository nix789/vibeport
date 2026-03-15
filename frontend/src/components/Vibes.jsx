/**
 * Vibes.jsx
 * Live audio rooms — up to 10 speakers + 1 co-host.
 * WebRTC audio mesh; relay handles signaling only.
 *
 * Roles:
 *   Host    — creates vibe, has mic, controls who speaks
 *   Co-Host — promoted by host, can approve speakers, has mic
 *   Speaker — approved to speak (up to 9 additional, 10 total on stage)
 *   Listener — passive audience, can raise hand to speak
 */

import { useState, useEffect, useRef } from 'react'
import { NODE_URL } from '../api'

const RELAY_URL  = 'wss://relay.nixdata.net'
const MAX_STAGE  = 10

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export function Vibes() {
  const [vibes,    setVibes]    = useState([])
  const [active,   setActive]   = useState(null)   // { id, title, hostKey }
  const [ws,       setWS]       = useState(null)
  const [myKey,    setMyKey]    = useState(null)
  const [title,    setTitle]    = useState('')
  const [status,   setStatus]   = useState('')
  const [role,     setRole]     = useState('none')  // none|host|cohost|speaker|listener
  const [stage,    setStage]    = useState([])      // peerKeys currently on stage
  const [audience, setAudience] = useState([])      // listener count (keys)
  const [pending,  setPending]  = useState([])      // hand-raise requests
  const [raised,   setRaised]   = useState(false)   // did I raise my hand?

  // Refs for use inside async WebRTC callbacks
  const peerConns   = useRef({})   // peerKey → RTCPeerConnection
  const localStream = useRef(null)
  const audioEls    = useRef({})
  const wsRef       = useRef(null)
  const myKeyRef    = useRef(null)
  const activeRef   = useRef(null)
  const roleRef     = useRef('none')
  const stageRef    = useRef([])
  const audRef      = useRef([])

  // Keep refs in sync with state
  useEffect(() => { myKeyRef.current  = myKey  }, [myKey])
  useEffect(() => { activeRef.current = active  }, [active])
  useEffect(() => { roleRef.current   = role    }, [role])
  useEffect(() => { stageRef.current  = stage   }, [stage])
  useEffect(() => { audRef.current    = audience }, [audience])

  // ── Identity ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${NODE_URL}/api/identity`)
      .then(r => r.json())
      .then(d => setMyKey(d.coreKey))
      .catch(() => {})
  }, [])

  // ── Relay WebSocket ───────────────────────────────────────────────────────
  useEffect(() => {
    let socket
    const connect = () => {
      try {
        socket = new WebSocket(RELAY_URL)
        socket.onopen = () => {
          socket.send(JSON.stringify({ type: 'SPACES_LIST' }))
          socket.send(JSON.stringify({ type: 'SUBSCRIBE', feedKey: 'spaces' }))
          setWS(socket)
          wsRef.current = socket
        }
        socket.onmessage = e => handleMsg(JSON.parse(e.data))
        socket.onclose   = () => {
          setWS(null); wsRef.current = null
          setTimeout(connect, 3000)
        }
        socket.onerror = () => {}
      } catch {}
    }
    connect()
    return () => socket?.close()
  }, []) // eslint-disable-line

  const sendWS = obj => {
    const s = wsRef.current
    if (s?.readyState === WebSocket.OPEN) s.send(JSON.stringify(obj))
  }

  // ── WebRTC helpers ────────────────────────────────────────────────────────

  /** Create a PeerConnection, wire ICE + incoming audio. */
  const makePeer = (peerKey, spaceId) => {
    // Close existing if any
    peerConns.current[peerKey]?.close()

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peerConns.current[peerKey] = pc

    pc.onicecandidate = e => {
      if (e.candidate) {
        sendWS({
          type: 'SPACE_ICE', id: spaceId,
          to: peerKey, from: myKeyRef.current,
          candidate: e.candidate,
        })
      }
    }

    pc.ontrack = e => {
      let el = audioEls.current[peerKey]
      if (!el) {
        el = document.createElement('audio')
        el.autoplay = true
        document.body.appendChild(el)
        audioEls.current[peerKey] = el
      }
      el.srcObject = e.streams[0]
    }

    return pc
  }

  /**
   * Send an offer to peerKey.
   * If we have a mic stream, it's added so they receive our audio.
   */
  const sendOffer = async (peerKey, spaceId) => {
    const pc = makePeer(peerKey, spaceId)
    if (localStream.current) {
      localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current))
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    sendWS({
      type: 'SPACE_OFFER', id: spaceId,
      to: peerKey, from: myKeyRef.current,
      sdp: offer.sdp,
    })
  }

  const closePeer = peerKey => {
    peerConns.current[peerKey]?.close()
    delete peerConns.current[peerKey]
    const el = audioEls.current[peerKey]
    if (el) { el.remove(); delete audioEls.current[peerKey] }
  }

  const isOnStage = () => {
    const r = roleRef.current
    return r === 'host' || r === 'cohost' || r === 'speaker'
  }

  // ── Message handler ───────────────────────────────────────────────────────
  const handleMsg = async msg => {
    const act  = activeRef.current
    const myK  = myKeyRef.current

    switch (msg.type) {

      case 'SPACES_LIST':
        setVibes(msg.spaces ?? [])
        break

      case 'SPACE_JOINED':
        // Relay confirms we joined; gives us current stage list
        setStage(msg.stage ?? [])
        stageRef.current = msg.stage ?? []
        break

      case 'SPACE_PEER_JOINED':
        // New listener arrived — ALL stage members send them an offer
        setAudience(a => [...a, msg.peerKey])
        if (isOnStage()) await sendOffer(msg.peerKey, msg.id)
        break

      case 'SPACE_PEER_LEFT':
        setAudience(a => a.filter(k => k !== msg.peerKey))
        closePeer(msg.peerKey)
        break

      case 'SPACE_SPEAKER_JOINED': {
        // A listener was promoted to stage
        const newKey = msg.peerKey
        setStage(s => s.includes(newKey) ? s : [...s, newKey])
        setAudience(a => a.filter(k => k !== newKey))
        // Existing stage members send offer to new speaker
        if (isOnStage() && newKey !== myK) {
          await sendOffer(newKey, act?.id)
        }
        break
      }

      case 'SPACE_SPEAKER_LEFT': {
        const gone = msg.peerKey
        setStage(s => s.filter(k => k !== gone))
        closePeer(gone)
        break
      }

      case 'SPACE_SPEAK_REQUEST':
        // Host / co-host sees hand-raise requests
        setPending(r => r.includes(msg.peerKey) ? r : [...r, msg.peerKey])
        break

      case 'SPACE_PROMOTED': {
        // I was promoted to speaker or co-host
        setRole(msg.role)
        roleRef.current = msg.role
        setRaised(false)
        setStatus('Getting mic…')
        try {
          localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch {
          setStatus('Mic access denied.')
          return
        }
        setStatus(msg.role === 'cohost' ? 'You are Co-Host.' : 'You are now a Speaker!')
        // Send offers to all current listeners so they receive our audio
        for (const lk of (msg.listeners ?? [])) {
          await sendOffer(lk, act?.id)
        }
        // Existing stage members will send US offers (handled in SPACE_OFFER)
        break
      }

      case 'SPACE_DEMOTED':
        setRole('listener')
        roleRef.current = 'listener'
        localStream.current?.getTracks().forEach(t => t.stop())
        localStream.current = null
        for (const pc of Object.values(peerConns.current)) pc.close()
        peerConns.current = {}
        setStatus('Moved back to audience.')
        break

      case 'SPACE_OFFER': {
        // Someone wants to connect — answer them
        const spaceId = act?.id || msg.id
        const pc = makePeer(msg.from, spaceId)
        // Add our mic track if on stage (so they receive our audio too)
        if (localStream.current) {
          localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current))
        }
        await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sendWS({
          type: 'SPACE_ANSWER', id: spaceId,
          to: msg.from, from: myK,
          sdp: answer.sdp,
        })
        break
      }

      case 'SPACE_ANSWER':
        await peerConns.current[msg.from]?.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
        break

      case 'SPACE_ICE':
        peerConns.current[msg.from]?.addIceCandidate(msg.candidate).catch(() => {})
        break

      case 'SPACE_ENDED':
        setStatus('Vibe ended by host.')
        doCleanup()
        break
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  const createVibe = async () => {
    if (!myKey || !ws) return
    setStatus('Getting mic…')
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setStatus('Mic access denied.')
      return
    }
    sendWS({ type: 'SPACE_CREATE', hostKey: myKey, title: title || 'Vibeport Vibe' })
    const v = { id: myKey, title: title || 'Vibeport Vibe', hostKey: myKey }
    setActive(v); activeRef.current = v
    setRole('host'); roleRef.current = 'host'
    setStage([myKey]); stageRef.current = [myKey]
    setStatus('Vibe is live.')
  }

  const joinVibe = vibe => {
    if (!myKey || !ws) return
    sendWS({ type: 'SPACE_JOIN', id: vibe.id, peerKey: myKey })
    const v = { id: vibe.id, title: vibe.title, hostKey: vibe.hostKey }
    setActive(v); activeRef.current = v
    setRole('listener'); roleRef.current = 'listener'
    setStatus('Joined — waiting for stage audio…')
  }

  const leaveVibe = () => {
    if (!active) return
    if (role === 'host') {
      sendWS({ type: 'SPACE_END', id: active.id })
    } else {
      sendWS({ type: 'SPACE_LEAVE', id: active.id, peerKey: myKey })
    }
    doCleanup()
  }

  const doCleanup = () => {
    localStream.current?.getTracks().forEach(t => t.stop())
    localStream.current = null
    for (const pc of Object.values(peerConns.current)) pc.close()
    peerConns.current = {}
    for (const el of Object.values(audioEls.current)) el.remove()
    audioEls.current = {}
    setActive(null); activeRef.current = null
    setRole('none'); roleRef.current = 'none'
    setStage([]); stageRef.current = []
    setAudience([]); audRef.current = []
    setPending([]); setRaised(false); setStatus('')
  }

  const raiseHand = () => {
    if (!active || !myKey || !ws) return
    sendWS({ type: 'SPACE_REQUEST_SPEAK', id: active.id, peerKey: myKey })
    setRaised(true)
    setStatus('Hand raised — waiting for approval…')
  }

  const approveRequest = (peerKey, asCoHost = false) => {
    if (!active || !ws) return
    sendWS({ type: 'SPACE_PROMOTE', id: active.id, peerKey, fromKey: myKey, asCoHost })
    setPending(r => r.filter(k => k !== peerKey))
  }

  const denyRequest = peerKey => setPending(r => r.filter(k => k !== peerKey))

  const demoteSpeaker = peerKey => {
    if (!active || !ws || role !== 'host') return
    sendWS({ type: 'SPACE_DEMOTE', id: active.id, peerKey, fromKey: myKey })
  }

  // ── Render: Active Vibe ───────────────────────────────────────────────────
  if (active) {
    const amHost    = role === 'host'
    const onStage   = role === 'host' || role === 'cohost' || role === 'speaker'
    const canApprove = role === 'host' || role === 'cohost'
    const stageCount = stage.length

    return (
      <section className="spaces">
        <h2>
          {amHost ? '🎙 Hosting' : onStage ? '🎤 Speaking' : '👂 Listening'}
          {': '}
          {active.title}
        </h2>

        {/* Stage grid — 10 slots */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase',
                      letterSpacing: '0.1em', marginBottom: '0.6rem' }}>
            Stage ({stageCount}/{MAX_STAGE})
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
            {stage.map(key => (
              <div key={key} style={{
                border: `1px solid ${key === myKey ? 'var(--accent)' : 'var(--border)'}`,
                padding: '0.6rem 0.4rem', textAlign: 'center', background: 'var(--surface)',
              }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>🎤</div>
                <div style={{ fontSize: '0.6rem', color: key === myKey ? 'var(--accent)' : 'var(--muted)',
                              wordBreak: 'break-all' }}>
                  {key === myKey ? 'You' : key.slice(0, 8) + '…'}
                </div>
                {amHost && key !== myKey && (
                  <button onClick={() => demoteSpeaker(key)}
                    style={{ fontSize: '0.55rem', color: '#c00', background: 'none',
                             border: 'none', cursor: 'pointer', marginTop: '0.2rem' }}>
                    remove
                  </button>
                )}
              </div>
            ))}

            {/* Empty stage slots */}
            {Array.from({ length: Math.max(0, MAX_STAGE - stageCount) }).map((_, i) => (
              <div key={`e${i}`} style={{
                border: '1px solid var(--border)', padding: '0.6rem 0.4rem',
                textAlign: 'center', opacity: 0.25,
              }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>○</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>open</div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending requests */}
        {canApprove && pending.length > 0 && (
          <div style={{ border: '1px solid var(--accent)', padding: '0.75rem',
                        background: 'var(--surface)', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--accent)', fontSize: '0.72rem', textTransform: 'uppercase',
                        letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
              ✋ Requests ({pending.length})
            </p>
            {pending.map(pk => (
              <div key={pk} style={{ display: 'flex', alignItems: 'center',
                                     gap: '0.4rem', marginBottom: '0.4rem' }}>
                <code style={{ fontSize: '0.65rem', color: 'var(--muted)', flex: 1 }}>
                  {pk.slice(0, 24)}…
                </code>
                <button className="btn-small" style={{ fontSize: '0.65rem' }}
                  onClick={() => approveRequest(pk)}>Mic</button>
                {amHost && (
                  <button className="btn-small" style={{ fontSize: '0.65rem',
                            borderColor: 'var(--accent2)', color: 'var(--accent2)' }}
                    onClick={() => approveRequest(pk, true)}>Co-Host</button>
                )}
                <button className="btn-small" style={{ fontSize: '0.65rem',
                          borderColor: '#c00', color: '#c00' }}
                  onClick={() => denyRequest(pk)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Audience count */}
        <p style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '1rem' }}>
          {audience.length} in audience
        </p>

        {/* Listener controls */}
        {role === 'listener' && !raised && stageCount < MAX_STAGE && (
          <button className="btn-primary" onClick={raiseHand}
            style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            ✋ Request to Speak
          </button>
        )}
        {role === 'listener' && raised && (
          <p style={{ color: 'var(--accent)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            ✋ Hand raised — waiting for host…
          </p>
        )}
        {role === 'listener' && stageCount >= MAX_STAGE && (
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
            Stage is full (10/10 speakers)
          </p>
        )}

        {status && <p className="status">{status}</p>}

        <button onClick={leaveVibe} className="btn-primary"
          style={{ background: '#c00', marginTop: '0.75rem' }}>
          {amHost ? 'End Vibe' : 'Leave Vibe'}
        </button>
      </section>
    )
  }

  // ── Render: Lobby ─────────────────────────────────────────────────────────
  return (
    <section className="spaces">
      <h2>Vibes</h2>
      <p className="hint">
        Live audio rooms. Up to 10 speakers + co-host. No recording. Ephemeral by design.
      </p>

      {/* Create a vibe */}
      <div style={{ border: '1px solid var(--accent)', padding: '1rem',
                    marginBottom: '1.5rem', background: 'var(--surface)' }}>
        <p style={{ color: 'var(--accent)', fontSize: '0.8rem', marginBottom: '0.6rem',
                    textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Start a Vibe
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Vibe title…" maxLength={80} style={{ flex: 1 }} />
          <button className="btn-primary" onClick={createVibe}
            disabled={!ws} style={{ whiteSpace: 'nowrap' }}>
            🎙 Go Live
          </button>
        </div>
        {status && <p className="status">{status}</p>}
      </div>

      {/* Live vibes list */}
      <h3>Live Now</h3>
      {vibes.length === 0 ? (
        <p className="empty">No vibes live right now. Start one!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {vibes.map(v => (
            <div key={v.id} style={{
              border: '1px solid var(--border)', padding: '0.8rem',
              background: 'var(--surface)', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)',
                    animation: 'pulse-dot 2s ease infinite', display: 'inline-block',
                  }} />
                  <span style={{ color: 'var(--text)', fontWeight: 'bold' }}>{v.title}</span>
                </div>
                <p style={{ color: 'var(--muted)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                  {v.listeners} listening · {v.hostKey?.slice(0, 20)}…
                </p>
              </div>
              <button className="btn-primary" onClick={() => joinVibe(v)}
                disabled={v.hostKey === myKey} style={{ fontSize: '0.8rem' }}>
                Join
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
