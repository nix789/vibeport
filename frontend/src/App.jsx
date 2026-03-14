import { useState, useMemo } from 'react'
import { LandingPage } from './components/LandingPage'
import { ProfileEditor } from './components/ProfileEditor'
import { ProfileView } from './components/ProfileView'
import { RippleBackground } from './components/RippleBackground'
import { Feed } from './components/Feed'
import { Friends } from './components/Friends'
import { Stickers } from './components/Stickers'
import { Webrings } from './components/Webrings'
import { ThemeEngine } from './components/ThemeEngine'
import { P2PStatus } from './components/P2PStatus'
import { Discover } from './components/Discover'
import { Vibes } from './components/Vibes'
import { SharePage } from './components/SharePage'
import { Messages } from './components/Messages'
import './App.css'

const TABS = ['Profile', 'Bulletin', 'Friends', 'Messages', 'Stickers', 'Webrings', 'Discover', 'Vibes', 'Theme', 'Node']
const LANDING_KEY = 'vibeport_entered'
const SITE_BASE   = 'https://vibeport.nixdata.net'

export default function App() {
  const [entered, setEntered] = useState(() => !!localStorage.getItem(LANDING_KEY))
  const [tab, setTab] = useState('Profile')

  // If someone visited /NODEKEY, show the public share page
  const sharedKey = useMemo(() => {
    const k = new URLSearchParams(window.location.search).get('nodekey') ?? ''
    return /^[0-9a-f]{64}$/i.test(k) ? k.toLowerCase() : null
  }, [])

  if (sharedKey) return <SharePage nodeKey={sharedKey} />

  const enter = () => {
    localStorage.setItem(LANDING_KEY, '1')
    setEntered(true)
  }

  if (!entered) {
    return <LandingPage onEnterApp={enter} />
  }

  return (
    <div className="app" style={{ position: 'relative', zIndex: 1 }}>
      <RippleBackground />
      <header className="app-header">
        <h1 className="app-logo">Vibeport</h1>
        <p className="app-tagline">your port · your vibe · your people</p>
        <nav className="app-tabs">
          {TABS.map(t => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
          <button
            className="tab-btn"
            style={{ marginLeft: 'auto', color: '#555' }}
            onClick={() => { localStorage.removeItem(LANDING_KEY); setEntered(false) }}
          >
            ← Landing
          </button>
        </nav>
      </header>

      <main className="app-main">
        {tab === 'Profile'   && <><ProfileView /><ProfileEditor /></>}
        {tab === 'Bulletin'  && <Feed />}
        {tab === 'Friends'   && <Friends />}
        {tab === 'Stickers'  && <Stickers />}
        {tab === 'Webrings'  && <Webrings />}
        {tab === 'Messages'  && <Messages />}
        {tab === 'Discover'  && <Discover />}
        {tab === 'Vibes'     && <Vibes />}
        {tab === 'Theme'     && <ThemeEngine />}
        {tab === 'Node'      && <P2PStatus />}
      </main>

      <footer className="app-footer">
        no ads · no algorithm · no metrics · your data stays here
      </footer>
    </div>
  )
}
