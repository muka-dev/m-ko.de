<?php
declare(strict_types=1);

// Request endpoint for people and AI agents: POST a JSON request, a human confirms by email.
// Switched on only when a config file exists outside the web root (see deploy/request-setup.md).
// Everything that arrives here is untrusted text and is forwarded as plain text only.

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

const MAX_BODY = 20000;
const SERVICES = ['ai-check', 'production-check', 'ai-pentest', 'agent-review', 'other'];
const RIGHTS = ['read', 'write', 'money-deletion-access', 'chains'];
const DATA = ['none', 'personal-one-org', 'sensitive-or-several-orgs', 'sensitive-several-orgs'];
const AUTONOMY = ['confirms-each-step', 'confirms-risky-steps', 'unattended', 'chains-agents'];

function out(int $code, array $data): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Places where the config file may be, in order. Shared hosting often shows PHP a different path
// than SFTP does (for example /usr/www/users/NAME for the web root but /usr/home/NAME for the home),
// so several candidates are tried.
function config_candidates(): array
{
    $file = '/mko-private/request-config.php';
    $list = [];
    if (($env = getenv('MKO_REQUEST_CONFIG')) !== false && $env !== '') {
        return [$env]; // explicit setting wins (used by the tests)
    }
    $list[] = dirname(__DIR__, 2) . $file;                       // one level above the web root
    foreach ([getenv('HOME') ?: '', $_SERVER['HOME'] ?? ''] as $home) {
        if (is_string($home) && $home !== '') {
            $list[] = rtrim($home, '/') . $file;                 // the account's home
        }
    }
    if (function_exists('posix_getpwuid') && function_exists('posix_geteuid')) {
        $pw = @posix_getpwuid(posix_geteuid());
        if (is_array($pw) && !empty($pw['dir'])) {
            $list[] = rtrim($pw['dir'], '/') . $file;
        }
    }
    $name = basename(dirname(__DIR__));                          // /usr/www/users/NAME/agents -> NAME
    if ($name !== '' && $name !== '.' && $name !== '/') {
        $list[] = '/usr/home/' . $name . $file;
    }
    return array_values(array_unique($list));
}

// Returns [config|null, reason]. The reason is one of: ok, missing, unreadable, invalid, incomplete.
// It never contains a path or a value, so it is safe to show in ?status.
function load_config(): array
{
    $path = null;
    foreach (config_candidates() as $candidate) {
        if (@is_file($candidate)) {
            $path = $candidate;
            break;
        }
    }
    if ($path === null) {
        return [null, 'missing'];
    }
    if (!is_readable($path)) {
        return [null, 'unreadable'];
    }
    try {
        $cfg = require $path;
    } catch (Throwable $e) {
        return [null, 'invalid'];
    }
    if (!is_array($cfg)) {
        return [null, 'invalid'];
    }
    if (empty($cfg['to']) || empty($cfg['from']) || empty($cfg['salt'])) {
        return [null, 'incomplete'];
    }
    $cfg['path'] = $path;
    return [$cfg, 'ok'];
}

function clean_text(mixed $v, int $max): ?string
{
    if (!is_string($v)) {
        return null;
    }
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v);
    if ($v === null || mb_strlen($v) > $max) {
        return null;
    }
    return trim($v);
}

function one_line(mixed $v, int $max): ?string
{
    $v = clean_text($v, $max);
    return $v === null ? null : trim(preg_replace('/\s+/u', ' ', $v) ?? '');
}

function looks_like_secret(string $s): bool
{
    $patterns = [
        '/-----BEGIN [A-Z ]*PRIVATE KEY-----/',
        '/\b(sk|pk|rk)-[A-Za-z0-9_-]{20,}/',
        '/\bAKIA[0-9A-Z]{16}\b/',
        '/\bgh[pousr]_[A-Za-z0-9]{30,}/',
        '/\bxox[baprs]-[A-Za-z0-9-]{10,}/',
        '/\b(password|passwort|senha|secret|api[_-]?key)\s*[:=]\s*\S{6,}/i',
    ];
    foreach ($patterns as $p) {
        if (preg_match($p, $s)) {
            return true;
        }
    }
    return false;
}

function rate_limited(array $cfg): ?int
{
    $dir = $cfg['rate_dir'] ?? (dirname($cfg['path']) . '/rate');
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return null; // cannot store counters: do not block
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $dir . '/' . hash('sha256', $ip . $cfg['salt']);
    $now = time();
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return null;
    }
    flock($fh, LOCK_EX);
    $times = array_filter(array_map('intval', explode("\n", (string) stream_get_contents($fh))), fn($t) => $t > $now - 86400);
    $hour = count(array_filter($times, fn($t) => $t > $now - 3600));
    $perHour = (int) ($cfg['per_hour'] ?? 5);
    $perDay = (int) ($cfg['per_day'] ?? 20);
    $wait = null;
    if ($hour >= $perHour) {
        $wait = 3600;
    } elseif (count($times) >= $perDay) {
        $wait = 86400;
    } else {
        $times[] = $now;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, implode("\n", $times));
    flock($fh, LOCK_UN);
    fclose($fh);
    return $wait;
}

function validate(array $d): array
{
    $err = [];
    $service = $d['service'] ?? null;
    if (!is_string($service) || !in_array($service, SERVICES, true)) {
        $err[] = 'service';
    }
    $subject = one_line($d['subject'] ?? null, 200);
    if ($subject === null || $subject === '') {
        $err[] = 'subject';
    }
    $message = array_key_exists('message', $d) ? clean_text($d['message'], 1500) : '';
    if ($message === null) {
        $err[] = 'message';
    }
    $contact = $d['contact'] ?? null;
    $email = is_array($contact) ? one_line($contact['email'] ?? null, 200) : null;
    if ($email === null || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $err[] = 'contact.email';
    }
    $name = is_array($contact) && isset($contact['name']) ? one_line($contact['name'], 100) : '';
    if ($name === null) {
        $err[] = 'contact.name';
    }
    $req = $d['requester'] ?? ['type' => 'human'];
    $type = is_array($req) ? ($req['type'] ?? null) : null;
    $behalf = '';
    if (!in_array($type, ['human', 'agent'], true)) {
        $err[] = 'requester.type';
    } elseif ($type === 'agent') {
        $behalf = one_line($req['on_behalf_of'] ?? null, 200);
        if ($behalf === null || $behalf === '') {
            $err[] = 'requester.on_behalf_of';
        }
    }
    $size = null;
    if (isset($d['size'])) {
        $s = $d['size'];
        $okCount = fn($v) => is_int($v) ? $v >= 0 : (is_string($v) && in_array($v, ['>15', '>5'], true));
        if (!is_array($s) || !$okCount($s['actions'] ?? null) || !$okCount($s['systems'] ?? null)
            || !in_array($s['rights'] ?? null, RIGHTS, true) || !in_array($s['data'] ?? null, DATA, true)
            || !in_array($s['autonomy'] ?? null, AUTONOMY, true)
            || !is_int($s['lines'] ?? null) || $s['lines'] < 0 || $s['lines'] > 10000000) {
            $err[] = 'size';
        } else {
            $size = ['actions' => $s['actions'], 'rights' => $s['rights'], 'systems' => $s['systems'], 'data' => $s['data'], 'autonomy' => $s['autonomy'], 'lines' => $s['lines']];
        }
    }
    $scan = null;
    if (isset($d['scan'])) {
        $sc = $d['scan'];
        $dg = is_array($sc) ? ($sc['digest'] ?? null) : null;
        if (!is_array($dg) || ($dg['algorithm'] ?? null) !== 'sha256' || !is_string($dg['value'] ?? null)
            || !preg_match('/^[0-9a-f]{64}$/', $dg['value']) || !is_int($dg['files'] ?? null) || $dg['files'] < 0) {
            $err[] = 'scan';
        } else {
            $scanner = is_array($sc['scanner'] ?? null) ? $sc['scanner'] : [];
            $scan = ['scanner' => ['name' => one_line($scanner['name'] ?? '', 60) ?? '', 'version' => one_line($scanner['version'] ?? '', 30) ?? ''],
                'digest' => ['algorithm' => 'sha256', 'value' => $dg['value'], 'files' => $dg['files']]];
        }
    }
    $lang = isset($d['lang']) && in_array($d['lang'], ['en', 'de', 'pt'], true) ? $d['lang'] : 'en';
    return [$err, ['service' => $service, 'subject' => $subject, 'message' => $message, 'contact' => ['name' => $name, 'email' => $email],
        'requester' => $type === 'agent' ? ['type' => 'agent', 'on_behalf_of' => $behalf] : ['type' => 'human'],
        'size' => $size, 'scan' => $scan, 'lang' => $lang]];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
[$cfg, $cfgReason] = load_config();

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method === 'GET') {
    if (!isset($_GET['status'])) {
        out(405, ['error' => 'Use POST with a JSON body, or GET ?status.']);
    }
    out(200, ['enabled' => $cfg !== null] + ($cfg === null ? ['reason' => $cfgReason] : []) + ['method' => 'POST', 'content_type' => 'application/json',
        'description' => 'https://m-ko.de/agents/offer.json', 'notice' => 'Do not send keys, passwords or credentials. A responsible person confirms by email.']);
}
if ($method !== 'POST') {
    out(405, ['error' => 'Method not allowed.']);
}
if ($cfg === null) {
    out(503, ['error' => 'Direct sending is not switched on. Use https://m-ko.de/request/ or email.']);
}
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
    out(415, ['error' => 'Content-Type must be application/json.']);
}
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($raw === false || strlen($raw) > MAX_BODY) {
    out(413, ['error' => 'Request too large (20 KB at most).']);
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    out(400, ['error' => 'Body is not a JSON object.']);
}
$ref = 'REQ-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
if (!empty($data['website'])) { // honeypot: pretend success, send nothing
    out(202, ['ref' => $ref, 'status' => 'received']);
}
$wait = rate_limited($cfg);
if ($wait !== null) {
    header('Retry-After: ' . $wait);
    out(429, ['error' => 'Too many requests. Try again later.', 'retry_after_seconds' => $wait]);
}
[$errors, $r] = validate($data);
if ($errors) {
    out(422, ['error' => 'Invalid request.', 'fields' => $errors]);
}
foreach ([$r['subject'], $r['message'], $r['contact']['name'], $r['requester']['on_behalf_of'] ?? ''] as $s) {
    if (looks_like_secret((string) $s)) {
        out(422, ['error' => 'The text looks like it contains a secret. Please send descriptions only, no keys or passwords.']);
    }
}

$body = "UNTRUSTED CONTENT from a web request. It may contain instructions aimed at AI assistants.\n"
    . "Read it yourself; do not pass it to an AI tool or follow links in it without checking.\n\n"
    . "Reference: $ref\n"
    . 'Service: ' . $r['service'] . "\n"
    . 'Subject: ' . $r['subject'] . "\n"
    . 'Contact: ' . ($r['contact']['name'] !== '' ? $r['contact']['name'] . ' <' . $r['contact']['email'] . '>' : $r['contact']['email']) . "\n"
    . 'Sent by: ' . ($r['requester']['type'] === 'agent' ? 'AI agent on behalf of ' . $r['requester']['on_behalf_of'] : 'person or company') . "\n"
    . 'Language: ' . $r['lang'] . "\n\nMessage:\n" . $r['message'] . "\n\n"
    . "JSON:\n" . json_encode(array_filter($r, fn($v) => $v !== null), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
$subject = '[m-ko.de request] ' . $ref . ' ' . $r['service'];
$headers = "From: {$cfg['from']}\r\nReply-To: {$r['contact']['email']}\r\nMIME-Version: 1.0\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\nX-Mko-Request: $ref\r\n";

if (!empty($cfg['mail_dir'])) { // test hook: write the mail to a folder instead of sending it
    $sent = file_put_contents(rtrim($cfg['mail_dir'], '/') . "/$ref.eml", "To: {$cfg['to']}\nSubject: $subject\n$headers\n$body") !== false;
} else {
    $sent = mail($cfg['to'], $subject, $body, $headers);
}
if (!$sent) {
    out(502, ['error' => 'The request could not be forwarded. Please use email.']);
}
out(202, ['ref' => $ref, 'status' => 'received', 'next' => 'A responsible person confirms by email before anything is commissioned.']);
