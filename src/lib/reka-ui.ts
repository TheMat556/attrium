/**
 * reka-ui portal shim.
 *
 * The app mounts inside a shadow root (see main.ts). reka-ui's Portal/Teleport
 * defaults to `to="body"`, which renders dialogs, dropdowns and tooltips in the
 * light DOM — outside the shadow root, where our scoped styles do not apply and
 * the content is effectively invisible.
 *
 * reka-ui 2.9.x has no global portal config (no PortalProvider), so we cannot
 * redirect every portal from one place at runtime. Instead, Vite aliases the
 * bare `reka-ui` specifier to this file (see vite.config.ts). We re-export the
 * real package unchanged and override only the `*Portal` components with thin
 * wrappers that default `to` to the shadow-root portal container.
 *
 * Generated shadcn components keep importing from `"reka-ui"` untouched, so
 * regenerating them does not lose this behaviour, and reka-ui upgrades keep
 * working because the wrappers delegate to whatever the real portal is.
 */
import { defineComponent, h } from 'vue'
import * as Reka from '@reka-ui/original'

export * from '@reka-ui/original'

/** The portal container that lives inside the shadow root (set in main.ts). */
function shadowPortalTarget(): HTMLElement | string {
  if (typeof window !== 'undefined' && window.__ATTRIUM_PORTAL__) {
    return window.__ATTRIUM_PORTAL__
  }
  return 'body'
}

/**
 * Wrap a reka-ui `*Portal` component so its `to` prop defaults to the shadow
 * portal container. An explicit `to` passed by a caller still wins.
 */
function withShadowPortal(Original: unknown) {
  const Wrapped = Original as ReturnType<typeof defineComponent>

  return defineComponent({
    name: 'ShadowPortal',
    inheritAttrs: false,
    setup(_props, { slots, attrs }) {
      return () => {
        const to = (attrs as { to?: unknown }).to ?? shadowPortalTarget()
        return h(Wrapped, { ...attrs, to }, slots)
      }
    },
  })
}

// Every reka-ui `*Portal` export, wrapped so it teleports into the shadow root.
// These explicit named exports shadow the `export *` star re-export above.
export const AlertDialogPortal = withShadowPortal(Reka.AlertDialogPortal)
export const AutocompletePortal = withShadowPortal(Reka.AutocompletePortal)
export const ComboboxPortal = withShadowPortal(Reka.ComboboxPortal)
export const ContextMenuPortal = withShadowPortal(Reka.ContextMenuPortal)
export const DialogPortal = withShadowPortal(Reka.DialogPortal)
export const DropdownMenuPortal = withShadowPortal(Reka.DropdownMenuPortal)
export const HoverCardPortal = withShadowPortal(Reka.HoverCardPortal)
export const MenubarPortal = withShadowPortal(Reka.MenubarPortal)
export const PopoverPortal = withShadowPortal(Reka.PopoverPortal)
export const SelectPortal = withShadowPortal(Reka.SelectPortal)
export const ToastPortal = withShadowPortal(Reka.ToastPortal)
export const TooltipPortal = withShadowPortal(Reka.TooltipPortal)
