export function useTheme() {
  const isDark = (): boolean => {
    return (
      localStorage.getItem('attrium-theme') === 'dark' ||
      (!localStorage.getItem('attrium-theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    )
  }

  const toggle = (): void => {
    const newTheme = isDark() ? 'light' : 'dark'
    localStorage.setItem('attrium-theme', newTheme)
    applyDark(newTheme === 'dark')
  }

  return { isDark, toggle }
}

const darkModeStyles = `
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}`

export function applyDark(dark: boolean): void {
  const host = document.getElementById('attrium-host')
  if (!host) return

  const shadow = host.shadowRoot
  if (!shadow) return

  // Toggle class on shadow host
  if (dark) {
    shadow.host.classList.add('dark')
  } else {
    shadow.host.classList.remove('dark')
  }

  // Inject dark mode CSS variables into shadow DOM stylesheet
  let darkStyle = shadow.querySelector('#attrium-dark-style') as HTMLStyleElement | null
  if (dark) {
    if (!darkStyle) {
      darkStyle = document.createElement('style')
      darkStyle.id = 'attrium-dark-style'
      shadow.appendChild(darkStyle)
    }
    darkStyle.textContent = darkModeStyles
  } else if (darkStyle) {
    darkStyle.remove()
  }
}
