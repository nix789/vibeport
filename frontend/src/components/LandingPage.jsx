/**
 * LandingPage.jsx
 * The "Anti-Platform" landing page for Vibeport.
 * Sections: Hero, Comparison Table, Node Initialization flow.
 */

import { useState } from 'react'
import { NodeInit } from './NodeInit'

export function LandingPage({ onEnterApp }) {
  return (
    <div className="min-h-screen bg-[#000000] text-white font-mono">
      <Hero onEnterApp={onEnterApp} />
      <ComparisonTable />
      <NodeInitSection onEnterApp={onEnterApp} />
      <LandingFooter />
    </div>
  )
}

/* ── Hero ────────────────────────────────────────────────────────────────── */

function Hero({ onEnterApp }) {
  return (
    <section className="relative overflow-hidden px-6 py-24 md:py-36 text-center border-b border-[#1a3a1a]">
      {/* Background grid decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(#00ff41 1px, transparent 1px), linear-gradient(90deg, #00ff41 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative max-w-3xl mx-auto">
        <p className="text-[#00ff41] text-xs tracking-[0.3em] uppercase mb-4">
          The Great Eviction
        </p>

        <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6 tracking-tight">
          Your life is not<br />a dataset.
        </h1>

        <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
          Big Tech built a digital landlord system. They own the servers, they
          manipulate the reach, and they keep the insider payouts.{' '}
          <span className="text-[#00ff41]">Vibeport is the exit.</span>{' '}
          No central servers. No algorithms. Just your Port, your Vibe,
          and your People.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onEnterApp}
            className="bg-[#00ff41] hover:bg-[#00cc33] text-white px-8 py-3 text-sm uppercase tracking-widest transition-colors"
          >
            Open Your Port
          </button>
          <a
            href="#compare"
            className="border border-[#1a3a1a] hover:border-[#00cc33] text-gray-300 hover:text-[#00cc33] px-8 py-3 text-sm uppercase tracking-widest transition-colors"
          >
            Logic Check ↓
          </a>
        </div>

        <div className="mt-12 flex justify-center gap-8 text-xs text-gray-500 uppercase tracking-widest">
          <span>No Email Required</span>
          <span>·</span>
          <span>No Cloud Storage</span>
          <span>·</span>
          <span>No Ads. Ever.</span>
        </div>
      </div>
    </section>
  )
}

/* ── Comparison Table ────────────────────────────────────────────────────── */

const ROWS = [
  {
    them: 'You are the product',
    us:   'You are the owner.',
  },
  {
    them: 'Algorithms decide who sees you',
    us:   'P2P connection — 100% reach.',
  },
  {
    them: 'Bots dominate the "For You" page',
    us:   'Proof-of-Personhood — human-only nodes.',
  },
  {
    them: 'Shadowbanning is a feature',
    us:   'Censorship is technically impossible.',
  },
  {
    them: 'Your data is sold to advertisers',
    us:   'Your data never leaves your device.',
  },
  {
    them: 'Platform can delete your account',
    us:   'Only you can delete your Port.',
  },
]

function ComparisonTable() {
  return (
    <section id="compare" className="px-6 py-20 border-b border-[#1a3a1a]">
      <div className="max-w-4xl mx-auto">
        <p className="text-[#00ff41] text-xs tracking-[0.3em] uppercase mb-3 text-center">
          Logic Check
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
          There is no comparison.
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left py-3 px-4 text-gray-400 uppercase tracking-widest text-xs font-normal border-b border-[#1a3a1a]">
                  X / Instagram / TikTok
                </th>
                <th className="text-left py-3 px-4 text-[#00ff41] uppercase tracking-widest text-xs font-normal border-b border-[#00ff41]/40">
                  Vibeport
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? 'bg-[#0a0a0a]/40' : ''}
                >
                  <td className="py-4 px-4 text-gray-400 border-b border-[#1a3a1a]/50">
                    <span className="inline-block w-4 mr-2 text-red-700">✕</span>
                    {row.them}
                  </td>
                  <td className="py-4 px-4 text-white border-b border-[#1a3a1a]/50">
                    <span className="inline-block w-4 mr-2 text-green-400">✓</span>
                    {row.us}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

/* ── Node Initialization ─────────────────────────────────────────────────── */

function NodeInitSection({ onEnterApp }) {
  return (
    <section id="init" className="px-6 py-20 border-b border-[#1a3a1a]">
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-[#00ff41] text-xs tracking-[0.3em] uppercase mb-3">
          Not a "Sign Up." A Declaration.
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Initialize Your Port
        </h2>
        <p className="text-gray-400 mb-10">
          Instead of giving your data to a server, you become the server.
          This generates a keypair on your device — your permanent identity
          on the network.
        </p>
        <NodeInit onComplete={onEnterApp} />
      </div>
    </section>
  )
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

function LandingFooter() {
  return (
    <footer className="px-6 py-10 text-center text-xs text-gray-600 uppercase tracking-widest">
      <p>Vibeport — A Protocol, Not A Platform</p>
      <p className="mt-2">
        <a href="/TOS.md" className="hover:text-[#00ff41] transition-colors mr-6">Terms of Service</a>
        <a href="/Privacy.md" className="hover:text-[#00ff41] transition-colors">Privacy Policy</a>
      </p>
    </footer>
  )
}
