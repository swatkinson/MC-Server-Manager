import { useState, useEffect, useCallback } from 'react'

export interface ColorScheme {
  id: string
  name: string
  vars: Record<string, string>
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'A01',
    name: 'Midnight',
    vars: {
      '--bg': '#0f1117',
      '--bg-card': '#1a1d2e',
      '--bg-sunken': '#0a0e1a',
      '--border': '#2d3150',
      '--text': '#e2e8f0',
      '--text-muted': '#8892a4',
      '--green': '#22c55e',
      '--red': '#ef4444',
      '--yellow': '#f59e0b',
      '--blue': '#3b82f6',
      '--purple': '#a855f7',
      '--gray': '#6b7280',
    },
  },
  {
    id: 'A02',
    name: 'Dracula',
    vars: {
      '--bg': '#282a36',
      '--bg-card': '#1e2029',
      '--bg-sunken': '#191a23',
      '--border': '#44475a',
      '--text': '#f8f8f2',
      '--text-muted': '#6272a4',
      '--green': '#50fa7b',
      '--red': '#ff5555',
      '--yellow': '#f1fa8c',
      '--blue': '#8be9fd',
      '--purple': '#bd93f9',
      '--gray': '#6272a4',
    },
  },
  {
    id: 'A03',
    name: 'Nord',
    vars: {
      '--bg': '#2e3440',
      '--bg-card': '#3b4252',
      '--bg-sunken': '#242933',
      '--border': '#4c566a',
      '--text': '#eceff4',
      '--text-muted': '#d8dee9',
      '--green': '#a3be8c',
      '--red': '#bf616a',
      '--yellow': '#ebcb8b',
      '--blue': '#81a1c1',
      '--purple': '#b48ead',
      '--gray': '#4c566a',
    },
  },
  {
    id: 'A04',
    name: 'Gruvbox',
    vars: {
      '--bg': '#282828',
      '--bg-card': '#32302f',
      '--bg-sunken': '#1d2021',
      '--border': '#504945',
      '--text': '#ebdbb2',
      '--text-muted': '#928374',
      '--green': '#b8bb26',
      '--red': '#fb4934',
      '--yellow': '#fabd2f',
      '--blue': '#83a598',
      '--purple': '#d3869b',
      '--gray': '#928374',
    },
  },
  {
    id: 'A05',
    name: 'Catppuccin',
    vars: {
      '--bg': '#1e1e2e',
      '--bg-card': '#181825',
      '--bg-sunken': '#11111b',
      '--border': '#313244',
      '--text': '#cdd6f4',
      '--text-muted': '#6c7086',
      '--green': '#a6e3a1',
      '--red': '#f38ba8',
      '--yellow': '#f9e2af',
      '--blue': '#89b4fa',
      '--purple': '#cba6f7',
      '--gray': '#585b70',
    },
  },
  {
    id: 'A06',
    name: 'Tokyo Night',
    vars: {
      '--bg': '#1a1b26',
      '--bg-card': '#24283b',
      '--bg-sunken': '#13141f',
      '--border': '#292e42',
      '--text': '#c0caf5',
      '--text-muted': '#565f89',
      '--green': '#9ece6a',
      '--red': '#f7768e',
      '--yellow': '#e0af68',
      '--blue': '#7aa2f7',
      '--purple': '#bb9af7',
      '--gray': '#414868',
    },
  },
  {
    id: 'A07',
    name: 'Solarized',
    vars: {
      '--bg': '#002b36',
      '--bg-card': '#073642',
      '--bg-sunken': '#001e27',
      '--border': '#0e4a5a',
      '--text': '#eee8d5',
      '--text-muted': '#657b83',
      '--green': '#859900',
      '--red': '#dc322f',
      '--yellow': '#b58900',
      '--blue': '#268bd2',
      '--purple': '#6c71c4',
      '--gray': '#586e75',
    },
  },
  {
    id: 'A08',
    name: 'One Dark',
    vars: {
      '--bg': '#282c34',
      '--bg-card': '#21252b',
      '--bg-sunken': '#1c1f24',
      '--border': '#3e4451',
      '--text': '#abb2bf',
      '--text-muted': '#5c6370',
      '--green': '#98c379',
      '--red': '#e06c75',
      '--yellow': '#e5c07b',
      '--blue': '#61afef',
      '--purple': '#c678dd',
      '--gray': '#4b5263',
    },
  },
  {
    id: 'A09',
    name: 'Rosé Pine',
    vars: {
      '--bg': '#191724',
      '--bg-card': '#1f1d2e',
      '--bg-sunken': '#120f1d',
      '--border': '#26233a',
      '--text': '#e0def4',
      '--text-muted': '#6e6a86',
      '--green': '#31748f',
      '--red': '#eb6f92',
      '--yellow': '#f6c177',
      '--blue': '#9ccfd8',
      '--purple': '#c4a7e7',
      '--gray': '#524f67',
    },
  },
  {
    id: 'A10',
    name: 'Slate Light',
    vars: {
      '--bg': '#f8fafc',
      '--bg-card': '#ffffff',
      '--bg-sunken': '#f1f5f9',
      '--border': '#e2e8f0',
      '--text': '#0f172a',
      '--text-muted': '#64748b',
      '--green': '#16a34a',
      '--red': '#dc2626',
      '--yellow': '#d97706',
      '--blue': '#2563eb',
      '--purple': '#7c3aed',
      '--gray': '#94a3b8',
    },
  },
]

const STORAGE_KEY = 'mc-manager-color-scheme'

function applyScheme(scheme: ColorScheme) {
  const root = document.documentElement
  for (const [prop, value] of Object.entries(scheme.vars)) {
    root.style.setProperty(prop, value)
  }
}

export function initColorScheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  const scheme = saved ? COLOR_SCHEMES.find(s => s.id === saved) : undefined
  applyScheme(scheme ?? COLOR_SCHEMES[0])
}

export function useColorScheme() {
  const [index, setIndex] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const found = saved ? COLOR_SCHEMES.findIndex(s => s.id === saved) : -1
    return found >= 0 ? found : 0
  })

  useEffect(() => {
    applyScheme(COLOR_SCHEMES[index])
    localStorage.setItem(STORAGE_KEY, COLOR_SCHEMES[index].id)
  }, [index])

  const next = useCallback(() => {
    setIndex(i => (i + 1) % COLOR_SCHEMES.length)
  }, [])

  return { scheme: COLOR_SCHEMES[index], next }
}
