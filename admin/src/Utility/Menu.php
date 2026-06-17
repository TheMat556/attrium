<?php

namespace Attrium\Utility;

defined('ABSPATH') || exit();

class Menu {
    public static function get_items() {
        global $menu, $submenu;

        if ( ! isset($menu) || ! is_array($menu) ) {
            return [];
        }

        $menu_items = [];

        foreach ( $menu as $item ) {
            if ( ! isset($item[0]) || ! $item[0] ) {
                continue;
            }

            // Skip separators and plugin.php?page=... entries
            if ( str_contains($item[2], 'separator') ) {
                continue;
            }

            $menu_slug = $item[2];
            $children  = [];

            if ( isset($submenu[ $menu_slug ]) && is_array($submenu[ $menu_slug ]) ) {
                foreach ( $submenu[ $menu_slug ] as $sub_item ) {
                    if ( ! isset($sub_item[0]) || ! $sub_item[0] ) {
                        continue;
                    }

                    // Skip "Attrium" submenu item to avoid recursion
                    if ( str_contains($sub_item[2], 'attrium') ) {
                        continue;
                    }

                    $children[] = [
                        'title' => self::clean_title($sub_item[0]),
                        'slug'  => $sub_item[2],
                        'url'   => self::get_admin_url($sub_item[2]),
                        'badge' => self::extract_badge($sub_item[0]),
                    ];
                }
            }

            $menu_items[] = [
                'title'    => self::clean_title($item[0]),
                'slug'     => $menu_slug,
                'url'      => self::get_admin_url($menu_slug),
                'icon'     => self::get_icon($item),
                'badge'    => self::extract_badge($item[0]),
                'children' => $children,
            ];
        }

        return $menu_items;
    }

    private static function clean_title( $raw ) {
        $title = $raw;

        $tag_pos = strpos($raw, '<');
        if ( $tag_pos !== false ) {
            $title = substr($raw, 0, $tag_pos);
        }

        $title = preg_replace('/<[^>]*>/', '', $title);

        return trim(html_entity_decode($title, ENT_QUOTES));
    }

    private static function extract_badge( $raw ) {
        if ( preg_match('/\bcount-(\d+)\b/', $raw, $matches) ) {
            $count = (int) $matches[1];

            return $count > 0 ? (string) $count : '';
        }

        return '';
    }

    private static function get_admin_url( $slug ) {
        if ( str_contains($slug, '.php') ) {
            return admin_url($slug);
        }

        return admin_url('admin.php?page=' . $slug);
    }

    private static function get_icon( $item ) {
        if ( isset($item[6]) && $item[6] ) {
            return $item[6];
        }

        if ( isset($item[4]) && $item[4] ) {
            preg_match('/dashicons-([a-z0-9-]+)/', $item[4], $matches);
            if ( isset($matches[1]) ) {
                return 'dashicons-' . $matches[1];
            }
        }

        return 'dashicons-admin-generic';
    }
}
