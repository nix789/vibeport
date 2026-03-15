/**
 * SharePage.jsx
 * Public-facing profile page shown when someone visits:
 *   vibeport.nixdata.net/YOUR_NODE_KEY
 *
 * If the visitor has Vibeport running locally (localhost:7331), they get
 * a one-click "Add as Friend" button. Otherwise they see download links.
 */

import { useState, useEffect } from 'react'
import { RippleBackground } from './RippleBackground'

const NODE_URL    = 'http://127.0.0.1:7331'
const RELAY_URL   = 'https://relay.nixdata.net'
const SITE_BASE   = 'https://vibeport.nixdata.net'
const RELEASES    = 'https://github.com/nix789/vibeport/releases/latest'

export function SharePage({ nodeKey }) {
  const [nodeOnline, setNodeOnline] = useState(false)
  const [cached,     setCached]     = useState(null)   // relay profile cache
  const [status,     setStatus]     = useState('')     // '', 'adding', 'done', 'error'
  const [copied,     setCopied]     = useState(false)

  // Check if visitor's own Vibeport node is running
  useEffect(() => {
    fetch(`${NODE_URL}/api/health`)
      .then(r => r.ok ? setNodeOnline(true) : null)
      .catch(() => {})
  }, [])

  // Fetch cached profile from relay (available even when target node is offline)
  useEffect(() => {
    fetch(`${RELAY_URL}/profile/${nodeKey}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && !data.error) setCached(data) })
      .catch(() => {})
  }, [nodeKey])

  const addFriend = async () => {
    setStatus('adding')
    try {
      const res = await fetch(`${NODE_URL}/api/friends`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ coreKey: nodeKey }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus('done')
    } catch (e) {
      setStatus('error:' + e.message)
    }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(nodeKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${SITE_BASE}/${nodeKey}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const short = nodeKey.slice(0, 16) + '…' + nodeKey.slice(-8)

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff',
                  fontFamily: 'monospace', position: 'relative' }}>
      <RippleBackground />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex',
                    flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', minHeight: '100vh',
                    padding: '2rem', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ fontSize: '4rem', color: '#00ff41', fontWeight: 'bold',
                      letterSpacing: '.15em', marginBottom: '0.5rem' }}>
          V
        </div>
        <p style={{ color: '#1a3a1a', fontSize: '0.7rem', letterSpacing: '.3em',
                    textTransform: 'uppercase', marginBottom: '3rem' }}>
          VIBEPORT
        </p>

        {/* Card */}
        <div style={{ border: '1px solid #1a3a1a', padding: '2rem',
                      background: '#050f05', maxWidth: 520, width: '100%' }}>

          <p style={{ color: '#00ff41', fontSize: '0.7rem', textTransform: 'uppercase',
                      letterSpacing: '.2em', marginBottom: '1rem' }}>
            Vibeport Node
          </p>

          {/* Profile preview — cached from relay if node was recently online */}
          {cached ? (
            <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem',
                            marginBottom: '0.75rem' }}>
                <div style={{ width: 48, height: 48, border: '1px solid #00ff41',
                              overflow: 'hidden', flexShrink: 0, background: '#000',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.5rem' }}>👤</span>
                </div>
                <div>
                  <p style={{ color: '#00ff41', fontWeight: 'bold', fontSize: '1rem', margin: 0 }}>
                    {cached.handle || 'Unknown Node'}
                  </p>
                  {cached.bio && (
                    <p style={{ color: '#888', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
                      {cached.bio}
                    </p>
                  )}
                </div>
              </div>

              {cached.posts?.length > 0 && (
                <div style={{ borderTop: '1px solid #1a3a1a', paddingTop: '0.75rem' }}>
                  <p style={{ color: '#444', fontSize: '0.6rem', textTransform: 'uppercase',
                               letterSpacing: '.1em', marginBottom: '0.5rem' }}>
                    Recent vibes
                  </p>
                  {cached.posts.slice(0, 3).map((p, i) => (
                    <p key={i} style={{ color: '#666', fontSize: '0.78rem',
                                        borderLeft: '2px solid #1a3a1a', paddingLeft: '0.6rem',
                                        marginBottom: '0.4rem' }}>
                      {p.mood && <span style={{ marginRight: '0.4rem' }}>{p.mood}</span>}
                      {p.content?.slice(0, 120)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ color: '#888', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                Someone shared their Vibeport node with you.
                Add them as a friend to sync profiles and exchange stickers.
              </p>
              {/* Always offer the relay profile page — works even when node is offline */}
              <a
                href={`${RELAY_URL}/u/${nodeKey}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'block', padding: '0.55rem 0.75rem',
                  border: '1px solid #1a3a1a', color: '#2a5a2a',
                  fontSize: '0.72rem', textDecoration: 'none',
                  letterSpacing: '0.1em', textAlign: 'center',
                }}
              >
                View Profile Page ↗
              </a>
            </div>
          )}

          {/* Key display */}
          <div style={{ background: '#000', border: '1px solid #1a3a1a',
                        padding: '0.75rem', marginBottom: '1.5rem',
                        wordBreak: 'break-all', textAlign: 'left' }}>
            <p style={{ color: '#444', fontSize: '0.6rem', textTransform: 'uppercase',
                        letterSpacing: '.1em', marginBottom: '0.4rem' }}>
              Node Key
            </p>
            <code style={{ color: '#00ff41', fontSize: '0.72rem', lineHeight: 1.6 }}>
              {nodeKey}
            </code>
          </div>

          {/* Actions */}
          {nodeOnline ? (
            <div>
              {status === '' && (
                <button onClick={addFriend} style={{
                  width: '100%', padding: '0.75rem',
                  background: '#00ff41', color: '#000',
                  border: 'none', fontFamily: 'monospace',
                  fontSize: '0.9rem', fontWeight: 'bold',
                  cursor: 'pointer', letterSpacing: '.1em',
                  textTransform: 'uppercase', marginBottom: '0.75rem',
                }}>
                  + Add as Friend
                </button>
              )}
              {status === 'adding' && (
                <p style={{ color: '#00ff41', marginBottom: '0.75rem' }}>Adding…</p>
              )}
              {status === 'done' && (
                <p style={{ color: '#00ff41', marginBottom: '0.75rem' }}>
                  ✓ Added! Open your Vibeport to sync their profile.
                </p>
              )}
              {status.startsWith('error') && (
                <p style={{ color: '#ff4040', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                  {status.replace('error:', '')}
                </p>
              )}
              <p style={{ color: '#333', fontSize: '0.72rem' }}>
                Your Vibeport node is running at localhost:7331
              </p>
            </div>
          ) : (
            <div>
              <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: '1rem' }}>
                You need Vibeport to add this person as a friend.
              </p>
              <a href={RELEASES} target="_blank" rel="noreferrer" style={{
                display: 'block', padding: '0.75rem',
                background: '#00ff41', color: '#000',
                fontFamily: 'monospace', fontSize: '0.85rem',
                fontWeight: 'bold', textDecoration: 'none',
                textTransform: 'uppercase', letterSpacing: '.1em',
                marginBottom: '0.75rem',
              }}>
                Download Vibeport →
              </a>
              <p style={{ color: '#333', fontSize: '0.7rem', lineHeight: 1.6 }}>
                After installing, go to <strong style={{ color: '#00cc33' }}>Friends</strong>{' '}
                and paste this key to add them.
              </p>
            </div>
          )}

          {/* Copy buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button onClick={copyKey} style={{
              flex: 1, padding: '0.5rem', background: 'transparent',
              border: '1px solid #1a3a1a', color: '#00ff41',
              fontFamily: 'monospace', fontSize: '0.72rem', cursor: 'pointer',
            }}>
              {copied ? '✓ Copied' : 'Copy Key'}
            </button>
            <button onClick={copyLink} style={{
              flex: 1, padding: '0.5rem', background: 'transparent',
              border: '1px solid #1a3a1a', color: '#00ff41',
              fontFamily: 'monospace', fontSize: '0.72rem', cursor: 'pointer',
            }}>
              Copy Link
            </button>
          </div>
        </div>

        {/* Short display */}
        <p style={{ color: '#1a3a1a', fontSize: '0.65rem', marginTop: '1.5rem',
                    letterSpacing: '.1em' }}>
          {SITE_BASE}/<span style={{ color: '#2a4a2a' }}>{short}</span>
        </p>

        <a href="/" style={{ color: '#333', fontSize: '0.65rem', marginTop: '1rem',
                              textDecoration: 'none', letterSpacing: '.1em' }}>
          ← What is Vibeport?
        </a>
      </div>
    </div>
  )
}
