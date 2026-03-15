/**
 * Discover.jsx
 * - Top 100 friends ranked by interaction score
 * - Discover new nodes via relay SPACES_LIST and friend-of-friend
 */

import { useState, useEffect } from 'react'
import { api, NODE_URL } from '../api'

export function Discover() {
  const [top, setTop]         = useState([])
  const [tab, setTab]         = useState('top')   // top | new

  useEffect(() => {
    api.getTop100().then(setTop).catch(console.error)
  }, [])

  return (
    <section className="discover">
      <h2>Discover</h2>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
        <button className={`tab-btn ${tab === 'top' ? 'active' : ''}`} onClick={() => setTab('top')}>
          ⚡ Your Circle
        </button>
        <button className={`tab-btn ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>
          🌐 Find Nodes
        </button>
      </div>

      {tab === 'top' && <TopFriends friends={top} />}
      {tab === 'new' && <NodeBrowser />}
    </section>
  )
}

function TopFriends({ friends }) {
  if (friends.length === 0) {
    return <p className="empty">No friends yet — add some from the Friends tab.</p>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {friends.map((f, i) => (
        <FriendCard key={f.address} friend={f} rank={i + 1} />
      ))}
    </div>
  )
}

function FriendCard({ friend, rank }) {
  const [expanded, setExpanded] = useState(false)

  const bump = () => api.bumpInteraction(friend.address).catch(() => {})

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        padding: '0.75rem',
        background: 'var(--surface)',
        cursor: 'pointer',
      }}
      onClick={() => { setExpanded(v => !v); bump() }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ color: 'var(--muted)', fontSize: '0.7rem', width: 24, textAlign: 'right' }}>
          #{rank}
        </span>

        {/* Avatar */}
        <div style={{
          width: 40, height: 40, border: '1px solid var(--accent)',
          overflow: 'hidden', flexShrink: 0, background: 'var(--code-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {friend.avatar
            ? <img src={`${NODE_URL}${friend.avatar}`} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '1.2rem' }}>👤</span>
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--text)', fontWeight: 'bold', fontSize: '0.9rem' }}>
            {friend.handle || friend.address.slice(0, 16) + '…'}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
            {friend.bio?.slice(0, 60) || ''}
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <p style={{ color: 'var(--accent)', fontSize: '0.75rem' }}>
            {friend.interaction_score} pts
          </p>
          {friend.last_seen && (
            <p style={{ color: 'var(--muted)', fontSize: '0.65rem' }}>
              {new Date(friend.last_seen * 1000).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {expanded && friend.custom_css && (
        <iframe
          title={friend.handle}
          sandbox="allow-same-origin"
          srcDoc={`<!DOCTYPE html><html><head><style>
            body{margin:0;padding:.75rem;background:#000;color:#fff;font-family:Arial,sans-serif}
            h1{color:#00ff41;font-size:1.1rem;margin:0 0 .25rem}
            ${friend.custom_css}
          </style></head><body>
            <h1>${esc(friend.handle || '')}</h1>
            <p>${esc(friend.bio || '')}</p>
          </body></html>`}
          style={{ width: '100%', height: 120, border: 'none', marginTop: '0.5rem' }}
        />
      )}
    </div>
  )
}

function NodeBrowser() {
  const [nodes,      setNodes]      = useState([])    // { key, handle, avatar, bio }
  const [friends,    setFriends]    = useState([])
  const [search,     setSearch]     = useState('')
  const [status,     setStatus]     = useState('')
  const [adding,     setAdding]     = useState(null)

  const addNode = async (address) => {
    setAdding(address)
    setStatus('')
    try {
      await api.addFriend(address)
      setStatus('Added!')
      setTimeout(() => setStatus(''), 3000)
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    } finally {
      setAdding(null)
    }
  }

  useEffect(() => {
    // Load local friends (seeded accounts show here)
    api.getFriends().then(setFriends).catch(() => {})

    // Also pull live nodes from relay PEER_LIST
    const RELAY = 'wss://relay.nixdata.net'
    try {
      const ws = new WebSocket(RELAY)
      ws.onopen = () => ws.send(JSON.stringify({ type: 'PEER_LIST' }))
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'PEER_LIST') {
            setNodes(prev => {
              const existing = new Set(prev.map(n => n.key))
              const fresh = (msg.peers ?? [])
                .filter(k => !existing.has(k))
                .map(k => ({ key: k }))
              return [...prev, ...fresh]
            })
          }
        } catch {}
      }
      ws.onerror = () => {}
      return () => ws.close()
    } catch {}
  }, [])

  // Merge friends into node list (friends have more profile data)
  const combined = [
    ...friends.map(f => ({
      key:    f.address,
      handle: f.handle,
      bio:    f.bio,
      avatar: f.avatar,
      isFriend: true,
    })),
    ...nodes.filter(n => !friends.find(f => f.address === n.key)),
  ]

  const filtered = combined.filter(n =>
    !search ||
    n.handle?.toLowerCase().includes(search.toLowerCase()) ||
    n.key?.includes(search) ||
    n.bio?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by handle, key, or bio…"
        style={{ width: '100%', marginBottom: '0.8rem' }}
      />
      {status && <p className="status">{status}</p>}

      <p style={{ color: 'var(--muted)', fontSize: '0.7rem', marginBottom: '0.75rem' }}>
        {filtered.length} node{filtered.length !== 1 ? 's' : ''} visible
      </p>

      {filtered.length === 0 ? (
        <p className="empty">No nodes visible. Add friends via their node key.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(n => (
            <div key={n.key} style={{
              border: '1px solid var(--border)', padding: '0.75rem',
              background: 'var(--surface)', display: 'flex',
              alignItems: 'center', gap: '0.75rem',
            }}>
              {/* Avatar */}
              <div style={{
                width: 40, height: 40, flexShrink: 0,
                border: '1px solid var(--accent)', overflow: 'hidden',
                background: 'var(--code-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {n.avatar
                  ? <img src={`${NODE_URL}${n.avatar}`} alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: '1.2rem' }}>👤</span>
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: n.handle ? 'var(--text)' : 'var(--muted)',
                            fontWeight: n.handle ? 'bold' : 'normal', fontSize: '0.85rem' }}>
                  {n.handle || 'Unknown Node'}
                </p>
                {n.bio && (
                  <p style={{ color: 'var(--muted)', fontSize: '0.7rem',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.bio.slice(0, 70)}
                  </p>
                )}
                <code style={{ fontSize: '0.62rem', color: 'var(--border)' }}>
                  {n.key?.slice(0, 24)}…
                </code>
              </div>

              {n.isFriend ? (
                <span style={{ fontSize: '0.65rem', color: 'var(--accent)', border: '1px solid var(--accent)',
                               padding: '0.2rem 0.5rem' }}>
                  ✓ Friend
                </span>
              ) : (
                <button className="btn-small" onClick={() => addNode(n.key)}
                  disabled={adding === n.key} style={{ fontSize: '0.75rem' }}>
                  {adding === n.key ? '…' : '+ Add'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
