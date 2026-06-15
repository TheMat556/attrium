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

export function applyDark(dark: boolean): void {
  const host = document.getElementById('attrium-host')
  if (!host) return

  const shadow = host.shadowRoot
  if (!shadow) return

  if (dark) {
    shadow.host.classList.add('dark')
  } else {
    shadow.host.classList.remove('dark')
  }
}
