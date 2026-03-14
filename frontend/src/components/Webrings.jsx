import { useState, useEffect } from 'react'
import { api } from '../api'

export function Webrings() {
  const [rings, setRings] = useState([])
  const [name, setName] = useState('')
  const [topicKey, setTopicKey] = useState('')
  const [status, setStatus] = useState('')

  const load = () => api.getWebrings().then(setRings).catch(console.error)
  useEffect(() => { load() }, [])

  const join = async () => {
    if (!name.trim() || !topicKey.trim()) return
    setStatus('Joining...')
    try {
      await api.joinWebring({ name: name.trim(), topic_key: topicKey.trim() })
      setName('')
      setTopicKey('')
      setStatus('Joined!')
      load()
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    }
  }

  return (
    <section className="webrings">
      <h2>Webrings</h2>
      <p className="hint">
        Webrings are topic-based discovery rings — no algorithm, just shared interests.
        Share a ring's topic key with friends to form a neighborhood.
      </p>

      <div className="webring-form">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ring name (e.g. lo-fi beats)" />
        <input value={topicKey} onChange={e => setTopicKey(e.target.value)} placeholder="Topic key (shared secret)" />
        <button onClick={join} className="btn-primary">Join Ring</button>
        {status && <p className="status">{status}</p>}
      </div>

      <div className="webring-list">
        {rings.length === 0 && <p className="empty">Not in any webrings yet.</p>}
        {rings.map(r => (
          <div key={r.id} className="webring-card">
            <strong>{r.name}</strong>
            <code>{r.topic_key}</code>
            <span className="joined">joined {new Date(r.joined_at * 1000).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
