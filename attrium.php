<?php
/**
 * Plugin Name:     Attrium
 * Plugin URI:      https://www.hader.ovh/attrium
 * Description:     Modern WordPress admin theme built with Vue 3, Tailwind CSS
 * Version:         1.0.0
 * Author:          Matthias Hader
 * Text Domain:     attrium
 * Domain Path:     /languages
 * Requires PHP:    8.0
 * License:         GPLv2 or later
 */

defined('ABSPATH') || exit();

define('ATTRIUM_VERSION', '1.0.0');
define('ATTRIUM_PATH', plugin_dir_path(__FILE__));
define('ATTRIUM_URL', plugin_dir_url(__FILE__));

$autoloader = ATTRIUM_PATH . 'admin/vendor/autoload.php';
if ( file_exists($autoloader) ) {
    require_once $autoloader;
}

new Attrium\App\Attrium();
$attrium_module_registry = new Attrium\Modules\ModuleRegistry();
new Attrium\Modules\CustomizerSupport($attrium_module_registry);
new Attrium\Settings\Settings();
