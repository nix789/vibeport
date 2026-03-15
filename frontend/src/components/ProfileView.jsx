/**
 * ProfileView.jsx
 * Renders the user's profile page inside a sandboxed iframe.
 * Custom CSS and HTML are injected but JS is blocked by sandbox.
 */

import { useState, useEffect } from 'react'
import { api } from '../api'

const SITE_BASE  = 'https://vibeport.nixdata.net'
const RELAY_BASE = 'https://relay.nixdata.net'

export function ProfileView() {
  const [profile, setProfile] = useState(null)
  const [identity, setIdentity] = useState(null)

  useEffect(() => {
    api.getProfile().then(setProfile).catch(console.error)
    api.identity().then(setIdentity).catch(console.error)
  }, [])

  if (!profile) return <p className="loading">Loading profile...</p>

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; background: #000; color: #fff; padding: 1rem; margin: 0; }
  h1 { color: #00ff41; margin: 0.5rem 0 0.25rem; }
  .bio { opacity: 0.85; }
  .address { font-size: 0.7rem; opacity: 0.5; word-break: break-all; margin-top: 0.5rem; }
  .avatar { width: 90px; height: 90px; object-fit: cover; border: 2px solid #00ff41; display: block; }
  /* User's chaos CSS */
  ${profile.custom_css}
</style>
</head>
<body>
  ${profile.avatar ? `<img class="avatar" src="http://127.0.0.1:7331${escAttr(profile.avatar)}" alt="avatar">` : ''}
  <h1>${escHtml(profile.handle || 'anon')}</h1>
  <p class="bio">${escHtml(profile.bio || '')}</p>
  ${profile.song_url || ''}
  ${profile.custom_html || ''}
  <p class="address">node: ${identity?.coreKey ?? '...'}</p>
</body>
</html>`

  return (
    <section className="profile-view">
      <h2>Your Page</h2>
      {/* sandbox blocks scripts, popups, and top-level navigation */}
      <iframe
        title="Profile preview"
        sandbox="allow-same-origin allow-forms"
        srcDoc={srcDoc}
        className="profile-frame"
      />
      {identity?.coreKey && <ShareBanner nodeKey={identity.coreKey} />}
    </section>
  )
}

function ShareBanner({ nodeKey }) {
  const [copied, setCopied] = useState('')

  // relay.nixdata.net/u/KEY serves proper OG meta tags for X, Discord, iMessage etc.
  const shareUrl  = `${RELAY_BASE}/u/${nodeKey}`
  const shortKey  = nodeKey.slice(0, 20) + '…'

  const copy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  return (
    <div style={{
      border: '1px solid #1a3a1a', background: '#050f05',
      padding: '1rem', marginTop: '0.75rem',
    }}>
      <p style={{ color: '#00ff41', fontSize: '0.7rem', textTransform: 'uppercase',
                  letterSpacing: '.15em', marginBottom: '0.6rem' }}>
        Your Vibeport Link
      </p>

      <div style={{
        background: '#000', border: '1px solid #0a2a0a', padding: '0.6rem',
        fontFamily: 'monospace', fontSize: '0.72rem', color: '#00cc33',
        wordBreak: 'break-all', marginBottom: '0.6rem',
      }}>
        relay.nixdata.net/u/<span style={{ color: '#00ff41' }}>{shortKey}</span>
      </div>

      <p style={{ color: '#555', fontSize: '0.68rem', marginBottom: '0.75rem' }}>
        Share on X, Discord, iMessage — shows your handle, bio &amp; recent posts as a preview card.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className="btn-primary"
          style={{ fontSize: '0.75rem', padding: '0.4rem 0.9rem' }}
          onClick={() => copy(shareUrl, 'link')}
        >
          {copied === 'link' ? '✓ Copied!' : '🔗 Copy Link'}
        </button>
        <button
          className="btn-primary"
          style={{ fontSize: '0.75rem', padding: '0.4rem 0.9rem',
                   background: 'transparent', border: '1px solid #1a3a1a', color: '#00cc33' }}
          onClick={() => copy(nodeKey, 'key')}
        >
          {copied === 'key' ? '✓ Copied!' : 'Copy Key Only'}
        </button>
      </div>
    </div>
  )
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
