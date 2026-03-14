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
