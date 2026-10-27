import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Volume2, VolumeX, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { fireConfetti } from './confetti.js'
import { startBirthdaySong, playPop } from './music.js'

// The interactive "birthday surprise" — each button unlocks the next scene.
const GIFT = 0, DARK = 1, LIGHTS = 2, MUSIC = 3, DECOR = 4, BALLOONS = 5, CAKE = 6, CANDLES = 7, BLOWN = 8, MEMORIES = 9, LETTER = 10

const BALLOON_COLORS = ['#ff4fa3', '#8b5cf6', '#22d3ee', '#facc15', '#4ade80', '#fb7185', '#f97316']
const FLAG_COLORS = ['#ff4fa3', '#facc15', '#22d3ee', '#a78bfa', '#4ade80', '#fb923c']
const BULB_COLORS = ['#fde047', '#f472b6', '#67e8f9', '#86efac', '#fdba74']
const POP_MESSAGES = ['You’re a legend 👑', 'Cake time! 🎂', 'Best cousin ever 💖', 'Slay all year 💅', 'Cousin hug! 🫂', 'Level up! 🎮', 'Make a wish ✨', 'So proud of you 🥹', 'Party mode 🥳', 'Stay iconic 😎']
const EXTRA_CAPTIONS = ['core memory 🧠', 'this one though 😂', 'iconic, as always 👑', 'my favourite pic 💖', 'never changing 🫶', 'look at you ✨', 'cousins forever 🤞', 'legend behaviour 😎']

function splitLines(text) {
  const parts = text.match(/[^.!?]+(?:[.!?]+|$)(?:\s*[\p{Extended_Pictographic}️‍]+)*/gu) || [text]
  return parts.map(s => s.trim()).filter(Boolean)
}

export default function Surprise({ photos, background, name, wish, signature, theme, music, onClose }) {
  const [stage, setStage] = useState(GIFT)
  const [opening, setOpening] = useState(false)
  const [muted, setMuted] = useState(false)
  const [photoIdx, setPhotoIdx] = useState(0)
  const [letterOpen, setLetterOpen] = useState(false)
  const confettiRef = useRef(null)
  const songRef = useRef(null)
  const rootRef = useRef(null)
  const swipe = useRef(null)
  const [popped, setPopped] = useState(() => new Set())
  const [gens, setGens] = useState(() => Array(16).fill(0))
  const [popTexts, setPopTexts] = useState([])
  const [popCount, setPopCount] = useState(0)

  const first = name.split(/\s+/)[0]
  const lines = splitLines(wish)
  const captions = photos.map((_, i) => lines[i] || EXTRA_CAPTIONS[(i - lines.length) % EXTRA_CAPTIONS.length])

  const balloons = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    left: (i * 61) % 100,
    delay: -(i * 1.37) % 12,
    duration: 9 + (i * 7) % 6,
    size: 54 + (i * 13) % 34,
    color: BALLOON_COLORS[i % BALLOON_COLORS.length],
    photo: photos.length && i % 3 === 0 ? photos[(i / 3) % photos.length] : null
  })), [photos])

  const bulbs = useMemo(() => Array.from({ length: 21 }, (_, i) => {
    const x = i * 50
    return { x, y: 18 + 58 * Math.sin(Math.PI * ((x % 500) / 500)), color: BULB_COLORS[i % BULB_COLORS.length] }
  }), [])

  // Full-screen + keyboard + cleanup
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    rootRef.current?.requestFullscreen?.().catch(() => {})
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      songRef.current?.stop()
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [onClose])

  useEffect(() => { songRef.current?.setMuted(muted) }, [muted])

  // Memories auto-advance like stories
  useEffect(() => {
    if (stage !== MEMORIES || photoIdx >= photos.length - 1) return
    const t = setTimeout(() => setPhotoIdx(i => i + 1), 4500)
    return () => clearTimeout(t)
  }, [stage, photoIdx, photos.length])

  function openGift() {
    if (opening) return
    setOpening(true)
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen?.().catch(() => {})
    fireConfetti(confettiRef.current, theme.colors, { pieces: 120, originY: 0.5 })
    setTimeout(() => setStage(DARK), 900)
  }

  function next() {
    if (stage === LIGHTS) songRef.current = startBirthdaySong(music)
    if (stage === CANDLES) {
      setStage(BLOWN)
      setTimeout(() => fireConfetti(confettiRef.current, theme.colors, { pieces: 280, originY: 0.6 }), 350)
      return
    }
    if (stage === BLOWN && !photos.length) { setStage(LETTER); return }
    setStage(s => s + 1)
  }

  // Tap a balloon: pop sound, mini confetti, a floating message, then it floats up again from the bottom
  function popBalloon(i, e) {
    if (popped.has(i)) return
    playPop()
    const x = e.clientX, y = e.clientY
    fireConfetti(confettiRef.current, theme.colors, { pieces: 36, originX: x / innerWidth, originY: y / innerHeight, power: 0.5 })
    const text = POP_MESSAGES[(popCount + i) % POP_MESSAGES.length]
    const id = `${i}-${Date.now()}`
    setPopTexts(t => [...t, { id, x, y, text }])
    setPopCount(c => c + 1)
    setPopped(s => new Set(s).add(i))
    setTimeout(() => setPopTexts(t => t.filter(m => m.id !== id)), 1800)
    setTimeout(() => {
      setGens(g => g.map((n, j) => (j === i ? n + 1 : n)))
      setPopped(s => { const n = new Set(s); n.delete(i); return n })
    }, 600)
  }

  function replay() {
    songRef.current?.stop()
    songRef.current = null
    setMuted(false)
    setOpening(false)
    setLetterOpen(false)
    setPhotoIdx(0)
    setStage(GIFT)
  }

  function stepPhoto(d) { setPhotoIdx(i => Math.min(photos.length - 1, Math.max(0, i + d))) }
  function onPointerDown(e) { swipe.current = e.clientX }
  function onPointerUp(e) {
    if (swipe.current == null) return
    const dx = e.clientX - swipe.current
    swipe.current = null
    if (Math.abs(dx) > 50) stepPhoto(dx < 0 ? 1 : -1)
    else stepPhoto(e.clientX < window.innerWidth * 0.3 ? -1 : 1)
  }

  const action = {
    [DARK]: '💡 Turn on the lights',
    [LIGHTS]: '🎵 Play the music',
    [MUSIC]: '🎊 Decorate',
    [DECOR]: '🎈 Fly the balloons',
    [BALLOONS]: '🎂 Bring the cake',
    [CAKE]: '🕯️ Light the candles',
    [CANDLES]: '🌬️ Blow the candles',
    [BLOWN]: photos.length ? '📸 See our memories' : '💌 Open your message',
    [MEMORIES]: '💌 Open your message'
  }[stage]

  const headline = {
    [GIFT]: [`Hey ${first}… 👀`, 'Someone made something special for you. Tap the gift!'],
    [DARK]: ['It’s a little dark in here…', 'Let’s fix that.'],
    [LIGHTS]: ['Ahh, much better ✨', 'But it’s too quiet…'],
    [MUSIC]: ['Now we’re talking 🎶', 'This place needs some decoration.'],
    [DECOR]: ['Looking pretty! 🎀', 'Something’s still missing…'],
    [BALLOONS]: ['Up, up and away 🎈', 'Tap the balloons to pop them! Then… cake?'],
    [CAKE]: ['Is that… cake? 🎂', 'Every cake needs candles.'],
    [CANDLES]: [`Make a wish, ${first} 🤫`, 'Close your eyes… then blow!']
  }[stage]

  const style = { '--c1': theme.colors[0], '--c2': theme.colors[1], '--c3': theme.colors[2] }
  const showCake = stage >= CAKE && stage <= BLOWN

  return (
    <div ref={rootRef} className={`bday stage-${stage} ${stage >= LIGHTS ? 'lit' : ''} ${background ? 'has-bg' : ''}`} style={style} role="dialog" aria-modal="true" aria-label={`Birthday surprise for ${name}`}>
      {background && <div className="bd-bg-photo"><img src={background} alt="" /></div>}
      <div className="bd-sky" />
      <div className="bd-stars" aria-hidden="true" />

      {stage >= DARK && (
        <svg className="bd-lights" viewBox="0 0 1000 110" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={bulbs.map(b => `${b.x},${b.y}`).join(' ')} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
          {bulbs.map((b, i) => (
            <circle key={i} cx={b.x} cy={b.y + 12} r="9" fill={stage >= LIGHTS ? b.color : '#3b3550'}
              className={stage >= LIGHTS ? 'bulb on' : 'bulb'} style={{ animationDelay: `${(i % 5) * 0.3}s`, color: b.color }} />
          ))}
        </svg>
      )}

      {stage >= DECOR && (
        <div className="bd-bunting" aria-hidden="true">
          {['HAPPY', 'BIRTHDAY'].map((word, w) => (
            <div key={word} className="bunting-row">
              {Array.from(word).map((ch, i) => {
                const n = w * 6 + i
                return (
                  <span key={i} className="flag" style={{
                    '--fc': FLAG_COLORS[n % FLAG_COLORS.length], animationDelay: `${n * 70}ms`,
                    marginTop: `${Math.sin(Math.PI * (i + 0.5) / word.length) * 16}px`
                  }}><b>{ch}</b></span>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {stage >= BALLOONS && stage !== LETTER && (
        <div className="bd-balloons" aria-hidden="true">
          {balloons.map((b, i) => (
            <div key={`${i}-${gens[i]}`} className={`balloon-wrap ${popped.has(i) ? 'popped' : ''}`} onPointerDown={e => popBalloon(i, e)}
              style={{ left: `${b.left}%`, animationDelay: `${gens[i] ? 0 : b.delay}s`, animationDuration: `${b.duration}s` }}>
              <div className="balloon" style={{ '--bc': b.color, width: b.size, height: b.size * 1.2 }}>
                {b.photo && <img src={b.photo.url} alt="" />}
              </div>
            </div>
          ))}
        </div>
      )}

      <canvas ref={confettiRef} className="confetti" aria-hidden="true" />

      {popTexts.map(m => (
        <span key={m.id} className="pop-text" style={{ left: m.x, top: m.y }}>{m.text}</span>
      ))}
      {popCount > 0 && stage < MEMORIES && <span className="pop-count">🎈 × {popCount}</span>}

      <div className="bd-top">
        {songRef.current && (
          <button type="button" className="bd-icon" onClick={() => setMuted(m => !m)} aria-label={muted ? 'Unmute music' : 'Mute music'}>
            {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        )}
        <button type="button" className="bd-icon" onClick={onClose} aria-label="Close"><X size={22} /></button>
      </div>

      {/* Centre stage */}
      {stage < MEMORIES && (
        <div className="bd-stage">
          {headline && (
            <div className="bd-headline" key={stage}>
              <h2>{headline[0]}</h2>
              <p>{headline[1]}</p>
            </div>
          )}

          {stage === GIFT && (
            <button type="button" className={`gift ${opening ? 'open' : ''}`} onClick={openGift} aria-label="Open the gift">
              <span className="gift-lid"><i /></span>
              <span className="gift-box"><i /></span>
              <span className="gift-glow" />
            </button>
          )}

          {stage === BLOWN && (
            <div className="bd-hbd">
              <p>🎉 HAPPY BIRTHDAY 🎉</p>
              <h1>{name}</h1>
            </div>
          )}

          {showCake && (
            <button type="button" className={`cake ${stage >= CANDLES ? 'lit' : ''} ${stage >= BLOWN ? 'blown' : ''}`}
              onClick={() => stage === CANDLES && next()} aria-label={stage === CANDLES ? 'Blow the candles' : 'Birthday cake'}>
              <span className="candles">
                {[0, 1, 2].map(i => <span key={i} className="candle"><i className="flame" /><i className="smoke" /></span>)}
              </span>
              <span className="tier top" />
              <span className="tier bottom" />
              <span className="plate" />
            </button>
          )}
        </div>
      )}

      {stage === MEMORIES && (
        <div className="bd-memories" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          {photos.map((p, i) => (
            <div key={p.id} className={`mem-photo ${i === photoIdx ? 'show' : ''}`}>
              <img className="mem-blur" src={p.url} alt="" />
              <img className="mem-main" src={p.url} alt="" />
            </div>
          ))}
          <div className="mem-shade" />
          <div className="mem-bars">
            {photos.map((p, i) => <i key={p.id} className={i < photoIdx ? 'done' : ''}>{i === photoIdx && <b key={photoIdx} />}</i>)}
          </div>
          <p className="mem-caption" key={photoIdx}>{captions[photoIdx]}</p>
          <button type="button" className="mem-arrow left" disabled={photoIdx === 0} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onClick={() => stepPhoto(-1)} aria-label="Previous photo"><ChevronLeft size={28} /></button>
          <button type="button" className="mem-arrow right" disabled={photoIdx === photos.length - 1} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onClick={() => stepPhoto(1)} aria-label="Next photo"><ChevronRight size={28} /></button>
        </div>
      )}

      {stage === LETTER && (
        <div className="bd-letter-wrap">
          {!letterOpen ? (
            <button type="button" className="envelope" onClick={() => setLetterOpen(true)} aria-label="Open the letter">
              <span className="env-back" />
              <span className="env-flap" />
              <span className="env-front" />
              <span className="env-heart">💌</span>
              <span className="env-hint">tap to open</span>
            </button>
          ) : (
            <div className="letter">
              <p className="letter-dear">Dear {name},</p>
              <p className="letter-body">{wish}</p>
              {signature && <p className="letter-sign">— {signature} 💖</p>}
              <div className="letter-buttons">
                <button type="button" onClick={replay}><RotateCcw size={16} /> Replay</button>
                <button type="button" className="primary" onClick={onClose}>Close</button>
              </div>
            </div>
          )}
        </div>
      )}

      {action && (
        <div className="bd-action">
          <button type="button" key={stage} onClick={next}>{action}</button>
        </div>
      )}
    </div>
  )
}
