/**
 * NodeInit.jsx
 * Simulates the P2P "node initialization" onboarding flow.
 * Replaces "Sign Up" with a visual Port handshake sequence.
 */

import { useState, useEffect } from 'react'

const STEPS = [
  { id: 'keygen',    label: 'Generating Ed25519 keypair...', duration: 900  },
  { id: 'dht',       label: 'Joining DHT swarm...',          duration: 1100 },
  { id: 'announce',  label: 'Announcing your Port...',        duration: 800  },
  { id: 'peers',     label: 'Scanning local neighborhood...', duration: 1200 },
  { id: 'ready',     label: 'Port is open. Welcome home.',    duration: 0    },
]

export function NodeInit({ onComplete }) {
  const [phase, setPhase] = useState('idle') // idle | running | done
  const [stepIdx, setStepIdx] = useState(-1)
  const [nodeKey, setNodeKey] = useState(null)
  const [handle, setHandle] = useState('')
  const [peers, setPeers] = useState(0)

  const start = () => {
    setPhase('running')
    setStepIdx(0)
  }

  // Advance through steps
  useEffect(() => {
    if (phase !== 'running' || stepIdx < 0) return
    if (stepIdx >= STEPS.length) return

    const step = STEPS[stepIdx]
    if (step.duration === 0) {
      // Final step
      setPhase('done')
      // Fetch real node key from backend
      fetch('http://127.0.0.1:7331/api/identity')
        .then(r => r.json())
        .then(d => setNodeKey(d.coreKey))
        .catch(() => setNodeKey('(node not running — start with npm run dev)'))
      return
    }

    // Simulate peer discovery number
    if (step.id === 'peers') {
      const t = setInterval(() => setPeers(p => Math.min(p + Math.floor(Math.random() * 3 + 1), 12)), 150)
      const advance = setTimeout(() => {
        clearInterval(t)
        setStepIdx(i => i + 1)
      }, step.duration)
      return () => { clearInterval(t); clearTimeout(advance) }
    }

    const t = setTimeout(() => setStepIdx(i => i + 1), step.duration)
    return () => clearTimeout(t)
  }, [phase, stepIdx])

  if (phase === 'idle') {
    return (
      <div className="border border-[#2a2a4a] p-8 text-left">
        <p className="text-gray-500 text-sm mb-6">
          No email. No password. No cloud. Your Port is generated locally
          and never transmitted. Click below to begin.
        </p>
        <button
          onClick={start}
          className="w-full bg-[#e94560] hover:bg-[#c73350] text-white py-3 uppercase tracking-widest text-sm transition-colors"
        >
          Initialize My Port
        </button>
      </div>
    )
  }

  if (phase === 'running') {
    return (
      <div className="border border-[#2a2a4a] p-8 text-left font-mono text-sm">
        <p className="text-[#e94560] mb-4 uppercase tracking-widest text-xs">
          Vibeport Node Bootstrap
        </p>
        <div className="space-y-2">
          {STEPS.slice(0, stepIdx + 1).map((step, i) => (
            <div key={step.id} className="flex items-start gap-3">
              <span className={i < stepIdx ? 'text-green-400' : 'text-[#e94560] animate-pulse'}>
                {i < stepIdx ? '✓' : '▶'}
              </span>
              <span className={i < stepIdx ? 'text-gray-500' : 'text-gray-200'}>
                {step.label}
                {step.id === 'peers' && i === stepIdx && (
                  <span className="text-[#7b5ea7] ml-2">{peers} peers found</span>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 h-1 bg-[#2a2a4a] rounded">
          <div
            className="h-1 bg-[#e94560] transition-all duration-300"
            style={{ width: `${(stepIdx / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </div>
    )
  }

  // Done
  return (
    <div className="border border-[#e94560]/40 p-8 text-left">
      <p className="text-green-400 text-xs uppercase tracking-widest mb-4">
        ✓ Port Initialized
      </p>

      <p className="text-gray-400 text-sm mb-4">
        Your public node key (share this with people who want to add you):
      </p>
      <code className="block bg-[#111128] text-[#7b5ea7] text-xs p-3 break-all mb-6">
        {nodeKey ?? 'loading...'}
      </code>

      <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">
        Choose a handle (you can change this anytime)
      </label>
      <input
        value={handle}
        onChange={e => setHandle(e.target.value)}
        maxLength={64}
        placeholder="@yourhandle"
        className="w-full bg-[#111128] border border-[#2a2a4a] text-gray-200 px-3 py-2 text-sm font-mono mb-4 focus:outline-none focus:border-[#7b5ea7]"
      />

      <button
        onClick={onComplete}
        className="w-full bg-[#e94560] hover:bg-[#c73350] text-white py-3 uppercase tracking-widest text-sm transition-colors"
      >
        Enter Vibeport →
      </button>
    </div>
  )
}
