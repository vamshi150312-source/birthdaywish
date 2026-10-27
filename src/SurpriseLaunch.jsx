import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { fireConfetti } from './confetti.js'
import { playPop } from './music.js'

// "Surprise me" reveal: a shaking gift while wishes shuffle like a slot machine, the chosen wish lands,
// then a 3-2-1 countdown before the full birthday surprise opens.
const SHUFFLE_STEPS = 16
const COUNT_MS = 750

export default function SurpriseLaunch({ name, wishes, chosen, theme, onDone, onCancel }) {
  const [phase, setPhase] = useState('shuffle')
  const [shown, setShown] = useState(wishes[0] || chosen)
  const [count, setCount] = useState(3)
  const confettiRef = useRef(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Slot-machine shuffle that slows down, then lands on the chosen wish
  useEffect(() => {
    if (phase !== 'shuffle') return
    let step = 0
    let timer
    const tick = () => {
      step += 1
      if (step >= SHUFFLE_STEPS) {
        setShown(chosen)
        setPhase('landed')
        fireConfetti(confettiRef.current, theme.colors, { pieces: 140, originY: 0.5 })
        return
      }
      setShown(wishes[step % wishes.length])
      timer = setTimeout(tick, 60 + step * step * 0.9)
    }
    timer = setTimeout(tick, 400)
    return () => clearTimeout(timer)
  }, [phase, wishes, chosen, theme.colors])

  useEffect(() => {
    if (phase !== 'landed') return
    const t = setTimeout(() => setPhase('count'), 1900)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'count') return
    playPop()
    if (count === 0) {
      const t = setTimeout(() => doneRef.current(), 450)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setCount(c => c - 1), COUNT_MS)
    return () => clearTimeout(t)
  }, [phase, count])

  const style = { '--c1': theme.colors[0], '--c2': theme.colors[1], '--c3': theme.colors[2] }

  return (
    <div className={`launch phase-${phase}`} style={style} role="dialog" aria-modal="true" aria-label={`Birthday surprise for ${name}`}>
      <div className="launch-rays" aria-hidden="true" />
      <canvas ref={confettiRef} className="confetti" aria-hidden="true" />
      <button type="button" className="launch-close" onClick={onCancel} aria-label="Close"><X size={22} /></button>

      {phase !== 'count' ? (
        <div className="launch-body">
          <div className={`launch-gift ${phase === 'landed' ? 'open' : ''}`} aria-hidden="true">🎁</div>
          <p className="launch-kicker">{phase === 'shuffle' ? `Picking a special wish for ${name}…` : `A wish for ${name} 💖`}</p>
          <div className={`launch-card ${phase === 'landed' ? 'landed' : ''}`}>
            <p key={shown}>{shown}</p>
          </div>
          {phase === 'landed' && <p className="launch-next">Get ready… your surprise is opening ✨</p>}
        </div>
      ) : (
        <div className="launch-body">
          <p className="launch-kicker">Your birthday surprise opens in</p>
          <div className="launch-count" key={count}>{count || '🎉'}</div>
          <button type="button" className="launch-skip" onClick={() => doneRef.current()}>Skip →</button>
        </div>
      )}
    </div>
  )
}
