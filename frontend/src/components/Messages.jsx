/**
 * Messages.jsx
 * BitChat-style encrypted direct messages.
 * Encryption: X25519 key exchange + crypto_box (XSalsa20-Poly1305)
 * Messages are decrypted by the node backend and stored locally.
 * The relay never sees plaintext.
 */

import { useState, useEffect, useRef } from 'react'
import { api, NODE_URL } from '../api'

const BASE = NODE_URL

export function Messages() {
  const [convos,   setConvos]   = useState([])
  const [active,   setActive]   = useState(null)   // peer key hex
  const [thread,   setThread]   = useState([])
  const [friends,  setFriends]  = useState([])
  const [compose,  setCompose]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [newPeer,  setNewPeer]  = useState('')
  const [status,   setStatus]   = useState('')
  const bottomRef = useRef()

  const loadConvos = () =>
    fetch(`${BASE}/api/messages`).then(r => r.json()).then(setConvos).catch(() => {})

  const loadThread = peer =>
    fetch(`${BASE}/api/messages/${peer}`).then(r => r.json()).then(setThread).catch(() => {})

  useEffect(() => {
    loadConvos()
    api.getFriends().then(setFriends).catch(() => {})
  }, [])

  // Poll for new messages every 4 seconds when in a thread
  useEffect(() => {
    if (!active) return
    loadThread(active)
    const t = setInterval(() => loadThread(active), 4000)
    return () => clearInterval(t)
  }, [active])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const openThread = peer => {
    setActive(peer)
    setStatus('')
    loadThread(peer)
  }

  const send = async () => {
    if (!compose.trim() || !active) return
    setSending(true)
    try {
      const res = await fetch(`${BASE}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: active, content: compose.trim() }),
      })
      if (!res.ok) throw new Error(await res.text())
      setCompose('')
      await loadThread(active)
      await loadConvos()
    } catch (e) {
      setStatus('Error: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  const startNew = () => {
    const k = newPeer.trim().toLowerCase()
    if (!/^[0-9a-f]{64}$/.test(k)) {
      setStatus('Enter a valid 64-char node key.')
      return
    }
    setNewPeer('')
    setStatus('')
    openThread(k)
  }

  const friendName = peer => {
    const f = friends.find(f => f.address === peer)
    return f?.handle || peer.slice(0, 16) + '…'
  }

  const friendAvatar = peer => {
    const f = friends.find(f => f.address === peer)
    return f?.avatar ? `${BASE}${f.avatar}` : null
  }

  return (
    <section style={{ display: 'flex', gap: '1rem', height: 520 }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--accent)', fontSize: '0.7rem', textTransform: 'uppercase',
                      letterSpacing: '.12em', marginBottom: '0.5rem' }}>
            Messages
          </p>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <input
              value={newPeer}
              onChange={e => setNewPeer(e.target.value)}
              placeholder="Paste node key…"
              style={{ flex: 1, fontSize: '0.65rem', padding: '0.3rem' }}
              onKeyDown={e => e.key === 'Enter' && startNew()}
            />
            <button className="btn-small" onClick={startNew}
              style={{ fontSize: '0.65rem', padding: '0.3rem 0.5rem' }}>+</button>
          </div>
          {status && <p style={{ color: '#ff4040', fontSize: '0.65rem', marginTop: '0.3rem' }}>{status}</p>}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Existing conversations */}
          {convos.map(c => (
            <div key={c.peer} onClick={() => openThread(c.peer)}
              style={{
                padding: '0.6rem 0.75rem', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                background: active === c.peer ? 'rgba(0,255,65,.06)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
              <Avatar url={friendAvatar(c.peer)} size={28} />
              <div style={{ minWidth: 0 }}>
                <p style={{ color: c.handle ? 'var(--text)' : 'var(--muted)',
                            fontSize: '0.72rem', fontWeight: 'bold',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.handle || c.peer.slice(0, 14) + '…'}
                </p>
                <p style={{ color: 'var(--muted)', fontSize: '0.62rem',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.direction === 'sent' ? '↑ ' : '↓ '}{c.content}
                </p>
              </div>
            </div>
          ))}

          {/* Friends not yet messaged */}
          {friends.filter(f => !convos.find(c => c.peer === f.address)).map(f => (
            <div key={f.address} onClick={() => openThread(f.address)}
              style={{
                padding: '0.6rem 0.75rem', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                background: active === f.address ? 'rgba(0,255,65,.06)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                opacity: 0.6,
              }}>
              <Avatar url={f.avatar ? `${BASE}${f.avatar}` : null} size={28} />
              <p style={{ color: 'var(--muted)', fontSize: '0.72rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.handle || f.address.slice(0, 14) + '…'}
              </p>
            </div>
          ))}

          {convos.length === 0 && friends.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.72rem', padding: '1rem' }}>
              Add friends first, then message them.
            </p>
          )}
        </div>
      </div>

      {/* ── Thread ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    border: '1px solid var(--border)', background: 'var(--surface)' }}>
        {active ? (
          <>
            {/* Header */}
            <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Avatar url={friendAvatar(active)} size={32} />
              <div>
                <p style={{ color: 'var(--text)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  {friendName(active)}
                </p>
                <p style={{ color: 'var(--muted)', fontSize: '0.6rem' }}>
                  🔒 end-to-end encrypted · X25519 + crypto_box
                </p>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem',
                          display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {thread.length === 0 && (
                <p style={{ color: 'var(--muted)', fontSize: '0.75rem', textAlign: 'center',
                            marginTop: '2rem' }}>
                  No messages yet. Say hello!
                </p>
              )}
              {thread.map(m => (
                <div key={m.id} style={{
                  alignSelf: m.direction === 'sent' ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                }}>
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    background: m.direction === 'sent' ? 'var(--accent)' : '#111',
                    color: m.direction === 'sent' ? '#000' : 'var(--text)',
                    fontSize: '0.82rem', lineHeight: 1.4,
                    borderRadius: 0,
                    border: m.direction === 'sent' ? 'none' : '1px solid var(--border)',
                  }}>
                    {m.content}
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '0.58rem',
                              textAlign: m.direction === 'sent' ? 'right' : 'left',
                              marginTop: '0.15rem' }}>
                    {new Date(m.created_at * 1000).toLocaleTimeString()}
                  </p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Compose */}
            <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border)',
                          display: 'flex', gap: '0.5rem' }}>
              <input
                value={compose}
                onChange={e => setCompose(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Message (Enter to send)…"
                style={{ flex: 1, fontSize: '0.82rem' }}
                maxLength={4000}
              />
              <button className="btn-primary" onClick={send} disabled={sending}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem' }}>
                {sending ? '…' : '↑'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: '100%', color: 'var(--muted)', fontSize: '0.8rem' }}>
            Select a friend to message
          </div>
        )}
      </div>
    </section>
  )
}

function Avatar({ url, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      border: '1px solid var(--border)',
      background: 'var(--code-bg)',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.5 }}>👤</span>
      }
    </div>
  )
}
