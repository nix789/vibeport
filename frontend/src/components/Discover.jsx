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
  const [nodes, setNodes]   = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const addNode = async (address) => {
    setStatus('Adding...')
    try {
      await api.addFriend(address)
      setStatus('Added! Syncing their profile...')
      setTimeout(() => setStatus(''), 3000)
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    }
  }

  // Pull node list from relay's INFO endpoint via WebSocket
  useEffect(() => {
    const RELAY = 'wss://relay.nixdata.net:4444'
    try {
      const ws = new WebSocket(RELAY)
      ws.onopen = () => ws.send(JSON.stringify({ type: 'SPACES_LIST' }))
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'SPACES_LIST') {
            setNodes(msg.spaces ?? [])
          }
        } catch {}
      }
      ws.onerror = () => {}
      return () => ws.close()
    } catch {}
  }, [])

  const filtered = nodes.filter(n =>
    !search || n.hostKey?.includes(search) || n.title?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by key or name..."
        style={{ width: '100%', marginBottom: '0.8rem' }}
      />
      {status && <p className="status">{status}</p>}

      {filtered.length === 0 ? (
        <p className="empty">No live nodes visible right now. Try adding friends directly via their node key.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(n => (
            <div key={n.hostKey} style={{
              border: '1px solid var(--border)', padding: '0.75rem',
              background: 'var(--surface)', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <p style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>{n.title}</p>
                <code style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                  {n.hostKey?.slice(0, 24)}…
                </code>
              </div>
              <button className="btn-small" onClick={() => addNode(n.hostKey)}>
                + Add
              </button>
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
