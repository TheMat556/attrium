import {
  type LucideIcon,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  Plug,
  MessageSquare,
  Palette,
  Menu,
  ShoppingCart,
  Globe,
  Archive,
  Image,
  Link,
  File,
  Edit3,
  type Icon,
} from '@lucide/vue'

const iconMap: Record<string, LucideIcon | typeof Icon> = {
  'dashicons-dashboard': LayoutDashboard,
  'dashicons-admin-post': FileText,
  'dashicons-admin-page': File,
  'dashicons-admin-appearance': Palette,
  'dashicons-admin-plugins': Plug,
  'dashicons-admin-users': Users,
  'dashicons-admin-settings': Settings,
  'dashicons-admin-comments': MessageSquare,
  'dashicons-admin-media': Image,
  'dashicons-admin-links': Link,
  'dashicons-admin-generic': FileText,
  'dashicons-admin-tools': Settings,
  'dashicons-admin-customizer': Edit3,
  'dashicons-menu': Menu,
  'dashicons-menu-alt': Menu,
  'dashicons-menu-alt2': Menu,
  'dashicons-menu-alt3': Menu,
  'dashicons-cart': ShoppingCart,
  'dashicons-translation': Globe,
  'dashicons-archive': Archive,
}

export function getIcon(dashicon: string): LucideIcon | typeof Icon {
  return iconMap[dashicon] || FileText
}
