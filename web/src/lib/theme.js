import { createContext } from 'react'
import { STORAGE_KEY } from '../data.js'

const APP_THEME_STORAGE_KEY = `${STORAGE_KEY}:theme`

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'

  try {
    const savedTheme = localStorage.getItem(APP_THEME_STORAGE_KEY)
    if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme
  } catch {
    // Ignore storage failures and fall back to the system preference.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} })

export { ThemeContext, getInitialTheme }