import { useCallback, useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import Surprise from './Surprise.jsx'
import { themeById } from './themes.js'

// What the birthday person sees when they open a shared link (/?s=<id>).
export default function Viewer({ id }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [ended, setEnded] = useState(false)
  const [run, setRun] = useState(0)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/surprises/${encodeURIComponent(id)}`)
      if (response.status === 404) throw new Error('missing')
      if (!response.ok) throw new Error('server')
      setData(await response.json())
    } catch (e) {
      setError(e.message === 'missing' ? 'missing' : 'server')
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Tick the countdown; reload once the unlock time passes
  const unlockAt = data?.locked ? new Date(data.unlockAt).getTime() : 0
  useEffect(() => {
    if (!unlockAt) return
    const t = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= unlockAt) { clearInterval(t); load() }
    }, 1000)
    return () => clearInterval(t)
  }, [unlockAt, load])

  const finish = useCallback(() => setEnded(true), [])
  const theme = themeById(data?.themeId)
  const style = { '--c1': theme.colors[0], '--c2': theme.colors[1], '--c3': theme.colors[2] }

  if (error) {
    return (
      <Screen style={style}>
        <div className="vw-emoji">{error === 'missing' ? '🥲' : '🔌'}</div>
        <h1>{error === 'missing' ? 'This surprise doesn’t exist' : 'Can’t reach the server'}</h1>
        <p>{error === 'missing' ? 'Double-check the link you were sent.' : 'Please try again in a moment.'}</p>
        <a className="vw-btn" href="/">Make your own surprise 🎁</a>
      </Screen>
    )
  }

  if (!data) {
    return <Screen style={style}><div className="vw-emoji vw-spin">🎁</div><p>Loading your surprise…</p></Screen>
  }

  if (data.locked) {
    const left = Math.max(0, unlockAt - now)
    const parts = [
      ['days', Math.floor(left / 86400000)],
      ['hours', Math.floor(left / 3600000) % 24],
      ['mins', Math.floor(left / 60000) % 60],
      ['secs', Math.floor(left / 1000) % 60]
    ]
    return (
      <Screen style={style}>
        <div className="vw-emoji vw-wiggle">🎁</div>
        <p className="vw-kicker">a surprise is waiting for</p>
        <h1 className="vw-name">{data.name}</h1>
        <p>It unlocks in…</p>
        <div className="vw-count">
          {parts.map(([label, value]) => (
            <div key={label}><b>{String(value).padStart(2, '0')}</b><span>{label}</span></div>
          ))}
        </div>
        <p className="vw-when">🔒 Opens {new Date(unlockAt).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</p>
        <p className="vw-hint">No peeking! Keep this page open or come back later 👀</p>
      </Screen>
    )
  }

  if (ended) {
    return (
      <Screen style={style}>
        <div className="vw-emoji">🥳</div>
        <h1>Happy Birthday, {data.name.split(/\s+/)[0]}!</h1>
        <p>{data.signature ? `This surprise was made for you — ${data.signature} 💖` : 'This surprise was made just for you 💖'}</p>
        <div className="vw-row">
          <button type="button" className="vw-btn ghost" onClick={() => { setEnded(false); setRun(r => r + 1) }}><RotateCcw size={16} /> Watch again</button>
          <a className="vw-btn" href="/">Make one for a friend 🎁</a>
        </div>
      </Screen>
    )
  }

  const photos = data.photoUrls.map((url, i) => ({ id: `p${i}`, url }))
  const background = data.backgroundIndex != null ? data.photoUrls[data.backgroundIndex] : null
  return (
    <Surprise key={run} photos={photos} background={background} name={data.name} wish={data.wish}
      signature={data.signature || ''} theme={theme} onClose={finish} />
  )
}

function Screen({ style, children }) {
  return (
    <main className="vw-screen" style={style}>
      <div className="vw-inner">{children}</div>
    </main>
  )
}
