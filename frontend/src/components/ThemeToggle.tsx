import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore } from '../store/theme'
import { Button } from './ui/button'

const LABEL = { light: 'Hell', dark: 'Dunkel', system: 'System' } as const

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const cycle = useThemeStore((s) => s.cycle)
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycle}
      title={`Design: ${LABEL[theme]} (klicken zum Wechseln)`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
