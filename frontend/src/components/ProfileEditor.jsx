import { useState, useEffect } from 'react'
import { api } from '../api'

export function ProfileEditor() {
  const [form, setForm] = useState({ handle: '', bio: '', song_url: '', custom_css: '', custom_html: '' })
  const [status, setStatus] = useState('')

  useEffect(() => {
    api.getProfile().then(p => setForm({
      handle: p.handle ?? '',
      bio: p.bio ?? '',
      song_url: p.song_url ?? '',
      custom_css: p.custom_css ?? '',
      custom_html: p.custom_html ?? '',
    }))
  }, [])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setStatus('Saving...')
    try {
      await api.updateProfile(form)
      setStatus('Saved and broadcast to peers.')
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    }
  }

  return (
    <section className="profile-editor">
      <h2>Edit Your Page</h2>

      <label>Handle
        <input value={form.handle} onChange={set('handle')} maxLength={64} placeholder="your name" />
      </label>

      <label>Bio
        <textarea value={form.bio} onChange={set('bio')} maxLength={500} rows={3} placeholder="a few words about you" />
      </label>

      <label>Profile Song URL
        <input value={form.song_url} onChange={set('song_url')} placeholder="https://..." />
      </label>

      <label>Custom CSS <span className="hint">(chaos CSS — go wild)</span>
        <textarea
          value={form.custom_css}
          onChange={set('custom_css')}
          rows={8}
          className="code-input"
          placeholder="body { background: hotpink; } h1 { font-size: 4rem; }"
        />
      </label>

      <label>Custom HTML <span className="hint">(no scripts allowed)</span>
        <textarea
          value={form.custom_html}
          onChange={set('custom_html')}
          rows={6}
          className="code-input"
          placeholder="<marquee>welcome to my page</marquee>"
        />
      </label>

      <button onClick={save} className="btn-primary">Save & Broadcast</button>
      {status && <p className="status">{status}</p>}
    </section>
  )
}
