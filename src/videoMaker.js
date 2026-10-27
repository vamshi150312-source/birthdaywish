// Records a 1080x1920 birthday reel from the photos: animated intro, Ken Burns photo slides with captions,
// and a finale with the wish — with the chosen music mixed in. Uses canvas.captureStream + MediaRecorder.
import { paintBackground, drawCover, roundRect, wrapText, loadImage } from './storyCard.js'
import { startBirthdaySong, TRACKS } from './music.js'

const W = 1080
const H = 1920
const FPS = 30
const SANS = '"Poppins", sans-serif'
const SERIF = '"Playfair Display", serif'
const HAND = '"Dancing Script", cursive'

const INTRO = 3.5
const PHOTO = 3.4
const FADE = 0.3 // short, snappy cuts like reels; a white flash + glitch hides the seam
const OUTRO = 8

const CAPTIONS = ['core memory 🧠', 'cousins forever 🤞', 'this one though 😂', 'family’s favourite 💖', 'iconic, as always 👑',
  'never changing 🫶', 'look at you ✨', 'partners in crime 😎']

const MIME_TYPES = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']

export function pickVideoMime() {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null
  return MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || null
}

export function videoDuration(photoCount) {
  return INTRO + photoCount * PHOTO + OUTRO
}

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const easeOut = x => 1 - (1 - x) ** 3
const easeBack = x => (x <= 0 ? 0 : 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2)

function splitSentences(text) {
  const parts = text.match(/[^.!?]+(?:[.!?]+|$)(?:\s*[\p{Extended_Pictographic}️‍]+)*/gu) || [text]
  return parts.map(s => s.trim()).filter(s => s && s.length <= 90)
}

export async function recordBirthdayVideo({ name, wish, signature, theme, photos, track, songFile, onProgress, signal }) {
  const mimeType = pickVideoMime()
  if (!mimeType) throw new Error('This browser can’t record video. Try Chrome on your phone or computer.')
  await Promise.all([`800 100px ${SANS}`, `italic 60px ${SERIF}`, `700 60px ${HAND}`].map(f => document.fonts?.load(f).catch(() => {})))
  const images = await Promise.all(photos.map(p => loadImage(p.url)))

  const wishLines = splitSentences(wish)
  const captions = images.map((_, i) => wishLines[i] || CAPTIONS[i % CAPTIONS.length])
  const total = videoDuration(images.length)
  // Effects pulse on the music's beat; for the user's own song we can't know the tempo, so assume ~120 BPM
  const beat = songFile ? 0.5 : (TRACKS.find(tr => tr.id === track) || TRACKS[0]).beat
  const confetti = Array.from({ length: 90 }, (_, i) => ({
    x: Math.random() * W, y: Math.random() * H, speed: 140 + Math.random() * 220, size: 12 + Math.random() * 16,
    spin: (Math.random() - 0.5) * 6, sway: Math.random() * Math.PI * 2, color: [...theme.colors, '#ffffff', '#facc15'][i % 5]
  }))

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const draw = t => drawFrame(ctx, t, { name, wish, signature, theme, images, captions, confetti, total, beat })
  draw(0)

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const audio = new AudioCtx()
  const destination = audio.createMediaStreamDestination()
  const music = startBirthdaySong({ track, songFile, ctx: audio, destination })
  await music.ready

  const stream = canvas.captureStream(FPS)
  destination.stream.getAudioTracks().forEach(tr => stream.addTrack(tr))
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 })
  const chunks = []
  recorder.ondataavailable = e => e.data.size && chunks.push(e.data)
  const finished = new Promise(resolve => { recorder.onstop = resolve })

  recorder.start(1000)
  const start = performance.now()
  let fading = false
  await new Promise(resolve => {
    function tick() {
      const t = (performance.now() - start) / 1000
      if (signal?.aborted || t >= total) { resolve(); return }
      draw(t)
      onProgress?.(t / total)
      if (!fading && t > total - 1.5) { fading = true; music.fadeOut(1.5) }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  draw(total)
  recorder.stop()
  await finished
  music.stop()
  stream.getTracks().forEach(tr => tr.stop())
  audio.close()
  if (signal?.aborted) return null

  const type = mimeType.split(';')[0]
  return { blob: new Blob(chunks, { type }), extension: type === 'video/mp4' ? 'mp4' : 'webm' }
}

function drawFrame(ctx, t, data) {
  const { images, total } = data
  const photoStart = i => INTRO + i * PHOTO
  const outroStart = photoStart(images.length)

  // Each layer fades in over the previous one; start drawing from the last fully opaque layer
  const layers = [{ start: 0, draw: () => drawIntro(ctx, t, data) }]
  images.forEach((img, i) => layers.push({ start: photoStart(i), draw: a => drawPhoto(ctx, t - photoStart(i), i, a, data) }))
  layers.push({ start: outroStart, draw: a => drawOutro(ctx, t - outroStart, a, data) })

  const visible = layers.filter(l => l.start <= t)
  let first = 0
  visible.forEach((l, i) => { if (t - l.start >= FADE) first = i })
  for (const layer of visible.slice(first)) {
    const alpha = layer.start === 0 ? 1 : clamp((t - layer.start) / FADE)
    ctx.globalAlpha = alpha
    layer.draw(alpha)
    ctx.globalAlpha = 1
  }

  drawConfetti(ctx, t, data, t < INTRO + 0.5 || t > outroStart ? 1 : 0.35)

  // Reel transitions on every cut: RGB-split glitch, then a white flash
  const cut = [...images.map((_, i) => photoStart(i)), outroStart].map(c => t - c).find(d => d >= 0 && d < 0.35)
  if (cut !== undefined) {
    if (cut < 0.2) glitch(ctx, t, 1 - cut / 0.2)
    ctx.fillStyle = `rgba(255,255,255,${(1 - cut / 0.35) ** 2 * 0.85})`
    ctx.fillRect(0, 0, W, H)
  }
  if (t > total - 1) {
    ctx.fillStyle = `rgba(0,0,0,${clamp(t - (total - 1)) * 0.6})`
    ctx.fillRect(0, 0, W, H)
  }
}

// Slices of the frame jump sideways and a tinted ghost copy is offset — the classic "glitch" cut
function glitch(ctx, t, strength) {
  const seed = Math.floor(t * 60)
  const rand = k => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x) }
  ctx.save()
  ctx.globalAlpha = 0.35 * strength
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(ctx.canvas, 18 * strength, 0)
  ctx.drawImage(ctx.canvas, -18 * strength, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  for (let k = 0; k < 7; k++) {
    const y = rand(k) * H
    const h = 20 + rand(k + 10) * 120
    const dx = (rand(k + 20) - 0.5) * 160 * strength
    ctx.drawImage(ctx.canvas, 0, y, W, h, dx, y, W, h)
  }
  ctx.restore()
}

// A warm light leak drifting across the frame
function lightLeak(ctx, lt, i) {
  const x = (i % 2 ? W : 0) + (i % 2 ? -1 : 1) * lt * 260
  const g = ctx.createRadialGradient(x, H * (0.25 + (i % 3) * 0.2), 0, x, H * 0.4, 900)
  g.addColorStop(0, 'rgba(255,170,90,.38)')
  g.addColorStop(0.5, 'rgba(255,80,150,.14)')
  g.addColorStop(1, 'rgba(255,80,150,0)')
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

function shadowText(ctx, text, x, y, blur = 24) {
  ctx.shadowColor = 'rgba(0,0,0,.55)'
  ctx.shadowBlur = blur
  ctx.fillText(text, x, y)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}

function fitFont(ctx, text, weight, size, family, maxWidth) {
  ctx.font = `${weight} ${size}px ${family}`
  while (ctx.measureText(text).width > maxWidth && size > 40) {
    size -= 4
    ctx.font = `${weight} ${size}px ${family}`
  }
  return size
}

function drawIntro(ctx, t, { name, theme, images }) {
  paintBackground(ctx, theme)
  const ink = theme.ink
  ctx.textAlign = 'center'
  ctx.fillStyle = ink

  // Cover photo in a glowing ring
  if (images[0]) {
    const p = easeBack(clamp(t / 0.9))
    const r = Math.max(0, 250 * p)
    ctx.save()
    ctx.translate(W / 2, 640)
    ctx.rotate(Math.sin(t * 1.4) * 0.04)
    ctx.shadowColor = theme.colors[1]
    ctx.shadowBlur = 80
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(0, 0, r + 16, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.clip()
    drawCover(ctx, images[0], -r, -r, r * 2, r * 2)
    ctx.restore()
  } else {
    ctx.font = `200px ${SANS}`
    ctx.fillText('🎂', W / 2, 700 + Math.sin(t * 3) * 20)
  }

  ctx.fillStyle = ink
  ctx.globalAlpha *= clamp((t - 0.5) / 0.6)
  ctx.font = `700 46px ${SANS}`
  shadowText(ctx, 'H A P P Y   B I R T H D A Y', W / 2, 1060, 12)
  ctx.globalAlpha = 1

  const s = easeBack(clamp((t - 0.9) / 0.8))
  if (s > 0) {
    ctx.save()
    ctx.translate(W / 2, 1230)
    ctx.scale(s, s)
    fitFont(ctx, name, 800, 190, SANS, W - 140)
    shadowText(ctx, name, 0, 0)
    ctx.restore()
  }

  ctx.globalAlpha = clamp((t - 1.9) / 0.6)
  ctx.font = `700 84px ${HAND}`
  shadowText(ctx, 'my favourite cousin 💖', W / 2, 1390 + (1 - easeOut(clamp((t - 1.9) / 0.6))) * 40, 12)
  ctx.globalAlpha = 1
}

function drawPhoto(ctx, lt, i, alpha, { images, captions, name, beat }) {
  const img = images[i]
  const p = clamp(lt / (PHOTO + FADE))
  const zoomIn = i % 2 === 0
  // Zoom punch on the cut, then a small bump on every beat (the "beat sync" reels use)
  const punch = Math.max(0, 1 - lt / 0.4) ** 2 * 0.25
  const pulse = Math.exp(-((lt % beat) / beat) * 7) * 0.03
  const scale = (zoomIn ? 1.04 + 0.14 * p : 1.18 - 0.14 * p) + punch + pulse
  const dir = i % 4 < 2 ? 1 : -1
  const portrait = img.height / img.width >= 1.2

  ctx.save()
  ctx.translate(Math.sin(lt * 97) * pulse * 260, Math.cos(lt * 83) * pulse * 200)
  if (portrait) {
    // Tall photos fill the screen with a slow zoom and drift
    ctx.translate(W / 2 + dir * (p - 0.5) * 60, H / 2)
    ctx.scale(scale, scale)
    drawCover(ctx, img, -W / 2, -H / 2, W, H)
  } else {
    // Wide/square photos: blurred copy behind a tilted framed print so faces aren't cropped off
    ctx.filter = 'blur(40px) brightness(.6)'
    drawCover(ctx, img, -60, -60, W + 120, H + 120)
    ctx.filter = 'none'
    const fw = W - 120
    const fh = Math.min(H * 0.62, fw * img.height / img.width)
    ctx.translate(W / 2, H * 0.44)
    ctx.rotate(dir * (0.035 - p * 0.05))
    ctx.scale(0.94 + 0.08 * p + punch + pulse, 0.94 + 0.08 * p + punch + pulse)
    ctx.shadowColor = 'rgba(0,0,0,.5)'
    ctx.shadowBlur = 60
    ctx.fillStyle = '#fffdf7'
    ctx.fillRect(-fw / 2 - 22, -fh / 2 - 22, fw + 44, fh + 44)
    ctx.shadowColor = 'transparent'
    drawCover(ctx, img, -fw / 2, -fh / 2, fw, fh)
  }
  ctx.restore()

  lightLeak(ctx, lt, i)

  // Shading so the text stays readable on any photo
  const top = ctx.createLinearGradient(0, 0, 0, 360)
  top.addColorStop(0, 'rgba(0,0,0,.55)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 360)
  const bottom = ctx.createLinearGradient(0, H * 0.6, 0, H)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(1, 'rgba(0,0,0,.8)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, H * 0.6, W, H * 0.4)

  // Story progress bars
  const n = images.length
  const gap = 12, bw = (W - 80 - gap * (n - 1)) / n
  for (let b = 0; b < n; b++) {
    const x = 40 + b * (bw + gap)
    ctx.fillStyle = 'rgba(255,255,255,.35)'
    roundRect(ctx, x, 60, bw, 8, 4)
    ctx.fill()
    const fill = b < i ? 1 : b === i ? clamp(lt / PHOTO) : 0
    if (fill) {
      ctx.fillStyle = '#ffffff'
      roundRect(ctx, x, 60, bw * fill, 8, 4)
      ctx.fill()
    }
  }
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.font = `700 44px ${SANS}`
  shadowText(ctx, `🎂 ${name}’s birthday`, 50, 150, 12)

  // Kinetic caption: words pop in one by one, like reel text stickers
  const size = captions[i].length > 40 ? 62 : 86
  ctx.font = `700 ${size}px ${HAND}`
  ctx.textAlign = 'left'
  const lines = wrapText(ctx, captions[i], W - 160)
  const lh = size * 1.18
  const baseY = H - 330 - ((lines.length - 1) / 2) * lh + Math.sin(lt * 2) * 6
  const space = ctx.measureText(' ').width
  let wi = 0
  lines.forEach((line, k) => {
    const words = line.split(' ')
    let x = W / 2 - ctx.measureText(line).width / 2
    for (const word of words) {
      const wt = (lt - 0.3 - wi * 0.13) / 0.35
      const ww = ctx.measureText(word).width
      if (wt > 0) {
        const sc = easeBack(clamp(wt))
        ctx.save()
        ctx.globalAlpha = alpha * clamp(wt * 2)
        ctx.translate(x + ww / 2, baseY + k * lh)
        ctx.scale(sc, sc)
        ctx.rotate((1 - clamp(wt)) * (wi % 2 ? 0.2 : -0.2))
        ctx.fillStyle = wi % 4 === 3 ? '#fde047' : '#ffffff'
        shadowText(ctx, word, -ww / 2, 0)
        ctx.restore()
      }
      x += ww + space
      wi++
    }
  })
}

function drawOutro(ctx, lt, a, { name, wish, signature, theme, images }) {
  paintBackground(ctx, theme)
  const ink = theme.ink
  ctx.textAlign = 'center'

  // Up to four prints fly in and settle in a fan
  const shown = images.slice(0, 4)
  shown.forEach((img, k) => {
    const p = easeBack(clamp((lt - k * 0.18) / 0.7))
    if (p <= 0) return
    const spread = shown.length > 1 ? k / (shown.length - 1) - 0.5 : 0
    ctx.save()
    ctx.translate(W / 2 + spread * 560, 470 + Math.abs(spread) * 70 + (1 - p) * 500)
    ctx.rotate(spread * 0.45 + Math.sin(lt * 1.5 + k) * 0.015)
    ctx.scale(p, p)
    ctx.shadowColor = 'rgba(0,0,0,.4)'
    ctx.shadowBlur = 40
    ctx.fillStyle = '#fffdf7'
    ctx.fillRect(-190, -230, 380, 450)
    ctx.shadowColor = 'transparent'
    drawCover(ctx, img, -165, -205, 330, 330)
    ctx.restore()
  })

  const top = shown.length ? 860 : 620
  ctx.fillStyle = ink
  ctx.globalAlpha = a * clamp((lt - 0.6) / 0.5)
  ctx.font = `700 44px ${SANS}`
  shadowText(ctx, 'H A P P Y   B I R T H D A Y', W / 2, top, 10)
  const size = fitFont(ctx, name, 800, 150, SANS, W - 140)
  shadowText(ctx, name, W / 2, top + 30 + size)
  ctx.globalAlpha = a

  // Typewriter wish
  ctx.font = `italic 54px ${SERIF}`
  const chars = Array.from(wish)
  const shownText = chars.slice(0, Math.floor(clamp((lt - 1.2) / 4) * chars.length)).join('')
  const lines = shownText ? wrapText(ctx, shownText, W - 180) : []
  let y = top + size + 130
  for (const line of lines.slice(0, 8)) {
    shadowText(ctx, line, W / 2, y, 8)
    y += 74
  }

  if (signature) {
    ctx.globalAlpha = a * clamp((lt - 5.4) / 0.6)
    ctx.font = `700 70px ${HAND}`
    shadowText(ctx, `— ${signature} 💖`, W / 2, y + 60, 10)
    ctx.globalAlpha = a
  }
}

function drawConfetti(ctx, t, { confetti }, strength) {
  ctx.save()
  ctx.globalAlpha = strength
  for (const c of confetti) {
    const y = (c.y + c.speed * t) % (H + 60) - 30
    const x = c.x + Math.sin(t * 2 + c.sway) * 30
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(c.spin * t)
    ctx.fillStyle = c.color
    ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2)
    ctx.restore()
  }
  ctx.restore()
}
