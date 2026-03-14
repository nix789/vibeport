/**
 * P2PStatus.jsx
 * Polls the local node API to show live DHT peer discovery status.
 * Displays peers found, core key, and connection health.
 */

import { useState, useEffect } from 'react'

const API = 'http://127.0.0.1:7331/api'
const POLL_MS = 5000

export function P2PStatus() {
  const [identity, setIdentity] = useState(null)
  const [peers, setPeers]       = useState([])
  const [nodeUp, setNodeUp]     = useState(false)
  const [lastSeen, setLastSeen] = useState(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const [idRes, healthRes] = await Promise.all([
          fetch(`${API}/identity`).then(r => r.json()),
          fetch(`${API}/health`).then(r => r.json()),
        ])
        if (cancelled) return
        setIdentity(idRes)
        setNodeUp(healthRes.status === 'ok')
        setLastSeen(new Date())
        // Peer list comes from friends endpoint for now
        const friendsRes = await fetch(`${API}/friends`).then(r => r.json())
        if (!cancelled) setPeers(friendsRes)
      } catch {
        if (!cancelled) setNodeUp(false)
      }
    }

    poll()
    const id = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return (
    <section className="p2p-status" style={{ fontFamily: 'monospace' }}>
      <h2>Node Status</h2>

      {/* Connection indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: nodeUp ? '#4ade80' : '#e94560',
            boxShadow: nodeUp ? '0 0 8px #4ade80' : '0 0 8px #e94560',
            animation: nodeUp ? 'pulse-dot 2s ease infinite' : 'none',
          }}
        />
        <span style={{ fontSize: '0.8rem', color: nodeUp ? '#4ade80' : '#e94560' }}>
          {nodeUp ? 'Port Online' : 'Port Offline — run npm run node:dev'}
        </span>
        {lastSeen && (
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: 'auto' }}>
            polled {lastSeen.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Identity */}
      {identity?.coreKey && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>
            YOUR NODE KEY
          </p>
          <code
            style={{
              display: 'block',
              fontSize: '0.65rem',
              wordBreak: 'break-all',
              background: 'var(--code-bg)',
              padding: '0.5rem',
              color: 'var(--accent2)',
            }}
          >
            {identity.coreKey}
          </code>
        </div>
      )}

      {/* DHT peers */}
      <div>
        <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
          CONNECTED PEERS ({peers.length})
        </p>
        {peers.length === 0 ? (
          <p className="empty">No peers yet. Share your node key to connect.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {peers.map(p => (
              <div
                key={p.address}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.5rem',
                  background: 'var(--code-bg)',
                  borderLeft: '3px solid var(--accent2)',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: p.last_seen ? '#4ade80' : '#888',
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: 'var(--text)' }}>
                  {p.handle || p.address.slice(0, 20) + '…'}
                </span>
                <code style={{ fontSize: '0.6rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                  {p.address.slice(0, 12)}…
                </code>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </section>
  )
}
