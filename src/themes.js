export const THEMES = [
  { id: 'aurora', name: 'Aurora', colors: ['#7c3aed', '#db2777', '#0ea5e9'], ink: '#ffffff' },
  { id: 'sunset', name: 'Sunset', colors: ['#f97316', '#ec4899', '#facc15'], ink: '#ffffff' },
  { id: 'y2k', name: 'Y2K Chrome', colors: ['#c7d2fe', '#f0abfc', '#a5f3fc'], ink: '#1e1b4b' },
  { id: 'matcha', name: 'Matcha', colors: ['#bef264', '#4ade80', '#fef9c3'], ink: '#14532d' },
  { id: 'midnight', name: 'Midnight Gold', colors: ['#0f0a1e', '#3b0764', '#b45309'], ink: '#fde68a' }
]

export const themeById = id => THEMES.find(t => t.id === id) || THEMES[0]
