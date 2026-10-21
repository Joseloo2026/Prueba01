<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$dir = __DIR__ . DIRECTORY_SEPARATOR . 'assets';
$urls = [];
if (is_dir($dir)) {
  foreach (scandir($dir) as $file) {
    if ($file !== '.' && $file !== '..' && preg_match('/\.glb$/i', $file) && is_file($dir . DIRECTORY_SEPARATOR . $file)) {
      $urls[] = 'assets/' . rawurlencode($file);
    }
  }
}
echo json_encode($urls, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
