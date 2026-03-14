import { useState } from 'react'
import { LandingPage } from './components/LandingPage'
import { ProfileEditor } from './components/ProfileEditor'
import { ProfileView } from './components/ProfileView'
import { Feed } from './components/Feed'
import { Friends } from './components/Friends'
import { Stickers } from './components/Stickers'
import { Webrings } from './components/Webrings'
import { ThemeEngine } from './components/ThemeEngine'
import { P2PStatus } from './components/P2PStatus'
import './App.css'

const TABS = ['Profile', 'Bulletin', 'Friends', 'Stickers', 'Webrings', 'Theme', 'Node']

const LANDING_KEY = 'vibeport_entered'

export default function App() {
  const [entered, setEntered] = useState(() => !!localStorage.getItem(LANDING_KEY))
  const [tab, setTab] = useState('Profile')

  const enter = () => {
    localStorage.setItem(LANDING_KEY, '1')
    setEntered(true)
  }

  if (!entered) {
    return <LandingPage onEnterApp={enter} />
  }

  return (
    <div className="app">
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
        {tab === 'Theme'     && <ThemeEngine />}
        {tab === 'Node'      && <P2PStatus />}
      </main>

      <footer className="app-footer">
        no ads · no algorithm · no metrics · your data stays here
      </footer>
    </div>
  )
}
