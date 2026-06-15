export interface ServerData {
  restBase: string
  restNonce: string
  adminUrl: string
  siteUrl: string
  userName: string
  userEmail: string
  canManage: boolean
  currentScreen: Record<string, string> | null
  pluginVersion: string
  pluginBase: string
}

export function useServerData(): ServerData {
  const el = document.getElementById('attrium-data')

  const get = (attr: string, fallback = ''): string => {
    return el?.getAttribute(attr) || fallback
  }

  return {
    restBase: get('rest-base'),
    restNonce: get('rest-nonce'),
    adminUrl: get('admin-url'),
    siteUrl: get('site-url'),
    userName: get('user-name'),
    userEmail: get('user-email'),
    canManage: get('can-manage') === 'true',
    currentScreen: parseJson(get('current-screen')),
    pluginVersion: get('plugin-version'),
    pluginBase: get('plugin-base'),
  }
}

function parseJson(str: string): Record<string, string> | null {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}
