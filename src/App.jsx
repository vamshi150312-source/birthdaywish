import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Cake, Sparkles, Copy, Share2, RefreshCw, WandSparkles, Download, MessageCircle, Check,
  ImagePlus, Camera, X, ChevronLeft, ChevronRight, Image as ImageIcon, LayoutGrid, Frame, Play, Link2, Lock, Music, Film, Upload
} from 'lucide-react'
import { renderStoryCard } from './storyCard.js'
import { fireConfetti } from './confetti.js'
import Surprise from './Surprise.jsx'
import SurpriseLaunch from './SurpriseLaunch.jsx'
import { THEMES } from './themes.js'
import { createSurpriseLink } from './share.js'
import { TRACKS } from './music.js'
import { recordBirthdayVideo, pickVideoMime, videoDuration } from './videoMaker.js'

const API = '/api/wishes' // proxied to Spring Boot by Vite (see vite.config.js)
const MAX_PHOTOS = 8
const SLIDE_MS = 4000
const NICKNAME = 'Pandu'

const VIBE_META = {
  TRENDING: { emoji: '🔥', hint: 'fun & modern' },
  GEN_Z: { emoji: '💅', hint: 'cool & stylish' },
  BEST_FRIEND: { emoji: '🫂', hint: 'cousin + best friend' },
  FUNNY: { emoji: '😂', hint: 'roast your cousin' },
  LOVE: { emoji: '🏡', hint: 'family feels' },
  ATTITUDE: { emoji: '😎', hint: 'bold & confident' },
  EMOTIONAL: { emoji: '🌸', hint: 'from the heart' }
}

// Used when the backend is not running, so the app still works. First person: you → them.
const FALLBACK_STYLES = [
  { id: 'TRENDING', label: 'Trending ✨' }, { id: 'GEN_Z', label: 'Gen Z 💅' },
  { id: 'BEST_FRIEND', label: 'Cousin Bestie 🫂' }, { id: 'FUNNY', label: 'Funny 😂' },
  { id: 'LOVE', label: 'Family Love 🏡' }, { id: 'ATTITUDE', label: 'Attitude 😎' }, { id: 'EMOTIONAL', label: 'Emotional 🌸' }
]
const FALLBACK_WISHES = {
  TRENDING: ['Happy Birthday, %s! 🎉 This is officially your main character era, and as your cousin I’m here to hype you up all year. 👑✨', 'Another level unlocked, %s! 🎮🔥 I’m so proud of the person my cousin has become.'],
  GEN_Z: ['HBD %s!! 🎂 Not gonna lie, you’re literally the most iconic cousin in the family, no cap. 🧢💅', 'Happy Birthday %s! 💫 Your aura is +1000 and I’m just happy we share the same family tree.'],
  BEST_FRIEND: ['Happy Birthday, %s! 🫶 Cousin by birth, best friend by choice. Thank you for every laugh and every time you had my back.', 'Happy Birthday to my favourite cousin, %s! 🫂 Family made us cousins, but all the fun we’ve had made us best friends.'],
  FUNNY: ['%s, you’re not old — you’re vintage. 🍷 Lucky for you, good taste runs in our family. Happy Birthday! 🎉', 'Happy Birthday, %s! 🍰 I got you the best gift ever: me, as your cousin. You’re welcome. 😜'],
  LOVE: ['Happy Birthday, %s! 🏡❤️ Becoming this close to you is one of the best things that ever happened to me.', '%s, you make every family moment feel brighter. 🌷 Happy Birthday, cousin!'],
  ATTITUDE: ['Happy Birthday, %s! 👑🔥 Our family’s very own superstar. Stay unstoppable, cousin.', '%s, rare energy, big dreams, unmatched vibe — that’s my cousin. 😎⚡ Happy Birthday!'],
  EMOTIONAL: ['%s, I’m so thankful you were born and that I got you as my cousin. ❤️ May this year bring you peace, love and every dream you hold close.', 'Happy Birthday, %s. 🌸 I hope life gives you countless reasons to smile, because you give our whole family so many.']
}

const SIGNOFFS = ['Your favourite cousin', 'With love, your cousin', 'Big hugs', 'Love you always', 'Cheers']

const HERO_CARDS = ['🥳', '🎂', '🎁', '💖']
const HERO_BALLOONS = Array.from({ length: 12 }, (_, i) => ({
  x: (i * 83 + 7) % 100, d: 9 + (i % 5) * 1.6, delay: -(i * 1.7), s: 0.7 + (i % 4) * 0.15,
  c: ['#ff4fa3', '#facc15', '#a78bfa', '#fb923c', '#22d3ee', '#f472b6'][i % 6]
}))

const LAYOUTS = [
  { id: 'full', name: 'Full photo', icon: ImageIcon },
  { id: 'polaroid', name: 'Polaroid', icon: Frame },
  { id: 'collage', name: 'Collage', icon: LayoutGrid }
]

const TRENDS = ['Happy Birthday Pandu 🎂', 'cousins forever 🤞', 'family’s favourite 💖', 'partners in crime 😎', 'more than cousins 🤝', 'best cousin ever 🏆', 'cake time 🍰', 'party mode 🥳', 'love you always 💕']

// crypto.randomUUID only exists on https/localhost; this works when opened over Wi-Fi too
const makeId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function App() {
  const [name, setName] = useState('Niharika')
  const [fromName, setFromName] = useState('Sujeeth')
  const [signoff, setSignoff] = useState(SIGNOFFS[0])
  const [style, setStyle] = useState('TRENDING')
  const [styles, setStyles] = useState(FALLBACK_STYLES)
  const [offline, setOffline] = useState(false)
  const [theme, setTheme] = useState(THEMES[0])
  const [layout, setLayout] = useState('full')
  const [bgId, setBgId] = useState(null)
  const [unlockDate, setUnlockDate] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')
  const [photos, setPhotos] = useState([])
  const [active, setActive] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [wish, setWish] = useState('')
  const [typed, setTyped] = useState('')
  const [typing, setTyping] = useState(false)
  const [revealKey, setRevealKey] = useState(0)
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [playing, setPlaying] = useState(false)
  const [track, setTrack] = useState(TRACKS[0].id)
  const [songFile, setSongFile] = useState(null)
  const [videoProgress, setVideoProgress] = useState(null)
  const [video, setVideo] = useState(null)
  const videoAbortRef = useRef(null)
  const songRef = useRef(null)
  const [hearts, setHearts] = useState([])
  const [likes, setLikes] = useState(24)
  const [liked, setLiked] = useState(false)
  const lastTapRef = useRef(0)

  // Reels-style double-tap: a heart bursts where you tapped (double-click on desktop, double-tap on phones)
  function likeReel(e) {
    const box = e.currentTarget.getBoundingClientRect()
    const id = makeId()
    setHearts(h => [...h, { id, x: e.clientX - box.left, y: e.clientY - box.top, r: Math.round(Math.random() * 40 - 20) }])
    setTimeout(() => setHearts(h => h.filter(x => x.id !== id)), 1100)
    setLikes(n => n + 1)
    setLiked(true)
  }
  function tapReel(e) {
    if (e.pointerType !== 'touch') return
    const now = Date.now()
    if (now - lastTapRef.current < 320) likeReel(e)
    lastTapRef.current = now
  }

  // Sections slide up into view as you scroll
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return }
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target) }
    }), { threshold: 0.12 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
  const [launch, setLaunch] = useState(null)

  // The surprise is its own "page" at #surprise, so the phone's Back button closes it
  function openSurprise() {
    if (!history.state?.surprise) history.pushState({ surprise: true }, '', '#surprise')
    setPlaying(true)
  }
  const closeSurprise = useCallback(() => {
    if (history.state?.surprise) history.back()
    else setPlaying(false)
  }, [])
  const cancelLaunch = useCallback(() => setLaunch(null), [])
  useEffect(() => {
    if (location.hash === '#surprise') history.replaceState(null, '', location.pathname + location.search)
    const onPop = () => setPlaying(Boolean(history.state?.surprise))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const confettiRef = useRef(null)
  const fileRef = useRef(null)
  const cameraRef = useRef(null)
  const photosRef = useRef(photos)
  photosRef.current = photos
  const wishRef = useRef(wish)
  wishRef.current = wish

  useEffect(() => {
    fetch(`${API}/styles`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setStyles)
      .catch(() => setOffline(true))
  }, [])

  // Free object URLs when the app unmounts
  useEffect(() => () => photosRef.current.forEach(p => URL.revokeObjectURL(p.url)), [])

  // Typewriter reveal only for generated wishes (not while the user is typing their own)
  useEffect(() => {
    if (!revealKey || reducedMotion()) return
    const chars = Array.from(wishRef.current)
    let i = 0
    setTyped('')
    setTyping(true)
    const timer = setInterval(() => {
      i += 1
      setTyped(chars.slice(0, i).join(''))
      if (i >= chars.length) { clearInterval(timer); setTyping(false) }
    }, 22)
    return () => clearInterval(timer)
  }, [revealKey])

  // Story-style auto slideshow through the photos
  const slideshow = photos.length > 1 && layout !== 'collage'
  useEffect(() => {
    if (!slideshow) return
    const t = setTimeout(() => setActive(a => (a + 1) % photos.length), SLIDE_MS)
    return () => clearTimeout(t)
  }, [slideshow, active, photos.length])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 2600)
    return () => clearTimeout(t)
  }, [notice])

  function addFiles(fileList) {
    const images = Array.from(fileList || []).filter(f => f.type.startsWith('image/'))
    if (!images.length) return
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) { setNotice(`Max ${MAX_PHOTOS} photos — remove one first.`); return }
    const added = images.slice(0, room).map(file => ({ id: makeId(), file, url: URL.createObjectURL(file) }))
    setPhotos(prev => [...prev, ...added])
    setActive(photos.length)
    if (images.length > room) setNotice(`Only ${room} more photo${room > 1 ? 's' : ''} fit — max is ${MAX_PHOTOS}.`)
    else setNotice(`${added.length} photo${added.length > 1 ? 's' : ''} added 📸`)
  }

  function removePhoto(id) {
    const index = photos.findIndex(p => p.id === id)
    URL.revokeObjectURL(photos[index].url)
    const next = photos.filter(p => p.id !== id)
    setPhotos(next)
    setActive(a => Math.max(0, Math.min(a > index ? a - 1 : a, next.length - 1)))
  }

  function makeCover(id) {
    const index = photos.findIndex(p => p.id === id)
    setPhotos([photos[index], ...photos.filter(p => p.id !== id)])
    setActive(0)
  }

  function step(delta) {
    if (photos.length < 2) return
    setActive(a => (a + delta + photos.length) % photos.length)
  }

  function pickWish(text, celebrate = true) {
    setWish(text)
    setRevealKey(k => k + 1)
    if (celebrate) fireConfetti(confettiRef.current, theme.colors)
  }

  // Ready-made wishes load automatically once a name is typed, and reload when the vibe changes.
  useEffect(() => {
    const person = name.trim()
    if (!person) { setOptions([]); setWish(''); return }
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      let list
      try {
        const response = await fetch(`${API}/options?name=${encodeURIComponent(person)}&style=${style}`)
        if (!response.ok) throw new Error()
        list = await response.json()
        setOffline(false)
      } catch (e) {
        if (e instanceof TypeError) setOffline(true)
        list = (FALLBACK_WISHES[style] || FALLBACK_WISHES.TRENDING).map(w => w.replace('%s', person))
      }
      if (cancelled) return
      setLoading(false)
      setOptions(list)
      pickWish(list[0], false)
    }, 450)
    return () => { cancelled = true; clearTimeout(t) }
  }, [name, style])

  // Picks a random wish, plays the slot-machine reveal + countdown, then opens the full surprise
  function surpriseMe() {
    const others = options.filter(o => o !== wish)
    if (!others.length) return
    const chosen = others[Math.floor(Math.random() * others.length)]
    pickWish(chosen, false)
    setLaunch({ chosen, wishes: [...options].sort(() => Math.random() - 0.5) })
  }

  function finishLaunch() {
    setLaunch(null)
    openSurprise()
  }

  const sender = fromName.trim()
  const signature = sender ? `${signoff}, ${sender}` : ''
  const fullMessage = wish.trim() ? (signature ? `${wish.trim()}\n\n— ${signature} 💖` : wish.trim()) : ''

  async function copyWish() {
    if (!fullMessage) return
    try {
      await navigator.clipboard.writeText(fullMessage)
      setNotice(`Copied! Go make ${displayName} smile 💌`)
    } catch {
      setNotice('Copy was blocked — select the text and copy manually.')
    }
  }

  function makeCardBlob() {
    return renderStoryCard({ name: name.trim(), wish: wish.trim(), signature, theme, layout, photos, active })
  }

  async function shareWish() {
    if (!fullMessage) return
    try {
      const file = new File([await makeCardBlob()], 'birthday-card.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: fullMessage })
        return
      }
      if (navigator.share) { await navigator.share({ title: 'Birthday wishes', text: fullMessage }); return }
      await copyWish()
    } catch (e) {
      if (e.name !== 'AbortError') setNotice('Sharing not available. Try Save card instead.')
    }
  }

  function whatsappWish() {
    if (!fullMessage) return
    window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, '_blank', 'noopener')
  }

  async function downloadCard() {
    if (!fullMessage) return
    try {
      const url = URL.createObjectURL(await makeCardBlob())
      const a = document.createElement('a')
      a.href = url
      a.download = `birthday-${name.trim().toLowerCase().replace(/\s+/g, '-') || 'wish'}.png`
      a.click()
      URL.revokeObjectURL(url)
      setNotice('Card saved — now send it with love 💖')
    } catch {
      setNotice('Could not create the image in this browser.')
    }
  }

  const vibe = styles.find(s => s.id === style)
  const hasPhotos = photos.length > 0
  const hasWish = wish.trim().length > 0
  const current = photos[active] || photos[0]
  // Background for the full-screen surprise: the chosen photo, else the cover photo; 'none' means colours only
  const bgPhoto = bgId === 'none' ? null : photos.find(p => p.id === bgId) || photos[0] || null
  const unlockAt = unlockDate ? new Date(`${unlockDate}T00:00`) : null
  const unlockInFuture = unlockAt && unlockAt.getTime() > Date.now()

  // Any change after creating a link makes it stale, so ask for a fresh one
  useEffect(() => { setShareUrl(''); setShareError('') }, [name, wish, signature, photos, bgPhoto, theme, unlockDate])

  async function makeLink() {
    setSharing(true)
    setShareError('')
    try {
      const url = await createSurpriseLink({
        name: displayName, wish: wish.trim(), signature, themeId: theme.id, photos,
        backgroundIndex: bgPhoto ? photos.indexOf(bgPhoto) : null,
        unlockAt: unlockInFuture ? unlockAt.toISOString() : null
      })
      setShareUrl(url)
      fireConfetti(confettiRef.current, theme.colors, { pieces: 90 })
    } catch (e) {
      setShareError(e.message)
    } finally {
      setSharing(false)
    }
  }

  // A new photo, wish or song makes the finished video stale
  useEffect(() => {
    videoAbortRef.current?.abort()
    setVideo(v => { if (v) URL.revokeObjectURL(v.url); return null })
  }, [name, wish, signature, photos, theme, track, songFile])

  function pickSong(fileList) {
    const file = fileList?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg)$/i.test(file.name)) { setNotice('Pick an audio file (MP3, M4A…)'); return }
    setSongFile(file)
    setNotice(`🎵 ${file.name.replace(/\.[^.]+$/, '')} added`)
  }

  async function makeVideo() {
    const controller = new AbortController()
    videoAbortRef.current = controller
    setVideoProgress(0)
    try {
      const result = await recordBirthdayVideo({
        name: displayName, wish: wish.trim(), signature, theme, photos, track, songFile,
        onProgress: setVideoProgress, signal: controller.signal
      })
      if (result) {
        setVideo({ ...result, url: URL.createObjectURL(result.blob) })
        fireConfetti(confettiRef.current, theme.colors, { pieces: 90 })
      }
    } catch (e) {
      setNotice(e.message || 'Could not make the video in this browser.')
    } finally {
      setVideoProgress(null)
    }
  }

  const videoFileName = () => `happy-birthday-${displayName.toLowerCase().replace(/\s+/g, '-')}.${video.extension}`

  function downloadVideo() {
    const a = document.createElement('a')
    a.href = video.url
    a.download = videoFileName()
    a.click()
    setNotice(`Video saved — ${displayName} is going to love this 🎬`)
  }

  async function shareVideo() {
    const file = new File([video.blob], videoFileName(), { type: video.blob.type })
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: fullMessage })
      else downloadVideo()
    } catch (e) {
      if (e.name !== 'AbortError') downloadVideo()
    }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setNotice(`Link copied! Send it to ${displayName} 🎁`) }
    catch { setNotice('Copy blocked — select the link and copy it manually.') }
  }

  function whatsappLink() {
    const text = `🎁 ${displayName}, I made a little birthday surprise for you… open it 👉 ${shareUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }
  const cardLayout = hasPhotos ? layout : 'text'
  const displayName = name.trim() || 'Birthday Star'
  const shownWish = typing ? typed : wish
  const handle = (sender || 'wishpop').toLowerCase().replace(/\s+/g, '_')
  const cardStyle = { '--c1': theme.colors[0], '--c2': theme.colors[1], '--c3': theme.colors[2], '--ink': theme.ink }

  const textBlock = (
    <div className="story-text">
      <span className="story-kicker">HAPPY BIRTHDAY</span>
      <h2 className="story-name">{displayName}</h2>
      {hasWish
        ? <p className="story-wish">{shownWish}{typing && <span className="caret" />}</p>
        : <p className="story-wish placeholder">Your words for {displayName} appear here ✨</p>}
      {signature && <p className="story-sign">— {signature} 💖</p>}
    </div>
  )

  return (
    <>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div className="grain" aria-hidden="true" />
      <canvas ref={confettiRef} className="confetti" aria-hidden="true" />

      <main className="page-shell">
        <nav className="topbar">
          <div className="brand"><span className="brand-icon"><Cake size={18} /></span>{displayName}’s Birthday</div>
          <span className="top-tag"><span className={`live-dot ${offline ? 'off' : ''}`} /> {offline ? 'offline mode' : sender ? `with love from ${sender}` : 'made with love'}</span>
        </nav>

        <section className="reel-hero" onDoubleClick={likeReel} onPointerDown={tapReel}>
          <div className="reel-bg" aria-hidden="true" />
          <div className="balloons" aria-hidden="true">
            {HERO_BALLOONS.map((b, i) => <span key={i} style={{ '--x': `${b.x}%`, '--d': `${b.d}s`, '--delay': `${b.delay}s`, '--c': b.c, '--s': b.s }} />)}
          </div>
          <div className="hero-cards" aria-hidden="true">
            {HERO_CARDS.map((c, i) => (
              <div key={i} className={`hero-card hc${i}`}>
                {photos[i] ? <img src={photos[i].url} alt="" /> : <span>{c}</span>}
              </div>
            ))}
          </div>
          {hearts.map(h => <span key={h.id} className="reel-heart" style={{ left: h.x, top: h.y, '--r': `${h.r}deg` }} aria-hidden="true">❤️</span>)}

          <div className="reel-inner">
            <div className="eyebrow">💌 To my dearest cousin</div>
            <h1 className="kinetic" aria-label={`Happy Birthday, ${displayName}!`}>
              <span className="kin-line" aria-hidden="true">{Array.from('HAPPY BIRTHDAY').map((ch, i) => <span key={i} style={{ '--i': i }}>{ch === ' ' ? ' ' : ch}</span>)}</span>
              <em className="kin-name" key={displayName} aria-hidden="true">{Array.from(displayName).map((ch, i) => <span key={i} style={{ '--i': i }}>{ch === ' ' ? ' ' : ch}</span>)}<span className="kin-pop">🎉</span></em>
            </h1>
            <p className="hero-copy">{NICKNAME}, you’re not just my cousin — you’ve become one of the closest people in my life. Thank you for all the laughter, the long talks and for always being there for me. Today is all about you — and I made this little surprise with all my heart. 💖</p>
            <ol className="hero-steps">
            <li><b>🤝</b><span><strong>More than a cousin</strong><small>A true friend I can always count on</small></span></li>
            <li><b>🏡</b><span><strong>The smile of every family function</strong><small>It’s never the same without you</small></span></li>
            <li><b>💖</b><span><strong>My favourite cousin, always</strong><small>Today and every day after</small></span></li>
            </ol>
            {sender && <p className="hero-sign">— with love, your cousin {sender}</p>}
            <a className="hero-cta" href="#builder" onPointerDown={e => e.stopPropagation()}>Open your birthday wishes <span>↓</span></a>
            <p className="hero-hint">💖 Double-tap anywhere to send {NICKNAME} some love</p>
          </div>

          <div className="reel-rail" aria-hidden="true">
            <span className={liked ? 'liked' : ''}>❤️<small>{likes}</small></span>
            <span>💬<small>{options.length}</small></span>
            <span>🎂<small>{photos.length}</small></span>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[...TRENDS, ...TRENDS].map((t, i) => <span key={i}>{t}</span>)}
          </div>
        </div>

        <section className="workspace" id="builder">
          <form className="glass builder" onSubmit={e => e.preventDefault()}>
            <div className="field reveal">
              <span className="field-label"><span className="step">01</span> Who is this for? 💝</span>
              <div className="name-pair">
                <div className="name-box">
                  <label htmlFor="person-name">To 🎂</label>
                  <input id="person-name" value={name} onChange={e => setName(e.target.value)} placeholder="Their name" maxLength={60} autoComplete="off" />
                </div>
                <span className="name-arrow" aria-hidden="true">💌</span>
                <div className="name-box">
                  <label htmlFor="from-name">From you</label>
                  <input id="from-name" value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Your name" maxLength={40} autoComplete="name" />
                </div>
              </div>
            </div>

            <div className="field reveal">
              <span className="field-label"><span className="step">02</span> Our memories together 📸 <small>{photos.length}/{MAX_PHOTOS}</small></span>
              <div
                className={`dropzone ${dragging ? 'dragging' : ''} ${hasPhotos ? 'compact' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
              >
                {!hasPhotos && (
                  <div className="drop-hint">
                    <div className="drop-stack"><span>🥳</span><span>📸</span><span>🎂</span></div>
                    <b>Add our favourite photos</b>
                    <small>Our selfies, family functions, fun days out — every memory counts</small>
                  </div>
                )}
                <div className="upload-buttons">
                  <button type="button" className="upload-btn primary" onClick={() => fileRef.current.click()}><ImagePlus size={17} /> {hasPhotos ? 'Add more' : 'Add photos'}</button>
                  <button type="button" className="upload-btn" onClick={() => cameraRef.current.click()}><Camera size={17} /> Take photo</button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
                <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
              </div>

              {hasPhotos && (
                <div className="thumbs">
                  {photos.map((p, i) => (
                    <div key={p.id} className={`thumb ${i === active ? 'active' : ''}`}>
                      <button type="button" className="thumb-img" onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`}>
                        <img src={p.url} alt="" />
                      </button>
                      {i === 0 ? <span className="cover-tag">cover</span>
                        : <button type="button" className="cover-btn" onClick={() => makeCover(p.id)}>set cover</button>}
                      <button type="button" className="thumb-remove" onClick={() => removePhoto(p.id)} aria-label={`Remove photo ${i + 1}`}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="field reveal">
              <span className="field-label"><span className="step">03</span> How do you want to say it?</span>
              <div className="vibe-grid">
                {styles.map(item => {
                  const meta = VIBE_META[item.id] || { emoji: '🎉', hint: '' }
                  return (
                    <button type="button" key={item.id} aria-pressed={style === item.id}
                      className={`vibe ${style === item.id ? 'selected' : ''}`} onClick={() => setStyle(item.id)}>
                      <span className="vibe-emoji">{meta.emoji}</span>
                      <span className="vibe-text"><b>{item.label.replace(/\s*\p{Extended_Pictographic}.*$/u, '')}</b><small>{meta.hint}</small></span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="field reveal">
              <span className="field-label">
                <span className="step">04</span> Pick the words for {name.trim() || 'them'} 💌
                {loading && <RefreshCw className="spin" size={15} />}
              </span>
              {!options.length ? (
                <p className="wish-empty">✍️ Write the birthday person’s name in step 01 and your wishes will appear here.</p>
              ) : (
                <>
                  <div className="wish-list" role="radiogroup" aria-label="Choose a wish">
                    {options.map(text => (
                      <button type="button" key={text} role="radio" aria-checked={wish === text}
                        className={`wish-option ${wish === text ? 'selected' : ''}`} onClick={() => pickWish(text)}>
                        <span className="wish-check">{wish === text ? <Check size={13} /> : ''}</span>
                        <span>{text}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="generate" onClick={surpriseMe} disabled={options.length < 2}>
                    <WandSparkles size={19} /> Surprise me 🎁
                  </button>
                </>
              )}
              <div className="signoff-row">
                <span>Sign it as</span>
                {SIGNOFFS.map(s => (
                  <button type="button" key={s} aria-pressed={signoff === s}
                    className={`signoff ${signoff === s ? 'selected' : ''}`} onClick={() => setSignoff(s)}>{s}</button>
                ))}
              </div>
              {!sender && <p className="field-note">Add your name in step 01 to sign the card.</p>}
            </div>

            <div className="field reveal">
              <span className="field-label"><span className="step">05</span> Make the card look beautiful</span>
              <div className="layout-row">
                {LAYOUTS.map(({ id, name: label, icon: Icon }) => (
                  <button type="button" key={id} aria-pressed={layout === id} disabled={!hasPhotos}
                    className={`layout-btn ${layout === id ? 'selected' : ''}`} onClick={() => setLayout(id)}>
                    <Icon size={18} /> {label}
                  </button>
                ))}
              </div>
              {!hasPhotos && <p className="field-note">Add a photo to unlock photo layouts.</p>}
              <div className="theme-row">
                {THEMES.map(t => (
                  <button type="button" key={t.id} title={t.name} aria-label={t.name} aria-pressed={theme.id === t.id}
                    className={`swatch ${theme.id === t.id ? 'selected' : ''}`}
                    style={{ background: `conic-gradient(from 200deg, ${t.colors[0]}, ${t.colors[1]}, ${t.colors[2]}, ${t.colors[0]})` }}
                    onClick={() => setTheme(t)}>
                    {theme.id === t.id && <Check size={14} color={t.ink} />}
                  </button>
                ))}
                <span className="theme-name">{theme.name}</span>
              </div>
            </div>
          </form>

          <section className="preview" aria-live="polite">
            <div className={`phone ${hasWish ? 'playable' : ''}`} onClick={() => hasWish && openSurprise()} title={hasWish ? 'Open the birthday surprise' : undefined}>
              <div className={`story layout-${cardLayout} ${typing ? 'has-wish' : ''}`} style={cardStyle} key={revealKey}>
                {cardLayout === 'text' && <><div className="story-blob b1" /><div className="story-blob b2" /></>}

                {cardLayout === 'full' && (
                  <div className="full-photo">
                    {photos.map((p, i) => <img key={p.id} src={p.url} alt="" className={i === active ? 'show' : ''} />)}
                  </div>
                )}

                <div className="story-bars">
                  {(slideshow ? photos : [0]).map((p, i) => (
                    <i key={p.id || i} className={i < active ? 'done' : ''}>
                      {i === active && <b key={active} className={slideshow ? 'run' : 'full'} />}
                    </i>
                  ))}
                </div>
                <div className="story-head">
                  <span className="story-avatar">{hasPhotos ? <img src={photos[0].url} alt="" /> : '🎂'}</span>
                  <span><b>{handle}</b><small>wishing {name.trim() || 'someone special'} · {vibe ? vibe.label : 'birthday mode'}</small></span>
                </div>

                {cardLayout === 'text' && (
                  <div className="story-center">
                    {!hasWish && <div className="floaty">🎈</div>}
                    {textBlock}
                  </div>
                )}

                {cardLayout === 'full' && <div className="story-bottom">{textBlock}</div>}

                {cardLayout === 'polaroid' && (
                  <div className="story-center">
                    <div className="polaroid">
                      <img src={current.url} alt="" key={current.id} />
                      <span>{displayName} 🎂</span>
                    </div>
                    {textBlock}
                  </div>
                )}

                {cardLayout === 'collage' && (
                  <div className="story-center">
                    <div className={`collage n${Math.min(photos.length, 4)}`}>
                      {photos.slice(0, 4).map(p => <img key={p.id} src={p.url} alt="" />)}
                    </div>
                    {textBlock}
                  </div>
                )}

                {slideshow && <>
                  <button type="button" className="tap tap-left" onClick={e => { e.stopPropagation(); step(-1) }} aria-label="Previous photo"><ChevronLeft size={22} /></button>
                  <button type="button" className="tap tap-right" onClick={e => { e.stopPropagation(); step(1) }} aria-label="Next photo"><ChevronRight size={22} /></button>
                </>}
                {cardLayout !== 'full' && <span className="float-emoji e1">🎉</span>}
                <span className="float-emoji e2">✨</span>
              </div>
            </div>

            {hasPhotos && (
              <div className="bg-picker">
                <span className="bg-picker-label">🖼️ Surprise background</span>
                <div className="bg-options">
                  <button type="button" className={`bg-option none ${!bgPhoto ? 'selected' : ''}`} onClick={() => setBgId('none')}
                    aria-pressed={!bgPhoto} title="No photo — colours only"
                    style={{ background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})` }}>
                    {!bgPhoto && <Check size={16} />}
                  </button>
                  {photos.map((p, i) => (
                    <button type="button" key={p.id} className={`bg-option ${bgPhoto?.id === p.id ? 'selected' : ''}`} onClick={() => setBgId(p.id)}
                      aria-pressed={bgPhoto?.id === p.id} aria-label={`Use photo ${i + 1} as background`}>
                      <img src={p.url} alt="" />
                      {bgPhoto?.id === p.id && <span className="bg-tick"><Check size={14} /></span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="button" className="play-btn" onClick={openSurprise} disabled={!hasWish}>
              <span className="play-icon"><Play size={18} fill="currentColor" /></span>
              <span><b>🎁 Open the birthday surprise</b><small>{hasWish ? 'a gift · lights · music · a cake to blow out · our memories · a letter' : 'Write the name first'}</small></span>
            </button>

            <div className="video-box">
              <div className="share-head"><Film size={18} /><b>A little film of our memories 🎬</b></div>
              <p className="share-sub">Our photos, a song and your words in one little film — something {displayName} can watch again and again.</p>

              <span className="video-label"><Music size={14} /> Our song</span>
              <div className="song-row">
                {TRACKS.map(t => (
                  <button type="button" key={t.id} aria-pressed={!songFile && track === t.id}
                    className={`signoff ${!songFile && track === t.id ? 'selected' : ''}`} onClick={() => { setSongFile(null); setTrack(t.id) }}>{t.name}</button>
                ))}
                <button type="button" className={`signoff ${songFile ? 'selected' : ''}`} onClick={() => songRef.current?.click()}>
                  <Upload size={13} /> {songFile ? songFile.name.replace(/\.[^.]+$/, '').slice(0, 22) : 'Your song'}
                </button>
                <input ref={songRef} type="file" accept="audio/*,.mp3,.m4a" hidden onChange={e => { pickSong(e.target.files); e.target.value = '' }} />
              </div>
              <p className="field-note">Is there a song that reminds you of each other? Tap <b>Your song</b> and pick it from your phone (MP3/M4A).</p>

              {video ? (
                <div className="video-result">
                  <video src={video.url} controls playsInline onLoadedMetadata={e => { e.currentTarget.currentTime = 3 }} />
                  <div className="share-buttons">
                    <button type="button" className="chip accent" onClick={shareVideo}><Share2 size={15} /> Share video</button>
                    <button type="button" className="chip" onClick={downloadVideo}><Download size={15} /> Download</button>
                    <button type="button" className="chip" onClick={makeVideo}><RefreshCw size={15} /> Make again</button>
                  </div>
                </div>
              ) : videoProgress !== null ? (
                <div className="video-progress">
                  <div className="video-bar"><i style={{ width: `${Math.round(videoProgress * 100)}%` }} /></div>
                  <span>🎬 Recording… {Math.round(videoProgress * 100)}% · keep this tab open</span>
                  <button type="button" className="chip" onClick={() => videoAbortRef.current?.abort()}><X size={15} /> Cancel</button>
                </div>
              ) : (
                <button type="button" className="share-create video-create" onClick={makeVideo} disabled={!hasPhotos || !hasWish || !pickVideoMime()}>
                  <Film size={17} /> Make our memory video {hasPhotos && `(${Math.round(videoDuration(photos.length))}s)`}
                </button>
              )}
              {!hasPhotos && <p className="field-note">Add your photos together in step 02 first.</p>}
              {hasPhotos && !pickVideoMime() && <p className="field-note">This browser can’t record video — try Chrome.</p>}
            </div>

            <div className="share-box">
              <div className="share-head"><Link2 size={18} /><b>Send the surprise to {displayName} 🎁</b></div>
              <p className="share-sub">{displayName} opens the link and finds a gift to unwrap, a cake to blow out, your photos together and a letter from you.</p>
              <label className="share-lock">
                <span><Lock size={14} /> Keep it secret until the birthday <small>(optional)</small></span>
                <input type="date" value={unlockDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setUnlockDate(e.target.value)} />
              </label>
              {unlockInFuture && <p className="share-note">🔒 They’ll see a countdown until {unlockAt.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}, 12:00 AM</p>}
              {!shareUrl ? (
                <button type="button" className="share-create" onClick={makeLink} disabled={!hasWish || sharing}>
                  {sharing ? <><RefreshCw className="spin" size={17} /> Creating link…</> : <><Link2 size={17} /> Create surprise link</>}
                </button>
              ) : (
                <div className="share-result">
                  <input readOnly value={shareUrl} onFocus={e => e.target.select()} aria-label="Surprise link" />
                  <div className="share-buttons">
                    <button type="button" className="chip" onClick={copyLink}><Copy size={15} /> Copy link</button>
                    <button type="button" className="chip accent" onClick={whatsappLink}><MessageCircle size={15} /> Send on WhatsApp</button>
                    <a className="chip" href={shareUrl} target="_blank" rel="noopener">Preview ↗</a>
                  </div>
                </div>
              )}
              {shareError && <p className="error share-error" role="alert">{shareError}</p>}
            </div>

            <div className="actions">
              <button type="button" className="chip" onClick={copyWish} disabled={!hasWish}><Copy size={15} /> Copy</button>
              <button type="button" className="chip" onClick={whatsappWish} disabled={!hasWish}><MessageCircle size={15} /> WhatsApp</button>
              <button type="button" className="chip" onClick={shareWish} disabled={!hasWish}><Share2 size={15} /> Share</button>
              <button type="button" className="chip accent" onClick={downloadCard} disabled={!hasWish}><Download size={15} /> Save card</button>
            </div>
            <p className={`toast ${notice ? 'show' : ''}`}><Sparkles size={14} /> {notice}</p>
          </section>
        </section>

        {launch && (
          <SurpriseLaunch name={displayName} wishes={launch.wishes} chosen={launch.chosen} theme={theme} onDone={finishLaunch} onCancel={cancelLaunch} />
        )}

        {playing && (
          <Surprise photos={photos} background={bgPhoto?.url} name={displayName} wish={wish} signature={signature} theme={theme} music={{ track, songFile }} onClose={closeSurprise} />
        )}

        <footer><span>Made with love{sender ? ` by ${sender}` : ''} for {displayName} 💖</span><span>Happy Birthday, {NICKNAME} 🎂</span></footer>
      </main>
    </>
  )
}

