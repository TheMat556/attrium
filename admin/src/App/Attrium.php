<?php

namespace Attrium\App;

use Attrium\Utility\Menu;
use Attrium\Utility\Scripts;

defined('ABSPATH') || exit();

class Attrium {
    public function __construct() {
        if ( isset($_GET['attrium']) && $_GET['attrium'] === 'off' ) {
            return;
        }

        add_action('admin_enqueue_scripts', [ $this, 'load_styles' ], 1);
        add_action('admin_enqueue_scripts', [ $this, 'load_base_scripts' ], 1);
        add_action('admin_head', [ $this, 'output_data_attributes' ], 0);
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

        // Screen id lets the client swap the slotted WP content for a native
        // Attrium view (e.g. 'dashboard'). Keep this minimal — a single id is
        // enough to branch on; richer screen data can be added when needed.
        $screen    = function_exists('get_current_screen') ? get_current_screen() : null;
        $screen_id = $screen && isset($screen->id) ? $screen->id : '';

        $menu_items = Menu::get_items();

        $scripts_tag = [
            'id'             => 'attrium-data',
            'type'           => 'module',
            'rest-base'      => esc_url($rest_base),
            'rest-nonce'     => esc_attr($rest_nonce),
            'admin-url'      => esc_url($admin_url),
            'site-url'       => esc_url($site_url),
            'user-name'      => esc_attr($user_name),
            'user-email'     => esc_attr($user_mail),
            'can-manage'     => esc_attr($can_manage),
            'screen-id'      => esc_attr($screen_id),
            'menu'           => wp_json_encode($menu_items),
            'plugin-version' => esc_attr(ATTRIUM_VERSION),
            'plugin-base'    => esc_url(ATTRIUM_URL),
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
        #wpadminbar,#adminmenumain,#wpwrap{display:none !important}
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
