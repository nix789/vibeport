/**
 * ProfileEditor.jsx
 * Friendly split-pane profile editor with:
 *  - Live CSS/HTML preview
 *  - CSS snippet helpers
 *  - Music embed (Spotify / SoundCloud / YouTube / Bandcamp)
 *  - Tab-based editor (Info | CSS | HTML | Music)
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'

const CSS_SNIPPETS = [
  { label: '🌈 Rainbow BG',     code: 'body { background: linear-gradient(135deg, #ff006e, #8338ec, #3a86ff); }' },
  { label: '⚡ Neon Text',      code: 'h1 { color: #00ff41; text-shadow: 0 0 10px #00ff41, 0 0 40px #00ff41; }' },
  { label: '📼 VHS Scanlines',  code: 'body::after { content:""; position:fixed; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.3) 2px,rgba(0,0,0,.3) 4px); pointer-events:none; }' },
  { label: '🌊 Animated BG',    code: 'body { background: linear-gradient(270deg,#000,#001a00,#000); background-size:400% 400%; animation: vibe 8s ease infinite; } @keyframes vibe { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }' },
  { label: '🔠 Comic Sans',     code: 'body { font-family: "Comic Sans MS", cursive; }' },
  { label: '💾 Pixel Font',     code: '@import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"); body { font-family: "Press Start 2P", monospace; font-size: 10px; }' },
  { label: '🌸 Blush BG',      code: 'body { background: #1a0011; } h1 { color: #ff69b4; }' },
  { label: '🖤 Pure Black',     code: 'body { background: #000; color: #fff; } h1 { color: #00ff41; }' },
]

const HTML_SNIPPETS = [
  { label: '📢 Marquee',        code: '<marquee><b>✨ welcome to my vibeport ✨</b></marquee>' },
  { label: '⭐ Star divider',   code: '<p style="text-align:center;letter-spacing:1rem">★ ★ ★ ★ ★</p>' },
  { label: '🖼️ Image',          code: '<img src="https://placecats.com/200/200" style="max-width:100%;border-radius:8px">' },
  { label: '📋 List',           code: '<ul style="list-style:none;padding:0"><li>🎵 currently listening to...</li><li>📖 currently reading...</li><li>🎮 currently playing...</li></ul>' },
  { label: '💬 Quote box',      code: '<blockquote style="border-left:3px solid #00ff41;padding:.5rem 1rem;margin:1rem 0;font-style:italic">"put your favorite quote here"</blockquote>' },
  { label: '📅 Now playing',    code: '<div style="background:#111;border:1px solid #00ff41;padding:.75rem;border-radius:4px"><p style="margin:0;color:#00ff41;font-size:.75rem">▶ NOW PLAYING</p><p style="margin:0">Song title - Artist</p></div>' },
]

const MUSIC_PLATFORMS = [
  {
    id: 'spotify',
    label: 'Spotify',
    color: '#1db954',
    placeholder: 'Paste Spotify embed code...',
    how: 'Spotify → Share → Embed track → Copy',
    validate: (s) => s.includes('open.spotify.com'),
  },
  {
    id: 'soundcloud',
    label: 'SoundCloud',
    color: '#ff5500',
    placeholder: 'Paste SoundCloud embed code...',
    how: 'SoundCloud → Share → Embed → Copy code',
    validate: (s) => s.includes('soundcloud.com'),
  },
  {
    id: 'youtube',
    label: 'YouTube',
    color: '#ff0000',
    placeholder: 'Paste YouTube embed code...',
    how: 'YouTube → Share → Embed → Copy',
    validate: (s) => s.includes('youtube.com') || s.includes('youtu.be'),
  },
  {
    id: 'bandcamp',
    label: 'Bandcamp',
    color: '#1da0c3',
    placeholder: 'Paste Bandcamp embed code...',
    how: 'Bandcamp → Share / Embed → Copy embed code',
    validate: (s) => s.includes('bandcamp.com'),
  },
]

const ALLOWED_MUSIC_ORIGINS = ['open.spotify.com', 'w.soundcloud.com', 'www.youtube.com', 'bandcamp.com']

function sanitizeMusicEmbed(raw) {
  if (!raw) return ''
  // Must be a single iframe tag
  const match = raw.match(/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i)
  if (!match) return ''
  try {
    const url = new URL(match[1])
    if (!ALLOWED_MUSIC_ORIGINS.some(o => url.hostname.endsWith(o))) return ''
  } catch { return '' }
  // Strip any attributes that could be dangerous, rebuild clean iframe
  const src = match[1]
  return `<iframe src="${src}" width="100%" height="80" frameborder="0" allow="autoplay; clipboard-write; encrypted-media" loading="lazy"></iframe>`
}

export function ProfileEditor({ onSave }) {
  const [form, setForm]         = useState({ handle: '', bio: '', song_embed: '', custom_css: '', custom_html: '', avatar: '' })
  const [tab, setTab]           = useState('info')
  const [preview, setPreview]   = useState(false)
  const [status, setStatus]     = useState('')
  const [avatarErr, setAvatarErr] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [musicPlatform, setMusicPlatform] = useState('spotify')
  const [embedRaw, setEmbedRaw]           = useState('')
  const [embedErr, setEmbedErr]           = useState('')

  useEffect(() => {
    api.getProfile().then(p => setForm({
      handle:      p.handle      ?? '',
      bio:         p.bio         ?? '',
      song_embed:  p.song_url    ?? '',
      custom_css:  p.custom_css  ?? '',
      custom_html: p.custom_html ?? '',
      avatar:      p.avatar      ?? '',
    }))
  }, [])

  const onAvatarChange = async (e) => {
    setAvatarErr('')
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setAvatarErr('Images only.'); return }
    if (file.size > 5 * 1024 * 1024)    { setAvatarErr(`Max 5 MB (yours: ${(file.size/1024/1024).toFixed(1)} MB).`); return }
    setAvatarUploading(true)
    try {
      const { url } = await api.uploadAvatar(file)
      setForm(f => ({ ...f, avatar: url }))
    } catch (e) {
      setAvatarErr(`Upload failed: ${e.message}`)
    } finally {
      setAvatarUploading(false)
    }
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const insertSnippet = (field, code) => {
    setForm(f => ({ ...f, [field]: f[field] + (f[field] ? '\n' : '') + code }))
  }

  const applyEmbed = () => {
    setEmbedErr('')
    const platform = MUSIC_PLATFORMS.find(p => p.id === musicPlatform)
    if (!platform.validate(embedRaw)) {
      setEmbedErr(`That doesn't look like a ${platform.label} embed.`)
      return
    }
    const clean = sanitizeMusicEmbed(embedRaw)
    if (!clean) {
      setEmbedErr('Could not parse embed. Paste the full iframe code.')
      return
    }
    setForm(f => ({ ...f, song_embed: clean }))
    setEmbedRaw('')
  }

  const save = async () => {
    setStatus('Saving...')
    try {
      await api.updateProfile({
        handle:      form.handle,
        bio:         form.bio,
        song_url:    form.song_embed,
        custom_css:  form.custom_css,
        custom_html: form.custom_html,
      })
      setStatus('Saved ✓')
      onSave?.()
      setTimeout(() => setStatus(''), 2500)
    } catch (e) {
      setStatus(`Error: ${e.message}`)
    }
  }

  const previewDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:1rem;margin:0}
    h1{color:#00ff41;margin:.5rem 0 .25rem} .bio{opacity:.85}
    .node{font-size:.65rem;opacity:.4;margin-top:.5rem;word-break:break-all}
    .avatar{width:80px;height:80px;object-fit:cover;border:2px solid #00ff41}
    ${form.custom_css}
  </style></head><body>
    ${form.avatar ? `<img class="avatar" src="http://127.0.0.1:7331${form.avatar}" alt="avatar">` : ''}
    <h1>${esc(form.handle || 'your name')}</h1>
    <p class="bio">${esc(form.bio || 'your bio goes here')}</p>
    ${form.song_embed || ''}
    ${form.custom_html || ''}
    <p class="node">vibeport node</p>
  </body></html>`

  const TABS = [
    { id: 'info',  label: '👤 Info'   },
    { id: 'css',   label: '🎨 Style'  },
    { id: 'html',  label: '🧱 Layout' },
    { id: 'music', label: '🎵 Music'  },
  ]

  return (
    <section className="profile-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Edit Your Page</h2>
        <button
          className="btn-small"
          onClick={() => setPreview(v => !v)}
          style={preview ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
        >
          {preview ? '✕ Close Preview' : '👁 Live Preview'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: preview ? 'nowrap' : 'wrap' }}>

        {/* ── Editor pane ──────────────────────────────────────────── */}
        <div style={{ flex: '1 1 340px', minWidth: 0 }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={`tab-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
                style={{ fontSize: '0.78rem' }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Info tab */}
          {tab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>

              {/* Avatar upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ cursor: 'pointer', margin: 0 }} title="Click to upload">
                  <div style={{
                    width: 80, height: 80,
                    border: '2px solid var(--accent)',
                    background: 'var(--code-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', flexShrink: 0, position: 'relative',
                  }}>
                    {form.avatar
                      ? <img src={`http://127.0.0.1:7331${form.avatar}`} alt="avatar"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: '2rem' }}>👤</span>
                    }
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity .2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0}
                    >
                      <span style={{ fontSize: '1.4rem' }}>📷</span>
                    </div>
                  </div>
                  <input type="file" accept="image/*" onChange={onAvatarChange}
                    style={{ display: 'none' }} />
                </label>
                <div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
                    {avatarUploading ? 'Uploading...' : 'Profile Photo'}
                  </p>
                  <p className="hint">GIFs welcome · max 5 MB · click photo to change</p>
                  {avatarErr && <p className="error">{avatarErr}</p>}
                </div>
              </div>

              <label>
                Handle
                <input value={form.handle} onChange={set('handle')} maxLength={64} placeholder="@yourname" />
              </label>
              <label>
                Bio
                <textarea value={form.bio} onChange={set('bio')} maxLength={500} rows={4}
                  placeholder="tell the world who you are..." />
              </label>
              <p className="hint">Switch to Style, Layout, or Music tabs to customize your page.</p>
            </div>
          )}

          {/* CSS tab */}
          {tab === 'css' && (
            <div>
              <p className="hint" style={{ marginBottom: '0.6rem' }}>Click a snippet to add it, then tweak it.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.8rem' }}>
                {CSS_SNIPPETS.map(s => (
                  <button key={s.label} className="btn-small"
                    onClick={() => insertSnippet('custom_css', s.code)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <textarea
                value={form.custom_css}
                onChange={set('custom_css')}
                rows={14}
                className="code-input"
                style={{ width: '100%', resize: 'vertical' }}
                placeholder="/* your CSS here — anything goes */"
              />
            </div>
          )}

          {/* HTML tab */}
          {tab === 'html' && (
            <div>
              <p className="hint" style={{ marginBottom: '0.6rem' }}>Add content blocks to your page. No scripts.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.8rem' }}>
                {HTML_SNIPPETS.map(s => (
                  <button key={s.label} className="btn-small"
                    onClick={() => insertSnippet('custom_html', s.code)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <textarea
                value={form.custom_html}
                onChange={set('custom_html')}
                rows={14}
                className="code-input"
                style={{ width: '100%', resize: 'vertical' }}
                placeholder="<marquee>welcome to my page</marquee>"
              />
            </div>
          )}

          {/* Music tab */}
          {tab === 'music' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <p className="hint">Paste an embed code from your streaming platform — not a URL.</p>

              {/* Platform picker */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {MUSIC_PLATFORMS.map(p => (
                  <button
                    key={p.id}
                    className="btn-small"
                    onClick={() => setMusicPlatform(p.id)}
                    style={musicPlatform === p.id
                      ? { borderColor: p.color, color: p.color }
                      : {}}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* How-to */}
              <p className="hint" style={{ background: 'var(--code-bg)', padding: '0.5rem' }}>
                📋 {MUSIC_PLATFORMS.find(p => p.id === musicPlatform)?.how}
              </p>

              {/* Embed paste */}
              <textarea
                value={embedRaw}
                onChange={e => setEmbedRaw(e.target.value)}
                rows={5}
                className="code-input"
                style={{ width: '100%' }}
                placeholder={MUSIC_PLATFORMS.find(p => p.id === musicPlatform)?.placeholder}
              />
              {embedErr && <p className="error">{embedErr}</p>}
              <button className="btn-primary" onClick={applyEmbed} style={{ alignSelf: 'flex-start' }}>
                Apply Embed
              </button>

              {form.song_embed && (
                <div>
                  <p className="hint" style={{ marginBottom: '0.4rem' }}>Current embed:</p>
                  <div dangerouslySetInnerHTML={{ __html: form.song_embed }} />
                  <button className="btn-small" style={{ marginTop: '0.4rem' }}
                    onClick={() => setForm(f => ({ ...f, song_embed: '' }))}>
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          <button onClick={save} className="btn-primary" style={{ marginTop: '1.2rem', width: '100%' }}>
            Save & Broadcast
          </button>
          {status && <p className="status" style={{ textAlign: 'center' }}>{status}</p>}
        </div>

        {/* ── Live preview pane ─────────────────────────────────────── */}
        {preview && (
          <div style={{ flex: '1 1 340px', minWidth: 0 }}>
            <p className="hint" style={{ marginBottom: '0.4rem' }}>Live Preview</p>
            <iframe
              title="live preview"
              sandbox="allow-same-origin"
              srcDoc={previewDoc}
              style={{ width: '100%', height: '500px', border: '1px solid var(--accent)', background: '#000' }}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
