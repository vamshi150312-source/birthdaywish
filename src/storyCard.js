// Renders the story card to a 1080x1920 PNG blob, matching the on-screen layouts.
const W = 1080
const H = 1920
const SANS = '"Poppins", sans-serif'
const SERIF = '"Playfair Display", serif'
const HAND = '"Dancing Script", cursive'

export async function renderStoryCard({ name, wish, signature, theme, layout, photos, active }) {
  await document.fonts?.ready
  const images = await Promise.all(photos.map(p => loadImage(p.url)))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')

  paintBackground(ctx, theme)

  if (!images.length) {
    drawText(ctx, { name, wish, signature, ink: theme.ink, top: 560 })
  } else if (layout === 'full') {
    drawCover(ctx, images[active] || images[0], 0, 0, W, H)
    const shade = ctx.createLinearGradient(0, H * 0.35, 0, H)
    shade.addColorStop(0, 'rgba(0,0,0,0)')
    shade.addColorStop(1, 'rgba(0,0,0,.88)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, W, H)
    drawText(ctx, { name, wish, signature, ink: '#ffffff', bottom: H - 200 })
  } else if (layout === 'polaroid') {
    ctx.save()
    ctx.translate(W / 2, 600)
    ctx.rotate(-0.06)
    ctx.shadowColor = 'rgba(0,0,0,.35)'
    ctx.shadowBlur = 60
    ctx.shadowOffsetY = 24
    ctx.fillStyle = '#fffdf7'
    ctx.fillRect(-370, -440, 740, 870)
    ctx.shadowColor = 'transparent'
    drawCover(ctx, images[active] || images[0], -330, -400, 660, 660)
    ctx.fillStyle = '#2a1d3a'
    ctx.font = `700 76px ${HAND}`
    ctx.textAlign = 'center'
    ctx.fillText(`${name || 'birthday star'} 🎂`, 0, 360)
    ctx.restore()
    drawText(ctx, { name, wish, signature, ink: theme.ink, top: 1130, nameSize: 100, wishSize: 52 })
  } else {
    drawCollage(ctx, images.slice(0, 4))
    drawText(ctx, { name, wish, signature, ink: theme.ink, top: 1080, nameSize: 110, wishSize: 52 })
  }

  ctx.fillStyle = layout === 'full' && images.length ? '#ffffff' : theme.ink
  ctx.globalAlpha = 0.75
  ctx.textAlign = 'center'
  ctx.font = `600 34px ${SANS}`
  ctx.fillText('made with WishPop 🎈', W / 2, H - 90)
  ctx.globalAlpha = 1

  return new Promise((resolve, reject) =>
    c.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'))
}

export function paintBackground(ctx, theme) {
  const [c1, c2, c3] = theme.colors
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, c1)
  bg.addColorStop(0.55, c2)
  bg.addColorStop(1, c3)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  for (const [x, y, r, col] of [[180, 300, 420, c3], [900, 1500, 520, c1], [950, 400, 300, '#ffffff']]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, col + '88')
    g.addColorStop(1, col + '00')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
}

function drawCollage(ctx, images) {
  const x0 = 80, y0 = 110, w = W - 160, h = 900, gap = 20
  const cells = {
    1: [[0, 0, 1, 1]],
    2: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
    3: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
    4: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]]
  }[images.length]
  cells.forEach(([cx, cy, cw, ch], i) => {
    const x = x0 + cx * w + (cx ? gap / 2 : 0)
    const y = y0 + cy * h + (cy ? gap / 2 : 0)
    const ww = cw * w - (cw < 1 ? gap / 2 : 0)
    const hh = ch * h - (ch < 1 ? gap / 2 : 0)
    ctx.save()
    roundRect(ctx, x, y, ww, hh, 36)
    ctx.clip()
    drawCover(ctx, images[i], x, y, ww, hh)
    ctx.restore()
  })
}

function drawText(ctx, { name, wish, signature, ink, top, bottom, nameSize = 160, wishSize = 60 }) {
  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  const lineH = Math.round(wishSize * 1.36)

  let size = nameSize
  ctx.font = `800 ${size}px ${SANS}`
  while (ctx.measureText(name).width > W - 160 && size > 64) {
    size -= 6
    ctx.font = `800 ${size}px ${SANS}`
  }
  ctx.font = `italic ${wishSize}px ${SERIF}`
  const lines = wish ? wrapText(ctx, wish, W - 200) : []
  const signH = signature ? 110 : 0
  const block = 60 + size + 50 + lines.length * lineH + signH
  let y = top ?? bottom - block

  ctx.font = `700 40px ${SANS}`
  ctx.globalAlpha = 0.9
  ctx.fillText('H A P P Y   B I R T H D A Y', W / 2, y + 40)
  ctx.globalAlpha = 1
  y += 60 + size
  ctx.font = `800 ${size}px ${SANS}`
  ctx.fillText(name, W / 2, y)
  y += 40 + lineH
  ctx.font = `italic ${wishSize}px ${SERIF}`
  for (const line of lines) {
    ctx.fillText(line, W / 2, y)
    y += lineH
  }
  if (signature) {
    ctx.font = `700 ${Math.round(wishSize * 1.2)}px ${HAND}`
    ctx.fillText(`— ${signature} 💖`, W / 2, y + 40)
  }
}

export function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale, sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function wrapText(ctx, text, maxWidth) {
  const lines = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
