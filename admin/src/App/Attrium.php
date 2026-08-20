<?php

namespace Attrium\App;

use Attrium\Settings\Settings;
use Attrium\Utility\Menu;
use Attrium\Utility\Scripts;

defined('ABSPATH') || exit();

class Attrium {
    public function __construct() {
        if ( isset($_GET['attrium']) && 'off' === sanitize_key( wp_unslash( $_GET['attrium'] ) ) ) {
            return;
        }

        add_action('admin_enqueue_scripts', [ $this, 'suppress_wp_command_palette' ], 0);
        add_action('admin_enqueue_scripts', [ $this, 'load_styles' ], 1);
        add_action('admin_enqueue_scripts', [ $this, 'load_base_scripts' ], 1);
        // Output on in_admin_header (not admin_head) so menu-header.php has
        // already resolved $parent_file/$submenu_file (including the
        // parent_file/submenu_file filters) before we read them below.
        add_action('in_admin_header', [ $this, 'output_data_attributes' ], 0);
        add_action('in_admin_header', [ $this, 'build_attrium' ], 1);
    }

    /**
     * Whether the current screen should get the attrium overlay.
     *
     * The block editor and site editor manage their own full-screen layout,
     * so we leave them alone to keep those
     * pages working while we embed the default admin pages everywhere else.
     */
    private static function is_overlay_screen(): bool {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;

        if ( ! $screen ) {
            return true;
        }

        if ( method_exists($screen, 'is_block_editor') && $screen->is_block_editor() ) {
            return false;
        }

        if ( isset($screen->id) && in_array($screen->id, [ 'site-editor', 'customize' ], true) ) {
            return false;
        }

        return true;
    }

    /**
     * Whether the given screen is a page registered by a plugin/theme via
     * add_menu_page()/add_submenu_page() (as opposed to a WordPress core admin
     * screen). WordPress builds the screen id from the page's hook suffix:
     * top-level pages get 'toplevel_page_{slug}' and submenu pages get
     * '{parent-hook}_page_{slug}'. Core screens (edit, options-general, plugins,
     * …) map to real PHP files and never contain '_page_', so that marker
     * reliably distinguishes both top-level and submenu plugin pages.
     */
    private static function is_plugin_screen( $screen ): bool {
        if ( ! $screen || ! isset($screen->id) ) {
            return false;
        }

        // Attrium's own screens are not third-party plugin pages.
        if ( str_contains($screen->id, 'attrium') ) {
            return false;
        }

        return str_starts_with($screen->id, 'toplevel_page_')
            || str_contains($screen->id, '_page_');
    }

    /**
     * Remove WordPress 7.0's native command palette on overlay screens.
     *
     * Core enqueues @wordpress/commands via wp_enqueue_command_palette_assets()
     * on admin_enqueue_scripts (priority 10), and it binds Cmd+K — the same
     * shortcut Attrium's own palette uses. Running at priority 0 lets us drop
     * the core callback before it fires. The block/site editor pull wp-commands
     * in as a script dependency (not via this function) and are not overlay
     * screens anyway, so their palette is untouched.
     */
    public function suppress_wp_command_palette(): void {
        if ( ! self::is_overlay_screen() ) {
            return;
        }

        remove_action('admin_enqueue_scripts', 'wp_enqueue_command_palette_assets');
    }

    public function load_styles(): void {
        if ( ! self::is_overlay_screen() ) {
            return;
        }

        $css_file = Scripts::get_build_css('src/main.ts');

        if ( ! $css_file ) {
            return;
        }

        $style = ATTRIUM_URL . 'app/dist/' . $css_file;
        wp_enqueue_style('attrium', $style, [], ATTRIUM_VERSION);
    }

    public function load_base_scripts(): void {
        if ( ! self::is_overlay_screen() ) {
            return;
        }

        $build_file = Scripts::get_build_file('src/main.ts');

        if ( ! $build_file ) {
            return;
        }

        $file = ATTRIUM_URL . 'app/dist/' . $build_file;
        wp_print_script_tag(
            [
				'id'   => 'attrium-app-js',
				'type' => 'module',
				'src'  => $file,
			]
        );
    }

    public function output_data_attributes(): void {
        if ( ! self::is_overlay_screen() ) {
            return;
        }

        $rest_base  = get_rest_url();
        $rest_nonce = wp_create_nonce('wp_rest');
        $admin_url  = get_admin_url();
        $site_url   = get_site_url();

        $current_user = wp_get_current_user();
        $user_name    = $current_user->display_name;
        $user_mail    = $current_user->user_email;
        $can_manage   = current_user_can('manage_options') ? 'true' : 'false';

        // The user's WordPress avatar exactly as wp-admin renders it. We use
        // get_avatar() (and extract its src) rather than get_avatar_url()
        // because get_avatar_url() bypasses 'get_avatar' filters that themes
        // and plugins use to swap in custom uploaded avatars. 96px keeps it
        // sharp at 2x on the sidebar slot.
        $user_avatar = '';
        if ( preg_match( '/src=["\']([^"\']+)["\']/', (string) get_avatar( $current_user->ID, 96 ), $matches ) ) {
            // get_avatar() escapes & as &#038;; decode so the raw pass below
            // (see logout-url/avatar-url note) encodes exactly once.
            $user_avatar = html_entity_decode( $matches[1], ENT_QUOTES );
        }

        // Per-type create capabilities so the header "+" menu only offers what
        // the current user may actually create. edit_posts/edit_pages are the
        // standard create caps; manage_options is too strict (editors create
        // pages without it).
        $can_create_posts = current_user_can('edit_posts') ? 'true' : 'false';
        $can_create_pages = current_user_can('edit_pages') ? 'true' : 'false';

        // Screen id lets the client swap the slotted WP content for a native
        // Attrium view (e.g. 'dashboard'). Keep this minimal — a single id is
        // enough to branch on; richer screen data can be added when needed.
        $screen    = function_exists('get_current_screen') ? get_current_screen() : null;
        $screen_id = $screen && isset($screen->id) ? $screen->id : '';

        // The active top-level and submenu item, exactly as WordPress resolves
        // them in menu-header.php. Page files set these globals (e.g. edit.php
        // sets "edit.php?post_type=..." for CPT lists), then menu-header.php
        // applies the parent_file/submenu_file filters — which is why this
        // method runs on in_admin_header. The sidebar highlights by comparing
        // its item/child slugs against these values, matching core exactly.
        $parent_file  = isset($GLOBALS['parent_file']) ? (string) $GLOBALS['parent_file'] : '';
        $submenu_file = isset($GLOBALS['submenu_file']) ? (string) $GLOBALS['submenu_file'] : '';

        // Plugin pages (admin.php?page=X) never set $submenu_file; core's
        // menu-header.php falls back to comparing $plugin_page against the
        // submenu slugs. Mirror that so the plugin page itself highlights.
        if ( '' === $submenu_file && isset($GLOBALS['plugin_page']) && $GLOBALS['plugin_page'] ) {
            $submenu_file = (string) $GLOBALS['plugin_page'];
        }

        // edit-tags.php escapes the query string with &amp; for post_type
        // taxonomies; the menu slug itself uses a bare &. Normalize so the
        // exact slug comparison on the client can match.
        $parent_file  = html_entity_decode($parent_file, ENT_QUOTES);
        $submenu_file = html_entity_decode($submenu_file, ENT_QUOTES);

        $menu_items = Menu::get_items();

        $logout_url     = html_entity_decode( wp_logout_url(), ENT_QUOTES );
        $is_ignored     = Settings::is_ignored_url() ? 'true' : 'false';
        $is_plugin_page = self::is_plugin_screen($screen) ? 'true' : 'false';

        // logout-url and avatar-url contain query strings with &, so they must NOT
        // go through esc_url here: wp_print_script_tag runs esc_attr on every
        // attribute itself, and esc_url's &#038; would be double-encoded into
        // a literal '&#038;' in the DOM attribute that the browser treats as a
        // fragment start, truncating the query string.
        $scripts_tag = [
            'id'               => 'attrium-data',
            'type'             => 'module',
            'rest-base'        => esc_url($rest_base),
            'rest-nonce'       => esc_attr($rest_nonce),
            'admin-url'        => esc_url($admin_url),
            'logout-url'       => $logout_url,
            'site-url'         => esc_url($site_url),
            'user-name'        => esc_attr($user_name),
            'user-email'       => esc_attr($user_mail),
            'avatar-url'       => $user_avatar,
            'can-manage'       => esc_attr($can_manage),
            'can-create-posts' => esc_attr($can_create_posts),
            'can-create-pages' => esc_attr($can_create_pages),
            'screen-id'        => esc_attr($screen_id),
            'menu'             => wp_json_encode($menu_items),
            'parent-file'      => esc_attr($parent_file),
            'submenu-file'     => esc_attr($submenu_file),
            'plugin-version'   => esc_attr(ATTRIUM_VERSION),
            'plugin-base'      => esc_url(ATTRIUM_URL),
            'is-ignored'       => esc_attr($is_ignored),
            'is-plugin-page'   => esc_attr($is_plugin_page),
        ];

        wp_print_script_tag($scripts_tag);
    }

    public function build_attrium(): void {
        if ( ! self::is_overlay_screen() ) {
            return;
        }

        if ( ! Scripts::get_build_file('src/main.ts') ) {
            return;
        }

        // Embed the default WordPress admin pages using a shadow DOM slot:
        // #wpcontent is moved into #attrium-host (light DOM child) and
        // projected into the SidebarInset content card via <slot>. The
        // SidebarProvider handles the gray background, the Sidebar (inset
        // variant) handles padding, and SidebarInset handles the card
        // margins/rounded corners. We only need to hide the old WP chrome.
        echo "<style id='attrium-overlay-css'>
        #wpadminbar{opacity:0!important;pointer-events:none!important}
        #adminmenumain,#wpwrap{display:none !important}
        #wpcontent{margin-left:0 !important}
        #wpfooter{display:none !important}
        </style>";

        // Temporary FOUC hider: hides everything until #attrium-host exists
        // and the Vue app has moved #wpcontent into it, then main.ts removes
        // this style so the slotted content shows through.
        echo "<style id='attrium-body-hider'>body > *:not(#attrium-host){display:none}</style>";

        // Bootstrap watchdog (inline, non-module — runs regardless of module
        // loading). If the Vue bootstrap hasn't cleared this within 5 seconds,
        // something went wrong: tear down Attrium so the original WP admin
        // reappears instead of leaving the user staring at a blank screen.
        // main.ts calls clearTimeout(window.__ATTRIUM_WATCHDOG__) on every
        // successful path; the timeout reaching zero is always a failure.
        //
        // 5s is a deliberately generous ceiling: a healthy boot clears this in
        // well under a second, so the only way to reach it is a genuine failure
        // (missing/404 bundle, JS error, stale manifest) on even a slow admin.
        // The console.error is the only signal the user gets that the watchdog
        // tore Attrium down — keep it so field failures are debuggable.
        echo "<script>
        window.__ATTRIUM_WATCHDOG__ = setTimeout(function(){
            console.error('[Attrium] Bootstrap watchdog fired after 5s — Vue app did not initialise. Removing overlay so WordPress admin remains usable.');
            var oe = document.getElementById('attrium-overlay-css');
            if(oe) oe.remove();
            var be = document.getElementById('attrium-body-hider');
            if(be) be.remove();
            var h = document.getElementById('attrium-host');
            if(h) h.remove();
        }, 5000);
        </script>";
    }
}
