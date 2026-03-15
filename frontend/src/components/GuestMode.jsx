/**
 * GuestMode.jsx
 * Browser-only read-only view of the live Vibeport network.
 * No local node needed — fetches directly from the relay.
 *
 * Shows: active nodes (w/ relay-cached profiles) + live Vibes.
 * Any action that needs a node (friend, post, listen) triggers
 * the StartNodeModal with platform-appropriate download/waitlist.
 */

import { useState, useEffect, useRef } from 'react'
import { RippleBackground } from './RippleBackground'

const RELAY_WS   = 'wss://relay.nixdata.net'
const RELAY_HTTP = 'https://relay.nixdata.net'
const SITE_BASE  = 'https://vibeport.nixdata.net'
const RELEASES   = 'https://github.com/nix789/vibeport/releases/latest'

// ── Main component ────────────────────────────────────────────────────────────

export function GuestMode({ onBack }) {
  const [tab,       setTab]       = useState('nodes')
  const [nodes,     setNodes]     = useState([])
  const [vibes,     setVibes]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showStart, setShowStart] = useState(false)
  const [search,    setSearch]    = useState('')
  const wsRef = useRef(null)

  const scan = () => {
    setLoading(true)
    wsRef.current?.close()
    try {
      const ws = new WebSocket(RELAY_WS)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'PEER_LIST' }))
        ws.send(JSON.stringify({ type: 'SPACES_LIST' }))
      }

      ws.onmessage = async (e) => {
        try {
          const msg = JSON.parse(e.data)

          if (msg.type === 'PEER_LIST') {
            const keys = msg.peers ?? []
            // Fetch profiles in parallel — only show nodes with cached profiles
            const results = await Promise.allSettled(
              keys.slice(0, 60).map(key =>
                fetch(`${RELAY_HTTP}/profile/${key}`, { signal: AbortSignal.timeout(5000) })
                  .then(r => r.ok ? r.json() : null)
                  .then(p => (p && !p.error) ? { key, ...p } : null)
                  .catch(() => null)
              )
            )
            const active = results
              .filter(r => r.status === 'fulfilled' && r.value)
              .map(r => r.value)
              .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
            setNodes(active)
            setLoading(false)
          }

          if (msg.type === 'SPACES_LIST') {
            setVibes(msg.spaces ?? [])
          }
        } catch {}
      }

      ws.onerror  = () => setLoading(false)
      ws.onclose  = () => {}
    } catch { setLoading(false) }
  }

  useEffect(() => {
    scan()
    const t = setInterval(scan, 60_000)
    return () => { clearInterval(t); wsRef.current?.close() }
  }, [])

  const filtered = nodes.filter(n =>
    !search ||
    n.handle?.toLowerCase().includes(search.toLowerCase()) ||
    n.bio?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff',
                  fontFamily: 'monospace', position: 'relative' }}>
      <RippleBackground />

      {/* ── Top nav bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.97)', borderBottom: '1px solid #1a3a1a',
        padding: '0.6rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      }}>
        <button onClick={onBack} style={{
          color: '#444', background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.72rem',
        }}>← back</button>

        <span style={{ color: '#00ff41', fontWeight: 'bold', fontSize: '0.9rem',
                        letterSpacing: '0.2em' }}>VIBEPORT</span>

        <span style={{ color: '#1a3a1a' }}>|</span>

        <span style={{ color: '#2a5a2a', fontSize: '0.7rem' }}>
          {loading
            ? 'scanning network…'
            : `${nodes.length} active node${nodes.length !== 1 ? 's' : ''} · ${vibes.length} live vibe${vibes.length !== 1 ? 's' : ''}`
          }
        </span>

        <button onClick={() => setShowStart(true)} style={{
          marginLeft: 'auto',
          background: '#00ff41', color: '#000', border: 'none',
          padding: '0.4rem 1rem', fontFamily: 'monospace', fontSize: '0.72rem',
          fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.15em',
          cursor: 'pointer',
        }}>
          Start Your Node →
        </button>
      </div>

      {/* ── Main content ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 920,
                    margin: '0 auto', padding: '1.5rem 1rem 5rem' }}>

        {/* Guest badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem',
                      marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{
            background: '#0a0a00', border: '1px solid #2a2a00',
            color: '#666600', fontSize: '0.62rem', padding: '0.2rem 0.6rem',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            Guest View — Read Only
          </span>
          <span style={{ color: '#333', fontSize: '0.65rem' }}>
            Start a node to post, friend, message, and join Vibes
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
          {[['nodes', `Active Nodes (${nodes.length})`], ['vibes', `Live Vibes (${vibes.length})`]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '0.5rem 1rem', fontFamily: 'monospace', fontSize: '0.78rem',
              border: `1px solid ${tab === id ? '#00ff41' : '#1a3a1a'}`,
              background: tab === id ? 'rgba(0,255,65,0.07)' : 'transparent',
              color: tab === id ? '#00ff41' : '#444',
              cursor: 'pointer', letterSpacing: '0.1em',
            }}>{label}</button>
          ))}
          <button onClick={scan} style={{
            marginLeft: 'auto', padding: '0.5rem 0.75rem',
            background: 'transparent', border: '1px solid #1a3a1a',
            color: '#333', fontFamily: 'monospace', fontSize: '0.65rem',
            cursor: 'pointer',
          }}>↺ refresh</button>
        </div>

        {/* ── Nodes tab ── */}
        {tab === 'nodes' && (
          <>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="search by handle or bio…"
              style={{
                width: '100%', marginBottom: '1rem', padding: '0.6rem 0.75rem',
                background: '#050505', border: '1px solid #1a3a1a',
                color: '#fff', fontFamily: 'monospace', fontSize: '0.82rem',
                boxSizing: 'border-box',
              }}
            />
            {loading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#2a5a2a', fontSize: '0.85rem' }}>
                <div style={{ marginBottom: '0.5rem' }}>scanning relay for active nodes…</div>
                <div style={{ color: '#1a3a1a', fontSize: '0.7rem' }}>
                  only nodes with cached profiles appear here
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem' }}>
                <p style={{ color: '#333' }}>
                  {search ? 'no nodes match your search' : 'no active nodes cached on relay yet'}
                </p>
                <p style={{ color: '#222', fontSize: '0.72rem', marginTop: '0.5rem' }}>
                  be the first — start your node
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '0.75rem' }}>
                {filtered.map(n => (
                  <NodeCard key={n.key} node={n} onAction={() => setShowStart(true)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Vibes tab ── */}
        {tab === 'vibes' && (
          vibes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <p style={{ color: '#333', marginBottom: '0.5rem' }}>no live Vibes right now</p>
              <p style={{ color: '#222', fontSize: '0.72rem' }}>
                start a node to host one — up to 10 speakers + 1 co-host
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {vibes.map(v => (
                <VibeCard key={v.id} vibe={v} onAction={() => setShowStart(true)} />
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Sticky bottom CTA ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.97)', borderTop: '1px solid #1a3a1a',
        padding: '0.75rem 1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', flexWrap: 'wrap',
      }}>
        <p style={{ color: '#2a5a2a', fontSize: '0.72rem', margin: 0 }}>
          Your data. Your identity. Your network. — no sign-up, no email, no cloud.
        </p>
        <button onClick={() => setShowStart(true)} style={{
          background: 'transparent', border: '1px solid #00ff41',
          color: '#00ff41', padding: '0.5rem 1.25rem',
          fontFamily: 'monospace', fontSize: '0.78rem',
          cursor: 'pointer', letterSpacing: '0.15em', whiteSpace: 'nowrap',
        }}>
          Start Your Node →
        </button>
      </div>

      {showStart && <StartNodeModal onClose={() => setShowStart(false)} />}
    </div>
  )
}

// ── Node card ─────────────────────────────────────────────────────────────────

function NodeCard({ node, onAction }) {
  const profileUrl = `${SITE_BASE}/?nodekey=${node.key}`

  return (
    <div style={{
      border: '1px solid #1a3a1a', background: '#050905',
      padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem',
    }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        {/* Avatar placeholder — actual avatar lives on the node's localhost */}
        <div style={{
          width: 44, height: 44, flexShrink: 0,
          border: '1px solid #1a3a1a', background: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem',
        }}>👤</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#00ff41', fontWeight: 'bold', fontSize: '0.9rem',
                       marginBottom: '0.15rem', overflow: 'hidden',
                       textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.handle || 'Unknown Node'}
          </p>
          {node.bio && (
            <p style={{ color: '#555', fontSize: '0.72rem', lineHeight: 1.4,
                         overflow: 'hidden', display: '-webkit-box',
                         WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {node.bio}
            </p>
          )}
        </div>
      </div>

      {/* Recent post preview */}
      {node.posts?.length > 0 && (
        <div style={{ borderLeft: '2px solid #1a3a1a', paddingLeft: '0.6rem' }}>
          <p style={{ color: '#333', fontSize: '0.68rem', lineHeight: 1.4 }}>
            {node.posts[0].mood && <span style={{ marginRight: '0.3rem' }}>{node.posts[0].mood}</span>}
            {node.posts[0].content?.slice(0, 90)}
            {node.posts[0].content?.length > 90 ? '…' : ''}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
        <a href={profileUrl} target="_blank" rel="noreferrer" style={{
          flex: 1, padding: '0.4rem', textAlign: 'center',
          border: '1px solid #1a3a1a', color: '#2a5a2a',
          fontSize: '0.68rem', textDecoration: 'none', letterSpacing: '0.1em',
        }}>
          View Profile ↗
        </a>
        <button onClick={onAction} style={{
          flex: 1, padding: '0.4rem',
          background: 'transparent', border: '1px solid #1a3a1a',
          color: '#2a5a2a', fontFamily: 'monospace', fontSize: '0.68rem',
          cursor: 'pointer', letterSpacing: '0.1em',
        }}>
          + Add Friend
        </button>
      </div>

      <code style={{ color: '#1a3a1a', fontSize: '0.58rem' }}>
        {node.key.slice(0, 20)}…
      </code>
    </div>
  )
}

// ── Vibe card ─────────────────────────────────────────────────────────────────

function VibeCard({ vibe, onAction }) {
  return (
    <div style={{
      border: '1px solid #1a3a1a', background: '#050905',
      padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem',
    }}>
      {/* Live indicator */}
      <div style={{ flexShrink: 0, textAlign: 'center' }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: '#00ff41', boxShadow: '0 0 8px #00ff41',
          margin: '0 auto 0.3rem',
        }}/>
        <span style={{ color: '#2a5a2a', fontSize: '0.6rem' }}>LIVE</span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem',
                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {vibe.title || 'Untitled Vibe'}
        </p>
        <p style={{ color: '#333', fontSize: '0.7rem', marginTop: '0.2rem' }}>
          {vibe.listeners ?? 0} listener{vibe.listeners !== 1 ? 's' : ''} · host: {vibe.hostKey?.slice(0, 16)}…
        </p>
      </div>

      <button onClick={onAction} style={{
        background: 'rgba(0,255,65,0.08)', border: '1px solid #00ff41',
        color: '#00ff41', padding: '0.5rem 1rem',
        fontFamily: 'monospace', fontSize: '0.72rem',
        cursor: 'pointer', letterSpacing: '0.1em', whiteSpace: 'nowrap',
      }}>
        Listen In →
      </button>
    </div>
  )
}

// ── Start Your Node modal ─────────────────────────────────────────────────────

function StartNodeModal({ onClose }) {
  const ua       = navigator.userAgent
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua)
  const isIOS    = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const isMac    = !isMobile && /mac/i.test(ua)
  const isWin    = !isMobile && /win/i.test(ua)
  const isLinux  = !isMobile && !isMac && !isWin

  const [email,     setEmail]   = useState('')
  const [waitlisted, setWaitlisted] = useState(false)

  const joinWaitlist = () => {
    if (!email.trim()) return
    // Store locally for now — relay waitlist endpoint can be added later
    const list = JSON.parse(localStorage.getItem('vibeport_waitlist') ?? '[]')
    if (!list.includes(email)) list.push(email)
    localStorage.setItem('vibeport_waitlist', JSON.stringify(list))
    setWaitlisted(true)
  }

  const platforms = [
    { name: 'Windows', icon: '🪟', ext: '.exe', active: isWin },
    { name: 'macOS',   icon: '🍎', ext: '.dmg', active: isMac },
    { name: 'Linux',   icon: '🐧', ext: '.AppImage', active: isLinux },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }} onClick={onClose}>
      <div style={{
        background: '#050f05', border: '1px solid #1a3a1a',
        maxWidth: 520, width: '100%', padding: '2rem',
        position: 'relative',
      }} onClick={e => e.stopPropagation()}>

        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'none', border: 'none', color: '#444',
          fontFamily: 'monospace', fontSize: '1rem', cursor: 'pointer',
        }}>✕</button>

        <p style={{ color: '#00ff41', fontSize: '0.65rem', textTransform: 'uppercase',
                     letterSpacing: '0.2em', marginBottom: '0.5rem' }}>
          Start Your Node
        </p>
        <h2 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold',
                      marginBottom: '0.5rem' }}>
          {isMobile ? 'Mobile App Coming Soon' : 'One Click. You\'re Live.'}
        </h2>
        <p style={{ color: '#555', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: '1.75rem' }}>
          {isMobile
            ? 'Vibeport iOS and Android apps are in development. Drop your email and we\'ll let you know the moment they launch.'
            : 'Download the desktop app. Open it. Your node starts automatically — no terminal, no config, no account.'
          }
        </p>

        {isMobile ? (
          /* ── Mobile: waitlist ── */
          waitlisted ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ color: '#00ff41', fontSize: '1.1rem', marginBottom: '0.5rem' }}>✓ You're on the list</p>
              <p style={{ color: '#444', fontSize: '0.75rem' }}>
                We'll email you when {isIOS ? 'iOS' : 'Android'} launches.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem',
                             marginBottom: '1rem', padding: '0.75rem',
                             background: '#000', border: '1px solid #1a3a1a' }}>
                <span style={{ fontSize: '1.5rem' }}>{isIOS ? '🍏' : '🤖'}</span>
                <div>
                  <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {isIOS ? 'iOS' : 'Android'} App
                  </p>
                  <p style={{ color: '#2a5a2a', fontSize: '0.7rem' }}>Coming soon</p>
                </div>
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{
                  width: '100%', padding: '0.7rem 0.75rem',
                  background: '#000', border: '1px solid #1a3a1a',
                  color: '#fff', fontFamily: 'monospace', fontSize: '0.85rem',
                  marginBottom: '0.75rem', boxSizing: 'border-box',
                }}
              />
              <button onClick={joinWaitlist} style={{
                width: '100%', padding: '0.75rem',
                background: '#00ff41', color: '#000', border: 'none',
                fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 'bold',
                cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                Notify Me →
              </button>
            </div>
          )
        ) : (
          /* ── Desktop: download ── */
          <>
            {/* Steps */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem' }}>
              {[['①', 'Download'], ['②', 'Open App'], ['③', 'You\'re Live']].map(([n, label], i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                  <div style={{ color: '#00ff41', fontSize: '1.2rem', marginBottom: '0.25rem' }}>{n}</div>
                  <div style={{ color: '#2a5a2a', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                  {i < 2 && (
                    <div style={{ position: 'absolute', top: '0.6rem', right: 0,
                                   color: '#1a3a1a', fontSize: '0.8rem' }}>→</div>
                  )}
                </div>
              ))}
            </div>

            {/* Platform cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {platforms.map(p => (
                <a key={p.name} href={RELEASES} target="_blank" rel="noreferrer" style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.75rem', textDecoration: 'none',
                  border: `1px solid ${p.active ? '#00ff41' : '#1a3a1a'}`,
                  background: p.active ? 'rgba(0,255,65,0.05)' : 'transparent',
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: p.active ? '#fff' : '#444', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {p.name}
                      {p.active && <span style={{ color: '#00ff41', marginLeft: '0.5rem', fontSize: '0.65rem' }}>← your platform</span>}
                    </p>
                    <p style={{ color: '#2a5a2a', fontSize: '0.7rem' }}>Download {p.ext}</p>
                  </div>
                  <span style={{ color: p.active ? '#00ff41' : '#333', fontSize: '0.75rem' }}>↓</span>
                </a>
              ))}
            </div>

            <p style={{ color: '#222', fontSize: '0.65rem', textAlign: 'center', lineHeight: 1.5 }}>
              No account. No email. Your node generates its own identity locally.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
