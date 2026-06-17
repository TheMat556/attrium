<?php

namespace Attrium\App;
use Attrium\Utility\Menu;
use Attrium\Utility\Scripts;

defined("ABSPATH") || exit();

class Attrium {
    public function __construct() {
        if (isset($_GET['attrium']) && $_GET['attrium'] === 'off') {
            return;
        }

        add_action('admin_enqueue_scripts', [$this, 'load_styles'], 1);
        add_action('admin_enqueue_scripts', [$this, 'load_base_scripts'], 1);
        add_action('admin_head', [$this, 'output_data_attributes'], 0);
        add_action('in_admin_header', [$this, 'build_attrium'], 1);
    }

    public function load_styles() {
        $css_file = Scripts::get_build_css('src/main.ts');

        if (!$css_file) {
            return;
        }

        $style = ATTRIUM_URL . 'app/dist/' . $css_file;
        wp_enqueue_style('attrium', $style, [], ATTRIUM_VERSION);
    }

    public function load_base_scripts() {
        $build_file = Scripts::get_build_file('src/main.ts');

        if (!$build_file) {
            return;
        }

        $file = ATTRIUM_URL . 'app/dist/' . $build_file;
        wp_print_script_tag([
            'id'    => 'attrium-app-js',
            'type'  => 'module',
            'src'   => $file
        ]);
    }

    public function output_data_attributes() {
        $rest_base  = get_rest_url();
        $rest_nonce = wp_create_nonce('wp_rest');
        $admin_url  = get_admin_url();
        $site_url   = get_site_url();

        $current_user   = wp_get_current_user();
        $user_name      = $current_user->display_name;
        $user_mail      = $current_user->user_email;
        $can_manage     = current_user_can('manage_options') ? 'true' : 'false';

        // Detect current admin screen for auto-navigation
        $current_screen = function_exists('get_current_screen') ? get_current_screen() : null;
        $screen_data = null;
        if ($current_screen) {
            $screen_data = [
                'base'      => $current_screen->base,
                'post_type' => $current_screen->post_type,
                'action'    => $current_screen->action,
                'id'        => $current_screen->id,
            ];
        }

        $menu_items = Menu::get_items();

        $scripts_tag = [
            'id'            => 'attrium-data',
            'type'          => 'module',
            'rest-base'     => esc_url($rest_base),
            'rest-nonce'    => esc_attr($rest_nonce),
            'admin-url'     => esc_url($admin_url),
            'site-url'      => esc_url($site_url),
            'user-name'     => esc_attr($user_name),
            'user-email'    => esc_attr($user_mail),
            'can-manage'    => esc_attr($can_manage),
            'current-screen'=> $screen_data ? wp_json_encode($screen_data) : '',
            'menu'          => wp_json_encode($menu_items),
            'plugin-version'=> esc_attr(ATTRIUM_VERSION),
            'plugin-base'   => esc_url(ATTRIUM_URL),
        ];

        wp_print_script_tag($scripts_tag);
    }

    public function build_attrium() {
        if (!Scripts::get_build_file('src/main.ts')) {
            return;
        }

        echo "<style id='attrium-body-hider'>
        html.wp-toolbar{padding:0!important}
        #wpadminbar{display:none!important}
        body > *:not(#attrium-host) {display:none}
        </style>";
    }
}
