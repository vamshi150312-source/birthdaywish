import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Viewer from './Viewer.jsx'
import './styles.css'

// A shared link looks like /?s=<id> and opens the surprise for the birthday person; anything else opens the builder.
const surpriseId = new URLSearchParams(location.search).get('s')

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{surpriseId ? <Viewer id={surpriseId} /> : <App />}</React.StrictMode>
)
