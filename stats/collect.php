<?php
declare(strict_types=1);

// Counts page views and clicks without cookies and without personal data (see privacy/, section 4).
// Stores one line per event: date, kind, page, event name, language, referrer domain.
// No IP address, no user agent, no time of day, no identifier.
// Off until a folder mko-private/stats/ exists outside the web root (see deploy/stats-setup.md).

ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const MAX_BODY = 1000;
const MAX_FILE = 2000000; // bytes per month; a flood fills this and then stops

function done(int $code = 204, ?string $body = null): never
{
    http_response_code($code);
    if ($body !== null) {
        header('Content-Type: application/json; charset=utf-8');
        echo $body;
    }
    exit;
}

function stats_dir(): ?string
{
    $file = '/mko-private/stats';
    if (($env = getenv('MKO_STATS_DIR')) !== false && $env !== '') {
        return is_dir($env) ? rtrim($env, '/\\') : null; // explicit setting wins (used by the tests)
    }
    $list = [dirname(__DIR__, 2) . $file];
    foreach ([getenv('HOME') ?: '', $_SERVER['HOME'] ?? ''] as $home) {
        if (is_string($home) && $home !== '') {
            $list[] = rtrim($home, '/') . $file;
        }
    }
    if (function_exists('posix_getpwuid') && function_exists('posix_geteuid')) {
        $pw = @posix_getpwuid(posix_geteuid());
        if (is_array($pw) && !empty($pw['dir'])) {
            $list[] = rtrim($pw['dir'], '/') . $file;
        }
    }
    $name = basename(dirname(__DIR__));
    if ($name !== '' && $name !== '.' && $name !== '/') {
        $list[] = '/usr/home/' . $name . $file;
    }
    foreach (array_unique($list) as $dir) {
        if (@is_dir($dir) && is_writable($dir)) {
            return $dir;
        }
    }
    return null;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$dir = stats_dir();

if ($method === 'GET' && isset($_GET['status'])) {
    done(200, json_encode(['enabled' => $dir !== null]));
}
if ($method !== 'POST' || $dir === null) {
    done();
}

// Robots and link previews are not visitors.
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
if ($ua === '' || preg_match('/bot|crawl|spider|slurp|headless|preview|fetch|curl|wget|python|java|http|monitor/i', $ua)) {
    done();
}

$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($raw === false || strlen($raw) > MAX_BODY) {
    done();
}
$d = json_decode($raw, true);
if (!is_array($d)) {
    done();
}

$kind = $d['k'] ?? null;
$path = $d['p'] ?? null;
$name = $d['n'] ?? '';
$lang = $d['l'] ?? '';
$ref = $d['r'] ?? '';

if (!in_array($kind, ['view', 'click'], true)) {
    done();
}
if (!is_string($path) || !preg_match('#^/[A-Za-z0-9/_.-]{0,80}$#', $path)) {
    done();
}
if (!is_string($name) || ($kind === 'click' ? !preg_match('/^[a-z0-9._-]{1,60}$/', $name) : $name !== '')) {
    done();
}
if (!in_array($lang, ['de', 'en', 'pt'], true)) {
    $lang = '';
}
if (!is_string($ref) || !preg_match('/^[a-z0-9.-]{1,80}$/i', $ref)) {
    $ref = '';
}
$ref = strtolower($ref);

$line = implode("\t", [gmdate('Y-m-d'), $kind, $path, $name, $lang, $ref]) . "\n";
$file = $dir . '/' . gmdate('Y-m') . '.tsv';
if (@filesize($file) > MAX_FILE) {
    done();
}
@file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
done();
