import { useState, useEffect } from 'react'
import { api } from '../api'

const STICKER_SET = [
  { id: 'star',    emoji: '⭐', label: 'Star' },
  { id: 'heart',   emoji: '💜', label: 'Heart' },
  { id: 'fire',    emoji: '🔥', label: 'Fire' },
  { id: 'cool',    emoji: '😎', label: 'Cool' },
  { id: 'ghost',   emoji: '👻', label: 'Ghost' },
  { id: 'flower',  emoji: '🌸', label: 'Flower' },
  { id: 'frog',    emoji: '🐸', label: 'Frog' },
  { id: 'cassette',emoji: '📼', label: 'Cassette' },
]

export function Stickers() {
  const [stickers, setStickers] = useState([])
  const [peer, setPeer] = useState('')
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')

  const load = () => api.getStickers().then(setStickers).catch(console.error)
  useEffect(() => { load() }, [])

  const send = async () => {
    if (!peer.trim() || !selected) return
    setStatus('Sending...')
    try {
      await api.sendSticker({ peer: peer.trim(), sticker_id: selected, message })
      setStatus(`${STICKER_SET.find(s=>s.id===selected)?.emoji} sent!`)
      setMessage('')
      load()
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    }
  }

  return (
    <section className="stickers">
      <h2>Send a Sticker</h2>
      <p className="hint">
        Stickers replace "likes." Each one is intentional — no passive double-taps.
      </p>

      <div className="sticker-form">
        <input
          value={peer}
          onChange={e => setPeer(e.target.value)}
          placeholder="Friend's node key..."
          className="key-input"
        />

        <div className="sticker-set">
          {STICKER_SET.map(s => (
            <button
              key={s.id}
              className={`sticker-btn ${selected === s.id ? 'selected' : ''}`}
              onClick={() => setSelected(s.id)}
              title={s.label}
            >
              {s.emoji}
            </button>
          ))}
        </div>

        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={200}
          placeholder="add a note (optional)"
        />

        <button onClick={send} className="btn-primary" disabled={!peer || !selected}>
          Send Sticker
        </button>
        {status && <p className="status">{status}</p>}
      </div>

      <h3>History</h3>
      <div className="sticker-history">
        {stickers.length === 0 && <p className="empty">No stickers yet.</p>}
        {stickers.map(s => {
          const def = STICKER_SET.find(x => x.id === s.sticker_id)
          return (
            <div key={s.id} className={`sticker-entry ${s.direction}`}>
              <span className="sticker-emoji">{def?.emoji ?? '?'}</span>
              <span className="sticker-dir">{s.direction === 'sent' ? 'to' : 'from'}</span>
              <code className="sticker-peer">{s.peer.slice(0, 20)}…</code>
              {s.message && <span className="sticker-msg">"{s.message}"</span>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
