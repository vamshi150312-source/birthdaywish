// Creates a shareable surprise on the backend and returns its link.

const MAX_SIDE = 1600

// Phone photos are often 5–10 MB; shrink them before upload. Falls back to the original if the browser can't decode it.
async function compressImage(file) {
  if (file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob || file
  } catch {
    return file
  }
}

export async function createSurpriseLink({ name, wish, signature, themeId, photos, backgroundIndex, unlockAt }) {
  const form = new FormData()
  const data = { name, wish, signature, themeId, backgroundIndex, unlockAt }
  form.append('data', new Blob([JSON.stringify(data)], { type: 'application/json' }))
  const blobs = await Promise.all(photos.map(p => compressImage(p.file)))
  blobs.forEach((blob, i) => form.append('photos', blob, `photo-${i}.${blob.type === 'image/png' ? 'png' : 'jpg'}`))

  const response = await fetch('/api/surprises', { method: 'POST', body: form })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || (response.status === 413 ? 'Photos are too large.' : 'Could not create the link. Is the backend running?'))
  }
  const { id } = await response.json()
  return `${location.origin}/?s=${id}`
}
