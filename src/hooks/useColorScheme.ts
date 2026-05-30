import { useState, useEffect, useCallback } from 'react'

export interface ColorScheme {
  id: string
  name: string
  vars: Record<string, string>
}

export const COLOR_SCHEMES: ColorScheme[] = [
  // ── Dark (original 10) ──────────────────────────────────────────────────────
  {
    id: 'A01', name: 'Midnight',
    vars: {
      '--bg': '#0f1117', '--bg-card': '#1a1d2e', '--bg-sunken': '#0a0e1a',
      '--border': '#2d3150', '--text': '#e2e8f0', '--text-muted': '#8892a4',
      '--green': '#22c55e', '--red': '#ef4444', '--yellow': '#f59e0b',
      '--blue': '#3b82f6', '--purple': '#a855f7', '--gray': '#6b7280',
    },
  },
  {
    id: 'A02', name: 'Dracula',
    vars: {
      '--bg': '#282a36', '--bg-card': '#1e2029', '--bg-sunken': '#191a23',
      '--border': '#44475a', '--text': '#f8f8f2', '--text-muted': '#6272a4',
      '--green': '#50fa7b', '--red': '#ff5555', '--yellow': '#f1fa8c',
      '--blue': '#8be9fd', '--purple': '#bd93f9', '--gray': '#6272a4',
    },
  },
  {
    id: 'A03', name: 'Nord',
    vars: {
      '--bg': '#2e3440', '--bg-card': '#3b4252', '--bg-sunken': '#242933',
      '--border': '#4c566a', '--text': '#eceff4', '--text-muted': '#d8dee9',
      '--green': '#a3be8c', '--red': '#bf616a', '--yellow': '#ebcb8b',
      '--blue': '#81a1c1', '--purple': '#b48ead', '--gray': '#4c566a',
    },
  },
  {
    id: 'A04', name: 'Gruvbox',
    vars: {
      '--bg': '#282828', '--bg-card': '#32302f', '--bg-sunken': '#1d2021',
      '--border': '#504945', '--text': '#ebdbb2', '--text-muted': '#928374',
      '--green': '#b8bb26', '--red': '#fb4934', '--yellow': '#fabd2f',
      '--blue': '#83a598', '--purple': '#d3869b', '--gray': '#928374',
    },
  },
  {
    id: 'A05', name: 'Catppuccin',
    vars: {
      '--bg': '#1e1e2e', '--bg-card': '#181825', '--bg-sunken': '#11111b',
      '--border': '#313244', '--text': '#cdd6f4', '--text-muted': '#6c7086',
      '--green': '#a6e3a1', '--red': '#f38ba8', '--yellow': '#f9e2af',
      '--blue': '#89b4fa', '--purple': '#cba6f7', '--gray': '#585b70',
    },
  },
  {
    id: 'A06', name: 'Tokyo Night',
    vars: {
      '--bg': '#1a1b26', '--bg-card': '#24283b', '--bg-sunken': '#13141f',
      '--border': '#292e42', '--text': '#c0caf5', '--text-muted': '#565f89',
      '--green': '#9ece6a', '--red': '#f7768e', '--yellow': '#e0af68',
      '--blue': '#7aa2f7', '--purple': '#bb9af7', '--gray': '#414868',
    },
  },
  {
    id: 'A07', name: 'Solarized',
    vars: {
      '--bg': '#002b36', '--bg-card': '#073642', '--bg-sunken': '#001e27',
      '--border': '#0e4a5a', '--text': '#eee8d5', '--text-muted': '#657b83',
      '--green': '#859900', '--red': '#dc322f', '--yellow': '#b58900',
      '--blue': '#268bd2', '--purple': '#6c71c4', '--gray': '#586e75',
    },
  },
  {
    id: 'A08', name: 'One Dark',
    vars: {
      '--bg': '#282c34', '--bg-card': '#21252b', '--bg-sunken': '#1c1f24',
      '--border': '#3e4451', '--text': '#abb2bf', '--text-muted': '#5c6370',
      '--green': '#98c379', '--red': '#e06c75', '--yellow': '#e5c07b',
      '--blue': '#61afef', '--purple': '#c678dd', '--gray': '#4b5263',
    },
  },
  {
    id: 'A09', name: 'Rosé Pine',
    vars: {
      '--bg': '#191724', '--bg-card': '#1f1d2e', '--bg-sunken': '#120f1d',
      '--border': '#26233a', '--text': '#e0def4', '--text-muted': '#6e6a86',
      '--green': '#31748f', '--red': '#eb6f92', '--yellow': '#f6c177',
      '--blue': '#9ccfd8', '--purple': '#c4a7e7', '--gray': '#524f67',
    },
  },
  {
    id: 'A10', name: 'Slate Light',
    vars: {
      '--bg': '#f8fafc', '--bg-card': '#ffffff', '--bg-sunken': '#f1f5f9',
      '--border': '#e2e8f0', '--text': '#0f172a', '--text-muted': '#64748b',
      '--green': '#16a34a', '--red': '#dc2626', '--yellow': '#d97706',
      '--blue': '#2563eb', '--purple': '#7c3aed', '--gray': '#94a3b8',
    },
  },

  // ── Light ───────────────────────────────────────────────────────────────────
  {
    id: 'A11', name: 'GitHub Light',
    vars: {
      '--bg': '#ffffff', '--bg-card': '#f6f8fa', '--bg-sunken': '#eaeef2',
      '--border': '#d0d7de', '--text': '#1f2328', '--text-muted': '#656d76',
      '--green': '#1a7f37', '--red': '#cf222e', '--yellow': '#9a6700',
      '--blue': '#0969da', '--purple': '#8250df', '--gray': '#6e7781',
    },
  },
  {
    id: 'A12', name: 'Solarized Light',
    vars: {
      '--bg': '#fdf6e3', '--bg-card': '#eee8d5', '--bg-sunken': '#e5dfc8',
      '--border': '#cdc9b5', '--text': '#657b83', '--text-muted': '#93a1a1',
      '--green': '#859900', '--red': '#dc322f', '--yellow': '#b58900',
      '--blue': '#268bd2', '--purple': '#6c71c4', '--gray': '#839496',
    },
  },
  {
    id: 'A13', name: 'Gruvbox Light',
    vars: {
      '--bg': '#fbf1c7', '--bg-card': '#f2e5bc', '--bg-sunken': '#ebdbb2',
      '--border': '#d5c4a1', '--text': '#3c3836', '--text-muted': '#7c6f64',
      '--green': '#79740e', '--red': '#9d0006', '--yellow': '#b57614',
      '--blue': '#076678', '--purple': '#8f3f71', '--gray': '#928374',
    },
  },
  {
    id: 'A14', name: 'One Light',
    vars: {
      '--bg': '#fafafa', '--bg-card': '#f0f0f0', '--bg-sunken': '#e8e8e8',
      '--border': '#d3d3d3', '--text': '#383a42', '--text-muted': '#696c77',
      '--green': '#50a14f', '--red': '#e45649', '--yellow': '#c18401',
      '--blue': '#4078f2', '--purple': '#a626a4', '--gray': '#a0a1a7',
    },
  },
  {
    id: 'A15', name: 'Catppuccin Latte',
    vars: {
      '--bg': '#eff1f5', '--bg-card': '#e6e9ef', '--bg-sunken': '#dce0e8',
      '--border': '#ccd0da', '--text': '#4c4f69', '--text-muted': '#9ca0b0',
      '--green': '#40a02b', '--red': '#d20f39', '--yellow': '#df8e1d',
      '--blue': '#1e66f5', '--purple': '#8839ef', '--gray': '#8c8fa1',
    },
  },
  {
    id: 'A16', name: 'Nord Light',
    vars: {
      '--bg': '#eceff4', '--bg-card': '#e5e9f0', '--bg-sunken': '#d8dee9',
      '--border': '#aec0d4', '--text': '#2e3440', '--text-muted': '#4c566a',
      '--green': '#a3be8c', '--red': '#bf616a', '--yellow': '#d08770',
      '--blue': '#5e81ac', '--purple': '#b48ead', '--gray': '#7b88a0',
    },
  },
  {
    id: 'A17', name: 'Paper',
    vars: {
      '--bg': '#f5f0e8', '--bg-card': '#ece8e0', '--bg-sunken': '#e0dbd2',
      '--border': '#c4bdb0', '--text': '#2c2420', '--text-muted': '#7a7068',
      '--green': '#4a7a30', '--red': '#b03020', '--yellow': '#9a7520',
      '--blue': '#3060a0', '--purple': '#783070', '--gray': '#8a8078',
    },
  },
  {
    id: 'A18', name: 'Sepia',
    vars: {
      '--bg': '#f2e8d0', '--bg-card': '#e8dec4', '--bg-sunken': '#ddd0b4',
      '--border': '#c4ae88', '--text': '#3e2c18', '--text-muted': '#7a6040',
      '--green': '#4a7028', '--red': '#9e3018', '--yellow': '#9a6c18',
      '--blue': '#285880', '--purple': '#783070', '--gray': '#8a7050',
    },
  },
  {
    id: 'A19', name: 'Everforest Light',
    vars: {
      '--bg': '#fdf6e3', '--bg-card': '#f4ead3', '--bg-sunken': '#ebe0c7',
      '--border': '#d4c8a8', '--text': '#5c6a72', '--text-muted': '#829181',
      '--green': '#8da101', '--red': '#f85552', '--yellow': '#dfa000',
      '--blue': '#3a94c5', '--purple': '#df69ba', '--gray': '#939f91',
    },
  },
  {
    id: 'A20', name: 'Ayu Light',
    vars: {
      '--bg': '#fafafa', '--bg-card': '#f3f4f5', '--bg-sunken': '#eaebec',
      '--border': '#dfe1e3', '--text': '#575f66', '--text-muted': '#abb0b6',
      '--green': '#86b300', '--red': '#f07171', '--yellow': '#f29718',
      '--blue': '#399ee6', '--purple': '#a37acc', '--gray': '#828c99',
    },
  },
  {
    id: 'A21', name: 'Rosé Pine Dawn',
    vars: {
      '--bg': '#faf4ed', '--bg-card': '#fffaf3', '--bg-sunken': '#f2e9e1',
      '--border': '#dfdad9', '--text': '#575279', '--text-muted': '#9893a5',
      '--green': '#286983', '--red': '#b4637a', '--yellow': '#ea9d34',
      '--blue': '#56949f', '--purple': '#907aa9', '--gray': '#9893a5',
    },
  },

  // ── Earthy / Warm ────────────────────────────────────────────────────────────
  {
    id: 'A22', name: 'Olive',
    vars: {
      '--bg': '#f4f0e4', '--bg-card': '#eae6d8', '--bg-sunken': '#dedad0',
      '--border': '#c0bba8', '--text': '#38342a', '--text-muted': '#787060',
      '--green': '#5c7a28', '--red': '#a83828', '--yellow': '#8a6a10',
      '--blue': '#3a5a80', '--purple': '#703870', '--gray': '#848070',
    },
  },
  {
    id: 'A23', name: 'Kanagawa',
    vars: {
      '--bg': '#1f1f28', '--bg-card': '#2a2a37', '--bg-sunken': '#16161d',
      '--border': '#363646', '--text': '#dcd7ba', '--text-muted': '#727169',
      '--green': '#76946a', '--red': '#c34043', '--yellow': '#c0a36e',
      '--blue': '#7e9cd8', '--purple': '#957fb8', '--gray': '#54546d',
    },
  },
  {
    id: 'A24', name: 'Everforest Dark',
    vars: {
      '--bg': '#2d353b', '--bg-card': '#343f44', '--bg-sunken': '#272e33',
      '--border': '#4a555b', '--text': '#d3c6aa', '--text-muted': '#7a8478',
      '--green': '#a7c080', '--red': '#e67e80', '--yellow': '#dbbc7f',
      '--blue': '#7fbbb3', '--purple': '#d699b6', '--gray': '#5c6a72',
    },
  },
  {
    id: 'A25', name: 'Zenburn',
    vars: {
      '--bg': '#3f3f3f', '--bg-card': '#4f4f4f', '--bg-sunken': '#2f2f2f',
      '--border': '#6f6f6f', '--text': '#dcdccc', '--text-muted': '#9f9f8f',
      '--green': '#7f9f7f', '--red': '#cc9393', '--yellow': '#f0dfaf',
      '--blue': '#8cd0d3', '--purple': '#dc8cc3', '--gray': '#808080',
    },
  },
  {
    id: 'A26', name: 'Autumn',
    vars: {
      '--bg': '#1e160e', '--bg-card': '#2a2016', '--bg-sunken': '#160e08',
      '--border': '#503828', '--text': '#e0c090', '--text-muted': '#9a7848',
      '--green': '#78a838', '--red': '#c85030', '--yellow': '#d09820',
      '--blue': '#5880a0', '--purple': '#9868a0', '--gray': '#6a5030',
    },
  },
  {
    id: 'A27', name: 'Coffee',
    vars: {
      '--bg': '#1c1410', '--bg-card': '#281e18', '--bg-sunken': '#140c08',
      '--border': '#4a3020', '--text': '#d8c8b0', '--text-muted': '#8a7058',
      '--green': '#80a848', '--red': '#c84830', '--yellow': '#c09038',
      '--blue': '#6080a8', '--purple': '#9868a0', '--gray': '#685040',
    },
  },
  {
    id: 'A28', name: 'Terracotta',
    vars: {
      '--bg': '#1e1510', '--bg-card': '#2a1e16', '--bg-sunken': '#160e0a',
      '--border': '#4a2e20', '--text': '#e0c8b0', '--text-muted': '#9a7868',
      '--green': '#789040', '--red': '#c84830', '--yellow': '#c09040',
      '--blue': '#5878a0', '--purple': '#8868a0', '--gray': '#6a5040',
    },
  },
  {
    id: 'A29', name: 'Forest Dark',
    vars: {
      '--bg': '#161e18', '--bg-card': '#1e2820', '--bg-sunken': '#101610',
      '--border': '#2e4030', '--text': '#c0d8c0', '--text-muted': '#6a8870',
      '--green': '#68b060', '--red': '#d06050', '--yellow': '#c0a040',
      '--blue': '#5090a0', '--purple': '#9070a0', '--gray': '#507050',
    },
  },

  // ── Unique / Vivid ───────────────────────────────────────────────────────────
  {
    id: 'A30', name: 'Ayu Dark',
    vars: {
      '--bg': '#0d1017', '--bg-card': '#131721', '--bg-sunken': '#090d13',
      '--border': '#1d2433', '--text': '#bfbdb6', '--text-muted': '#5c6773',
      '--green': '#aad94c', '--red': '#f26d78', '--yellow': '#e6b450',
      '--blue': '#59c2ff', '--purple': '#d2a6ff', '--gray': '#3d4751',
    },
  },
  {
    id: 'A31', name: 'Ayu Mirage',
    vars: {
      '--bg': '#1f2430', '--bg-card': '#242b38', '--bg-sunken': '#191e29',
      '--border': '#33415e', '--text': '#cccac2', '--text-muted': '#607080',
      '--green': '#bae67e', '--red': '#ff3333', '--yellow': '#ffd580',
      '--blue': '#73d0ff', '--purple': '#d4bfff', '--gray': '#48566a',
    },
  },
  {
    id: 'A32', name: 'Horizon',
    vars: {
      '--bg': '#1c1e26', '--bg-card': '#232530', '--bg-sunken': '#16181f',
      '--border': '#2e303e', '--text': '#d5d8da', '--text-muted': '#6c6f93',
      '--green': '#29d398', '--red': '#e95678', '--yellow': '#fab795',
      '--blue': '#26bbd9', '--purple': '#ee64ac', '--gray': '#6c6f93',
    },
  },
  {
    id: 'A33', name: 'Moonlight',
    vars: {
      '--bg': '#222436', '--bg-card': '#2f334d', '--bg-sunken': '#1b1d2e',
      '--border': '#444a73', '--text': '#c8d3f5', '--text-muted': '#636da6',
      '--green': '#c3e88d', '--red': '#ff757f', '--yellow': '#ffc777',
      '--blue': '#82aaff', '--purple': '#c099ff', '--gray': '#545c7e',
    },
  },
  {
    id: 'A34', name: 'Material Ocean',
    vars: {
      '--bg': '#0f111a', '--bg-card': '#181a22', '--bg-sunken': '#090b11',
      '--border': '#1f2233', '--text': '#8f93a2', '--text-muted': '#464b5d',
      '--green': '#c3e88d', '--red': '#f07178', '--yellow': '#ffcb6b',
      '--blue': '#82aaff', '--purple': '#c792ea', '--gray': '#464b5d',
    },
  },
  {
    id: 'A35', name: 'Rosé Pine Moon',
    vars: {
      '--bg': '#232136', '--bg-card': '#2a273f', '--bg-sunken': '#191724',
      '--border': '#393552', '--text': '#e0def4', '--text-muted': '#6e6a86',
      '--green': '#3e8fb0', '--red': '#eb6f92', '--yellow': '#f6c177',
      '--blue': '#9ccfd8', '--purple': '#c4a7e7', '--gray': '#59546d',
    },
  },
  {
    id: 'A36', name: 'Dusk',
    vars: {
      '--bg': '#1e1828', '--bg-card': '#28203a', '--bg-sunken': '#161020',
      '--border': '#3a2c50', '--text': '#d8c8e8', '--text-muted': '#886898',
      '--green': '#70b870', '--red': '#d85878', '--yellow': '#d8a858',
      '--blue': '#70a8d8', '--purple': '#b878d8', '--gray': '#705880',
    },
  },
  {
    id: 'A37', name: 'Pastel',
    vars: {
      '--bg': '#fef6ff', '--bg-card': '#f8effe', '--bg-sunken': '#f0e4f8',
      '--border': '#ddc8f0', '--text': '#2c1a3a', '--text-muted': '#8068a0',
      '--green': '#2a8a50', '--red': '#c0305a', '--yellow': '#a07020',
      '--blue': '#3060c8', '--purple': '#8030c8', '--gray': '#9080a8',
    },
  },
  {
    id: 'A38', name: 'Alabaster',
    vars: {
      '--bg': '#f8f8f8', '--bg-card': '#ffffff', '--bg-sunken': '#eeeeee',
      '--border': '#dddddd', '--text': '#111111', '--text-muted': '#717171',
      '--green': '#008000', '--red': '#cc0000', '--yellow': '#cc8800',
      '--blue': '#0070cc', '--purple': '#7700cc', '--gray': '#888888',
    },
  },
  {
    id: 'A39', name: 'Slate Dark',
    vars: {
      '--bg': '#1a1a1a', '--bg-card': '#252525', '--bg-sunken': '#111111',
      '--border': '#383838', '--text': '#e0e0e0', '--text-muted': '#808080',
      '--green': '#4caf50', '--red': '#f44336', '--yellow': '#ffc107',
      '--blue': '#2196f3', '--purple': '#9c27b0', '--gray': '#616161',
    },
  },
  {
    id: 'A40', name: 'Cyberpunk',
    vars: {
      '--bg': '#0a0a12', '--bg-card': '#12121e', '--bg-sunken': '#06060e',
      '--border': '#1e1e30', '--text': '#e0e0ff', '--text-muted': '#6060a0',
      '--green': '#00ff80', '--red': '#ff0060', '--yellow': '#ffee00',
      '--blue': '#00c8ff', '--purple': '#cc00ff', '--gray': '#4040a0',
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

const DEFAULT_ID = 'A27'

export function initColorScheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  const scheme = saved ? COLOR_SCHEMES.find(s => s.id === saved) : undefined
  applyScheme(scheme ?? COLOR_SCHEMES.find(s => s.id === DEFAULT_ID) ?? COLOR_SCHEMES[0])
}

export function useColorScheme() {
  const [index, setIndex] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const found = saved ? COLOR_SCHEMES.findIndex(s => s.id === saved) : -1
    if (found >= 0) return found
    return COLOR_SCHEMES.findIndex(s => s.id === DEFAULT_ID)
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
