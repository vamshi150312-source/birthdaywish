// Birthday music with the Web Audio API. Built-in tracks are synthesised (no audio files needed);
// a song file the user picks from their device can be played instead.
const FREQ = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 }
const SONG = [
  ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
  ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
  ['G4', .75], ['G4', .25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
  ['F5', .75], ['F5', .25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3]
]
const SONG_BEATS = SONG.reduce((sum, [, b]) => sum + b, 0) + 2

export const TRACKS = [
  { id: 'remix', name: 'Party Remix 🔥', beat: 0.34 },
  { id: 'classic', name: 'Classic 🎂', beat: 0.42 }
]

let popCtx = null

function noiseBuffer(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

// A short "pop!" — filtered noise burst
export function playPop() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  popCtx ??= new AudioCtx()
  const ctx = popCtx
  const length = Math.floor(ctx.sampleRate * 0.12)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  src.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.value = 900 + Math.random() * 600
  gain.gain.value = 0.9
  src.connect(filter).connect(gain).connect(ctx.destination)
  src.start()
}

/**
 * Starts looping birthday music. Pass `songFile` to play the user's own song, otherwise `track` picks a built-in one.
 * Pass `ctx` + `destination` to also route the music somewhere else (e.g. a video recording); the caller then owns the context.
 */
export function startBirthdaySong({ track = 'remix', songFile = null, ctx: givenCtx = null, destination = null } = {}) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx && !givenCtx) return { stop() {}, setMuted() {}, fadeOut() {}, ready: Promise.resolve() }
  const ctx = givenCtx || new AudioCtx()
  const volume = songFile ? 0.9 : 0.2
  const master = ctx.createGain()
  master.gain.value = volume
  master.connect(ctx.destination)
  if (destination) master.connect(destination)
  let timer = null
  let source = null
  let stopped = false

  function note(freq, start, length, voices) {
    for (const [type, mult, vol] of voices) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq * mult
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(vol, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, start + length * 0.95)
      osc.connect(gain).connect(master)
      osc.start(start)
      osc.stop(start + length)
    }
  }

  const hatNoise = noiseBuffer(ctx, 0.2)

  function kick(t) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12)
    gain.gain.setValueAtTime(1.6, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.connect(gain).connect(master)
    osc.start(t)
    osc.stop(t + 0.36)
  }

  function noiseHit(t, { type, freq, length, vol }) {
    const src = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    src.buffer = hatNoise
    filter.type = type
    filter.frequency.value = freq
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + length)
    src.connect(filter).connect(gain).connect(master)
    src.start(t)
    src.stop(t + length)
  }

  function bass(freq, t, length) {
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = freq / 4
    filter.type = 'lowpass'
    filter.frequency.value = 420
    gain.gain.setValueAtTime(0.9, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + Math.min(length, 0.5))
    osc.connect(filter).connect(gain).connect(master)
    osc.start(t)
    osc.stop(t + length)
  }

  function playSynth() {
    const { beat, id } = TRACKS.find(t => t.id === track) || TRACKS[0]
    const remix = id === 'remix'
    const voices = remix ? [['square', 1, 0.35], ['sine', 2, 0.3]] : [['triangle', 1, 1], ['sine', 2, 0.25]]
    let t = ctx.currentTime + 0.05
    const loopStart = t
    for (const [n, beats] of SONG) {
      note(FREQ[n], t, beats * beat, voices)
      if (remix) bass(FREQ[n], t, beats * beat)
      t += beats * beat
    }
    if (remix) {
      // Party beat under the melody: kick on every beat, hi-hat on the off-beats, clap on every third beat
      for (let i = 0; i < SONG_BEATS; i++) {
        const bt = loopStart + i * beat
        kick(bt)
        noiseHit(bt + beat / 2, { type: 'highpass', freq: 7000, length: 0.05, vol: 0.5 })
        if (i % 3 === 2) noiseHit(bt, { type: 'bandpass', freq: 1500, length: 0.16, vol: 1.2 })
      }
    }
    timer = setTimeout(playSynth, SONG_BEATS * beat * 1000)
  }

  async function playFile() {
    const buffer = await ctx.decodeAudioData(await songFile.arrayBuffer())
    if (stopped) return
    source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(master)
    source.start()
  }

  // Browsers may start a context suspended until a user gesture; every caller runs from a click
  ctx.resume?.()
  const ready = songFile
    ? playFile().catch(() => { if (!stopped) playSynth() })
    : Promise.resolve(playSynth())

  return {
    ready,
    stop() {
      stopped = true
      clearTimeout(timer)
      try { source?.stop() } catch { /* already stopped */ }
      master.disconnect()
      if (!givenCtx) ctx.close()
    },
    setMuted(muted) { master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05) },
    fadeOut(seconds) { master.gain.setTargetAtTime(0, ctx.currentTime, seconds / 3) }
  }
}
