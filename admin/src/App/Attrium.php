<?php

namespace Attrium\App;

use Attrium\Utility\Menu;
use Attrium\Utility\Scripts;

defined('ABSPATH') || exit();

class Attrium {
    public function __construct() {
        if ( $this->is_iframe_request() ) {
            // Page is rendered inside the Attrium iframe. Hide WP's own chrome
            // server-side (before first paint) so it never flashes in the iframe.
            add_action('admin_head', [ $this, 'hide_chrome_in_iframe' ], 0);
            return;
        }

        add_action('admin_enqueue_scripts', [ $this, 'load_styles' ], 1);
        add_action('admin_enqueue_scripts', [ $this, 'load_base_scripts' ], 1);
        add_action('admin_head', [ $this, 'output_data_attributes' ], 0);
        add_action('in_admin_header', [ $this, 'build_attrium' ], 1);
    }

    /**
     * Whether the current request is rendered inside the Attrium iframe.
     *
     * Browsers tag every iframe-context request — initial load, in-iframe link
     * clicks, form POST responses and redirects — with `Sec-Fetch-Dest: iframe`.
     * Relying on that keeps the iframe chrome-less through form submits without
     * propagating a query flag, so it never boots a nested SPA inside itself.
     *
     * The legacy `?attrium=off` flag stays as a fallback for non-secure contexts
     * (plain HTTP, non-localhost) where the `Sec-Fetch-*` headers are not sent.
     */
    private function is_iframe_request() {
        if ( isset($_SERVER['HTTP_SEC_FETCH_DEST']) ) {
            $dest = sanitize_text_field(wp_unslash($_SERVER['HTTP_SEC_FETCH_DEST']));
            if ( $dest === 'iframe' ) {
                return true;
            }
        }

        return isset($_GET['attrium']) && $_GET['attrium'] === 'off';
    }

    /**
     * Print CSS that hides the WordPress admin bar, side menu and footer when
     * the page is loaded inside the Attrium iframe (?attrium=off). Printed in
     * admin_head so it applies before the body renders — no flash of WP chrome.
     */
    public function hide_chrome_in_iframe() {
        echo '<style id="attrium-iframe-chrome">'
            . '#wpadminbar{display:none!important;}'
            . '#adminmenumain,#adminmenuback,#adminmenuwrap,#adminmenu{display:none!important;}'
            . '#wpcontent,#wpfooter{margin-left:0!important;}'
            . 'html.wp-toolbar{padding-top:0!important;}'
            . '.folded #wpcontent,.folded #wpfooter{margin-left:0!important;}'
            . '@media (min-width:783px){#wpcontent{margin-left:0!important;padding-left:0!important;}}'
            . 'body{min-width:0!important;}'
            . '</style>';
    }

    public function load_styles() {
        $css_file = Scripts::get_build_css('src/main.ts');

        if ( ! $css_file ) {
            return;
        }

        $style = ATTRIUM_URL . 'app/dist/' . $css_file;
        wp_enqueue_style('attrium', $style, [], ATTRIUM_VERSION);
    }

    public function load_base_scripts() {
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

    public function output_data_attributes() {
        $rest_base  = get_rest_url();
        $rest_nonce = wp_create_nonce('wp_rest');
        $admin_url  = get_admin_url();
        $site_url   = get_site_url();

        $current_user = wp_get_current_user();
        $user_name    = $current_user->display_name;
        $user_mail    = $current_user->user_email;
        $can_manage   = current_user_can('manage_options') ? 'true' : 'false';

        // Detect current admin screen for auto-navigation
        $current_screen = function_exists('get_current_screen') ? get_current_screen() : null;
        $screen_data    = null;
        if ( $current_screen ) {
            $screen_data = [
                'base'      => $current_screen->base,
                'post_type' => $current_screen->post_type,
                'action'    => $current_screen->action,
                'id'        => $current_screen->id,
            ];
        }

        $menu_items = Menu::get_items();

        // Build the current admin page relative path (e.g. "edit.php?post_type=product").
        // Pass through every query param except Attrium's own control flags so
        // 3rd party plugin pages keep their sub-view params (tab, view, section, s, ...).
        global $pagenow;
        $current_page    = $pagenow ? $pagenow : '';
        $excluded_params = [ 'attrium' ];
        $query_parts     = [];
        foreach ( $_GET as $param => $value ) {
            if ( in_array($param, $excluded_params, true) ) {
                continue;
            }
            // Only flat scalar params are forwarded; nested arrays are skipped.
            if ( ! is_scalar($value) || $value === '' ) {
                continue;
            }
            // Preserve original key names; sanitize_key() lowercases and strips
            // characters, which breaks plugin pages relying on exact param keys.
            $raw_key = (string) wp_unslash($param);
            if ( $raw_key === '' ) {
                continue;
            }
            $query_parts[] = rawurlencode($raw_key) . '=' . rawurlencode( (string) wp_unslash($value));
        }
        if ( ! empty($query_parts) ) {
            $current_page .= '?' . implode('&', $query_parts);
        }

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
            'current-screen' => $screen_data ? wp_json_encode($screen_data) : '',
            'current-page'   => esc_attr($current_page),
            'menu'           => wp_json_encode($menu_items),
            'plugin-version' => esc_attr(ATTRIUM_VERSION),
            'plugin-base'    => esc_url(ATTRIUM_URL),
        ];

        wp_print_script_tag($scripts_tag);
    }

    public function build_attrium() {
        if ( ! Scripts::get_build_file('src/main.ts') ) {
            return;
        }

        echo "<style id='attrium-body-hider'>
        html.wp-toolbar{padding:0!important}
        #wpadminbar{display:none!important}
        body > *:not(#attrium-host) {display:none}
        </style>";
    }
}
