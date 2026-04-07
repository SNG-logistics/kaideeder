<?php
/**
 * delivery.kaideeder.com — Smart Redirect to Delivery Portal
 *
 * Upload this index.php to the root of delivery.kaideeder.com on Hostinger
 * Path: public_html/index.php
 *
 * This file handles:
 *  - Root visit → redirect to main delivery page
 *  - /track/[orderId] → redirect to order tracking
 *  - Any other path → redirect to main delivery page
 */

define('MAIN_DOMAIN', 'https://kaideeder.com');
define('TENANT_CODE', 'kaideeder');
define('DELIVERY_BASE', MAIN_DOMAIN . '/d/' . TENANT_CODE);

// Get the request path (strip leading slash)
$path = trim($_SERVER['REQUEST_URI'] ?? '/', '/');
$path = strtok($path, '?'); // Remove query string

// ── Route mapping ─────────────────────────────────────────────
if ($path === '' || $path === 'index.php') {
    // delivery.kaideeder.com/ → kaideeder.com/d/kaideeder
    $target = DELIVERY_BASE;

} elseif (preg_match('/^track\/([a-z0-9]+)$/i', $path, $m)) {
    // delivery.kaideeder.com/track/ORDER_ID → kaideeder.com/d/kaideeder/track/ORDER_ID
    $orderId = htmlspecialchars($m[1], ENT_QUOTES, 'UTF-8');
    $target = DELIVERY_BASE . '/track/' . $orderId;

} else {
    // Catch-all → main delivery page
    $target = DELIVERY_BASE;
}

// Preserve query string if present
$qs = $_SERVER['QUERY_STRING'] ?? '';
if ($qs) $target .= '?' . $qs;

// 301 Permanent redirect
header('Location: ' . $target, true, 301);
header('Cache-Control: no-cache');
exit;
