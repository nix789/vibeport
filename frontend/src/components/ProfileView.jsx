/**
 * ProfileView.jsx
 * Renders the user's profile page inside a sandboxed iframe.
 * Custom CSS and HTML are injected but JS is blocked by sandbox.
 */

import { useState, useEffect } from 'react'
import { api } from '../api'

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
  body { font-family: Arial, sans-serif; background: #1a1a2e; color: #eee; padding: 1rem; }
  h1 { color: #e94560; }
  .bio { opacity: 0.85; }
  .address { font-size: 0.7rem; opacity: 0.5; word-break: break-all; margin-top: 0.5rem; }
  /* User's chaos CSS */
  ${profile.custom_css}
</style>
</head>
<body>
  <h1>${escHtml(profile.handle || 'anon')}</h1>
  <p class="bio">${escHtml(profile.bio || '')}</p>
  ${profile.song_url ? `<audio controls src="${escAttr(profile.song_url)}"></audio>` : ''}
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
      {identity && (
        <p className="node-key">
          <strong>Your node key</strong> (share this to be added as a friend):<br />
          <code>{identity.coreKey}</code>
        </p>
      )}
    </section>
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
