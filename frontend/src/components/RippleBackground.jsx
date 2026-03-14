/**
 * RippleBackground.jsx
 * Canvas-based water ripple effect. Green rings on black.
 * Ripples spawn randomly and on mouse/touch.
 */

import { useEffect, useRef } from 'react'

export function RippleBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    let ripples  = []
    let animId

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const spawnRipple = (x, y) => {
      ripples.push({ x, y, r: 0, maxR: 120 + Math.random() * 180, alpha: 0.6, speed: 1.2 + Math.random() * 1.4 })
    }

    // Random ambient ripples
    const ambient = setInterval(() => {
      spawnRipple(Math.random() * canvas.width, Math.random() * canvas.height)
    }, 1200)

    // Mouse ripples
    const onPointer = (e) => {
      const rect = canvas.getBoundingClientRect()
      const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left
      const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top
      spawnRipple(x, y)
    }
    canvas.addEventListener('click', onPointer)
    canvas.addEventListener('touchstart', onPointer, { passive: true })

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ripples = ripples.filter(r => r.alpha > 0.01)

      for (const r of ripples) {
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0, 255, 65, ${r.alpha})`
        ctx.lineWidth   = 1.5
        ctx.stroke()

        // Inner faint ring
        if (r.r > 20) {
          ctx.beginPath()
          ctx.arc(r.x, r.y, r.r * 0.6, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(0, 204, 51, ${r.alpha * 0.3})`
          ctx.lineWidth   = 0.8
          ctx.stroke()
        }

        r.r     += r.speed
        r.alpha *= 0.97
        if (r.r >= r.maxR) r.alpha = 0
      }

      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      clearInterval(ambient)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('click', onPointer)
      canvas.removeEventListener('touchstart', onPointer)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.35,
      }}
    />
  )
}
