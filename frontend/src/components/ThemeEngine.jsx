/**
 * ThemeEngine.jsx
 * Allows users to inject raw CSS strings into the app — "Chaos CSS."
 * CSS is scoped to a wrapper div so it doesn't nuke the chrome,
 * but users can still override anything inside their own page area.
 */

import { useState, useEffect, useRef, useId } from 'react'

const STORAGE_KEY = 'vibeport_chaos_css'

const PRESETS = {
  'Default Dark':    '',
  'Hot Pink Chaos':  'body { background: hotpink !important; } h1,h2 { color: lime !important; font-family: "Comic Sans MS", cursive !important; }',
  'Vaporwave':       ':root { --bg: #2d1b69; --surface: #1a0533; --accent: #ff71ce; --accent2: #01cdfe; } body { background: linear-gradient(135deg,#2d1b69,#0a0a2a) !important; }',
  'Terminal Green':  ':root { --bg: #001100; --surface: #001a00; --accent: #00ff41; --accent2: #00cc33; --text: #00ff41; } body { background: #001100 !important; }',
  'Geocities Gold':  'body { background: #000080 !important; color: yellow !important; } h1,h2 { color: gold !important; text-shadow: 2px 2px red; font-family: "Times New Roman", serif !important; }',
}

export function ThemeEngine() {
  const [css, setCSS] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '')
  const [active, setActive] = useState(!!localStorage.getItem(STORAGE_KEY))
  const [preset, setPreset] = useState('Default Dark')
  const styleRef = useRef(null)

  const applyCSS = (raw) => {
    if (!styleRef.current) {
      styleRef.current = document.createElement('style')
      styleRef.current.id = 'vibeport-chaos-css'
      document.head.appendChild(styleRef.current)
    }
    styleRef.current.textContent = raw
    localStorage.setItem(STORAGE_KEY, raw)
    setActive(true)
  }

  // Restore on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) applyCSS(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = () => applyCSS(css)

  const clear = () => {
    if (styleRef.current) styleRef.current.textContent = ''
    localStorage.removeItem(STORAGE_KEY)
    setCSS('')
    setActive(false)
    setPreset('Default Dark')
  }

  const loadPreset = (name) => {
    setPreset(name)
    const raw = PRESETS[name]
    setCSS(raw)
    applyCSS(raw)
  }

  return (
    <section className="theme-engine">
      <h2>Theme Engine</h2>
      <p className="hint">
        Chaos CSS — inject raw CSS into the entire app. No guardrails.
        Your Port, your aesthetic.
      </p>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {Object.keys(PRESETS).map(name => (
          <button
            key={name}
            onClick={() => loadPreset(name)}
            className={`btn-small ${preset === name ? 'active-preset' : ''}`}
            style={preset === name ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
          >
            {name}
          </button>
        ))}
      </div>

      <textarea
        value={css}
        onChange={e => setCSS(e.target.value)}
        rows={10}
        className="code-input"
        placeholder="/* paste any CSS — it applies globally */&#10;body { background: hotpink; }&#10;h1 { animation: spin 2s linear infinite; }"
        style={{ width: '100%', fontFamily: 'monospace' }}
      />

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', alignItems: 'center' }}>
        <button onClick={apply} className="btn-primary">Apply</button>
        <button onClick={clear} className="btn-small">Clear / Reset</button>
        {active && <span className="status">Chaos CSS active</span>}
      </div>
    </section>
  )
}
