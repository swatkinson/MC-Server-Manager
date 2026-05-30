import { useColorScheme } from '../hooks/useColorScheme'

export function ThemeSwitcher() {
  const { scheme, next } = useColorScheme()

  return (
    <button className="theme-switcher" onClick={next} title="Cycle colour scheme">
      <span className="theme-switcher__id">{scheme.id}</span>
      <span className="theme-switcher__name">{scheme.name}</span>
    </button>
  )
}
