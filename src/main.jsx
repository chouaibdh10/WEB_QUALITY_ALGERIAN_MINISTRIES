import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import { PreferencesProvider } from './Preferences'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/noto-sans-arabic'
import './styles.css'
import './observatory.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><PreferencesProvider><BrowserRouter><App /></BrowserRouter></PreferencesProvider></React.StrictMode>,
)
