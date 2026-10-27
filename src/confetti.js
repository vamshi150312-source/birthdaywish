// One particle system per canvas, so several bursts (e.g. popping balloons quickly) can overlap smoothly.
const systems = new WeakMap()
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function fireConfetti(canvas, colors, { pieces = 180, originX = 0.5, originY = 0.55, power = 1 } = {}) {
  if (!canvas || reducedMotion()) return
  let sys = systems.get(canvas)
  if (!sys) {
    sys = { particles: [], running: false }
    systems.set(canvas, sys)
  }
  const palette = [...colors, '#ffffff', '#fde047']
  for (let i = 0; i < pieces; i++) {
    sys.particles.push({
      x: innerWidth * originX + (Math.random() - 0.5) * 240 * power,
      y: innerHeight * originY,
      vx: (Math.random() - 0.5) * 17 * power,
      vy: (-Math.random() * 17 - 8) * power,
      size: Math.random() * 7 + 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: palette[Math.floor(Math.random() * palette.length)],
      round: Math.random() > 0.6,
      age: 0
    })
  }
  if (sys.running) return

  sys.running = true
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    for (const p of sys.particles) {
      p.vy += 0.38; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.age++
      ctx.save()
      ctx.translate(p.x, p.y); ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill() }
      else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
    sys.particles = sys.particles.filter(p => p.age < 170 && p.y < innerHeight + 40)
    if (sys.particles.length) requestAnimationFrame(tick)
    else { sys.running = false; ctx.clearRect(0, 0, innerWidth, innerHeight) }
  }
  tick()
}
