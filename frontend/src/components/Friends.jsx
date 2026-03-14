import { useState, useEffect } from 'react'
import { api } from '../api'

export function Friends() {
  const [friends, setFriends] = useState([])
  const [key, setKey] = useState('')
  const [status, setStatus] = useState('')

  const load = () => api.getFriends().then(setFriends).catch(console.error)
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!key.trim()) return
    setStatus('Connecting...')
    try {
      await api.addFriend(key.trim())
      setKey('')
      setStatus('Friend added — syncing their profile...')
      load()
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    }
  }

  return (
    <section className="friends">
      <h2>Friends</h2>

      <div className="add-friend">
        <input
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="Paste their 64-char node key..."
          className="key-input"
        />
        <button onClick={add} className="btn-primary">Add Friend</button>
        {status && <p className="status">{status}</p>}
      </div>

      <div className="friends-list">
        {friends.length === 0 && <p className="empty">No friends yet. Share your node key!</p>}
        {friends.map(f => <FriendCard key={f.address} friend={f} />)}
      </div>
    </section>
  )
}

function FriendCard({ friend }) {
  const [showProfile, setShowProfile] = useState(false)

  const srcDoc = `<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;background:#1a1a2e;color:#eee;padding:1rem;}
    h1{color:#e94560;}
    ${friend.custom_css || ''}
  </style></head><body>
    <h1>${esc(friend.handle || friend.address.slice(0, 12) + '...')}</h1>
    <p>${esc(friend.bio || '')}</p>
    ${friend.song_url ? `<audio controls src="${esc(friend.song_url)}"></audio>` : ''}
    ${friend.custom_html || ''}
  </body></html>`

  return (
    <article className="friend-card">
      <div className="friend-header">
        <strong>{friend.handle || friend.address.slice(0, 16) + '...'}</strong>
        <button className="btn-small" onClick={() => setShowProfile(v => !v)}>
          {showProfile ? 'Hide Page' : 'View Page'}
        </button>
      </div>
      <code className="friend-key">{friend.address.slice(0, 32)}…</code>
      {friend.last_seen && (
        <span className="last-seen">last seen: {new Date(friend.last_seen * 1000).toLocaleDateString()}</span>
      )}
      {showProfile && (
        <iframe
          title={`${friend.handle}'s page`}
          sandbox="allow-same-origin allow-forms"
          srcDoc={srcDoc}
          className="profile-frame"
        />
      )}
    </article>
  )
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
