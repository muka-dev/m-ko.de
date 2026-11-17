<?php
declare(strict_types=1);

// Call button: the phone number is not in any page. It is handed out only on a POST from this site,
// and the number itself lives in a config file outside the web root (see deploy/call-setup.md).
// Without that file the call button stays hidden. Nothing about the caller is stored; the only thing
// kept is a counter per hour that limits how often the number can be fetched.

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const MAX_BODY = 200;
const SITE_HOSTS = ['m-ko.de', 'www.m-ko.de'];

function out(int $code, array $data): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function config_candidates(): array
{
    $file = '/mko-private/call-config.php';
    if (($env = getenv('MKO_CALL_CONFIG')) !== false && $env !== '') {
        return [$env]; // explicit setting wins (used by the tests)
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
    return array_values(array_unique($list));
}

// Returns the config array or null. Never reveals a path or a value.
function load_config(): ?array
{
    foreach (config_candidates() as $path) {
        if (@is_file($path) && is_readable($path)) {
            try {
                $cfg = require $path;
            } catch (Throwable $e) {
                return null;
            }
            if (is_array($cfg) && isset($cfg['phone']) && is_string($cfg['phone'])
                && preg_match('/^\+?[0-9 ()\/-]{6,24}$/', $cfg['phone'])) {
                return $cfg;
            }
            return null;
        }
    }
    return null;
}

// The request must come from a page of this site.
function same_site(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return false;
    }
    $host = parse_url($origin, PHP_URL_HOST);
    $own = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
    $own = preg_replace('/:\d+$/', '', $own) ?? '';
    return is_string($host) && ($host === $own || in_array($host, SITE_HOSTS, true));
}

// A counter per hour, shared by everybody. When it is used up the button hides itself and the
// request form stays. Returns false when the limit is reached.
function within_limit(array $cfg): bool
{
    $limit = (int)($cfg['per_hour'] ?? 30);
    $dir = (string)($cfg['rate_dir'] ?? (sys_get_temp_dir() . '/mko-call'));
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return true; // cannot count, do not lock people out
    }
    $file = $dir . '/hour-' . gmdate('YmdH');
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return true;
    }
    flock($fh, LOCK_EX);
    $n = (int)stream_get_contents($fh);
    $ok = $n < $limit;
    if ($ok) {
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, (string)($n + 1));
    }
    flock($fh, LOCK_UN);
    fclose($fh);
    foreach (glob($dir . '/hour-*') ?: [] as $old) { // keep the folder tidy
        if ($old !== $file && @filemtime($old) < time() - 7200) {
            @unlink($old);
        }
    }
    return $ok;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$cfg = load_config();

if ($method === 'GET' && isset($_GET['status'])) {
    out(200, ['enabled' => $cfg !== null]);
}
if ($method !== 'POST') {
    out(405, ['error' => 'method']);
}
if ($cfg === null) {
    out(503, ['error' => 'disabled']);
}
if (!same_site()) {
    out(403, ['error' => 'origin']);
}
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
$body = is_string($raw) && strlen($raw) <= MAX_BODY ? json_decode($raw, true) : null;
if (!is_array($body) || ($body['reveal'] ?? null) !== true) {
    out(400, ['error' => 'request']);
}
if (!within_limit($cfg)) {
    out(429, ['error' => 'limit']);
}
out(200, ['tel' => $cfg['phone']]);
