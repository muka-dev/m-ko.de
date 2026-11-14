// Scanner for AI components (skills, connectors, agent configurations).
// Pure functions: no DOM, no network. Runs in the browser and in Node (tests).
//
// Input:  [{ path: 'dir/file.js', bytes: Uint8Array, size?: number }]
//         (size lets the caller skip reading a file: pass empty bytes and its real size)
// Output: a size block, the class it points to, evidence, and a SHA-256 digest
//         over the files that were read. The result is a self-declaration
//         that the reviewer recomputes on the delivered files.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AgentScanner = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '0.1.0';
  var CLASSES = ['S', 'M', 'L', 'XL'];
  var LIMITS = { maxFiles: 5000, maxFileBytes: 1024 * 1024, maxTotalBytes: 50 * 1024 * 1024 };

  var IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__', '.next', 'vendor', 'target', '.idea', '.vscode'];
  var IGNORE_FILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|composer\.lock|\.DS_Store)$/i;
  var BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|gz|tgz|woff2?|ttf|otf|mp[34]|mov|wasm|so|dll|exe|bin|pyc|map)$/i;
  // Read for the digest, but not for the analysis or the line count.
  var DOC_PATH = /(^|\/)(README[^/]*|LICENSE[^/]*|CHANGELOG[^/]*|docs?\/|examples?\/|tests?\/|__tests__\/)/i;

  var KNOWN_SYSTEMS = ['stripe', 'slack', 'twilio', 'sendgrid', 'salesforce', 'hubspot', 'notion', 'airtable', 'asana', 'jira', 'atlassian',
    'gitlab', 'gmail', 'googleapis', 'boto3', 'azure', 'supabase', 'firebase', 'shopify', 'paypal', 'zendesk', 'intercom', 'postgres',
    'mysql', 'mongodb', 'redis', 'openai', 'anthropic'];
  var IGNORE_HOSTS = /(^|\.)(localhost|example\.(com|org|net)|w3\.org|schema\.org|json-schema\.org|github\.com|githubusercontent\.com|npmjs\.(org|com)|unpkg\.com|jsdelivr\.net|apache\.org|mozilla\.org|creativecommons\.org|openapis\.org|modelcontextprotocol\.io|wikipedia\.org|python\.org|nodejs\.org)$/i;

  var RE = {
    chains: /\b(spawn[ _-]?agents?|sub-?agents?|call[ _-]?agent|delegate[ _-]?to|agent[-_ ]to[-_ ]agent|run[ _-]?agent)\b/i,
    heavy: /\b(refund|charge|payment|payout|transfer[ _-]?funds|wire|delete|destroy|drop\s+table|rm\s+-rf|unlink|rmtree|truncate|revoke|grant|set[ _-]?permissions?|chmod|publish|tweet|deploy)\b|method\s*[:=]\s*['"]DELETE['"]|\.delete\(|DELETE\s+FROM/i,
    write: /method\s*[:=]\s*['"](POST|PUT|PATCH)['"]|\.(post|put|patch)\(|\bwriteFile(Sync)?\b|fs\.write|INSERT\s+INTO|UPDATE\s+\w+\s+SET|\bsend[ _-]?(mail|message|email)\b|\bsmtp\b|\bupload\b/i,
    personal: /\b(e-?mail|phone|address|first[ _-]?name|last[ _-]?name|customer|client[ _-]?id|user[ _-]?id|contact|birth|account[ _-]?number|employee)\b/i,
    sensitive: /\b(health|patient|medical|diagnos\w*|credit[ _-]?card|card[ _-]?number|ssn|social[ _-]?security|passport|biometric|salary|payroll|tax[ _-]?id|iban|password)\b/i,
    unattended: /\b(cron|scheduled?|webhook|autonomous(ly)?|unattended|background job|daemon|headless|setInterval|auto[ _-]?approve|bypassPermissions|dangerously\w*)\b|while\s+True/i,
    confirm: /\b(confirm\w*|approval|approve\w*|human[- ]in[- ]the[- ]loop|ask (the )?user|ask before|require[ _-]?approval)\b/i,
    url: /https?:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi,
    sdkLine: /(^|\s)(import|from|require)\b/
  };

  function normalisePath(p) { return String(p).replace(/\\/g, '/').replace(/^\.?\//, ''); }

  // Decide whether a file is read. Used before reading so large trees stay cheap.
  function plan(path, size) {
    var p = normalisePath(path);
    var parts = p.split('/');
    for (var i = 0; i < parts.length - 1; i++) {
      if (IGNORE_DIRS.indexOf(parts[i]) !== -1) return { read: false, reason: 'ignored folder' };
    }
    if (IGNORE_FILES.test(p)) return { read: false, reason: 'lockfile or system file' };
    if (BINARY_EXT.test(p)) return { read: false, reason: 'binary or generated file' };
    if (size > LIMITS.maxFileBytes) return { read: false, reason: 'larger than 1 MB' };
    return { read: true };
  }

  function getSubtle() {
    var c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
    return c && c.subtle ? c.subtle : null;
  }
  function hex(buf) {
    var a = new Uint8Array(buf), s = '';
    for (var i = 0; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    return s;
  }
  function sha256(bytes) { return getSubtle().digest('SHA-256', bytes).then(hex); }

  function stripCommonRoot(files) {
    if (!files.length) return files;
    var first = files[0].path.split('/')[0];
    for (var i = 0; i < files.length; i++) {
      var parts = files[i].path.split('/');
      if (parts.length < 2 || parts[0] !== first) return files;
    }
    return files.map(function (f) { return { path: f.path.slice(first.length + 1), bytes: f.bytes, size: f.size }; });
  }

  function isText(bytes) {
    var n = Math.min(bytes.length, 8000);
    for (var i = 0; i < n; i++) if (bytes[i] === 0) return false;
    return true;
  }

  function level(n, steps) { // steps: upper bounds for levels 0,1,2
    for (var i = 0; i < steps.length; i++) if (n <= steps[i]) return i;
    return 3;
  }

  // snake_case and camelCase identifiers count as separate words (refund_invoice, deleteUser).
  function words(line) { return line.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' '); }

  function lineHits(doc, re, limit) {
    var out = [], count = 0, lines = doc.text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (re.test(words(lines[i]))) {
        count++;
        if (out.length < limit) out.push({ file: doc.path, line: i + 1, text: lines[i].trim().slice(0, 140) });
      }
    }
    return { count: count, evidence: out };
  }

  function collectHits(docs, re, limit) {
    var total = 0, evidence = [];
    docs.forEach(function (d) {
      var h = lineHits(d, re, limit - evidence.length > 0 ? limit - evidence.length : 0);
      total += h.count;
      evidence = evidence.concat(h.evidence);
    });
    return { count: total, evidence: evidence };
  }

  // ---- actions: tools and skills ----
  function walkJson(node, names) {
    if (Array.isArray(node)) { node.forEach(function (n) { walkJson(n, names); }); return; }
    if (!node || typeof node !== 'object') return;
    if (typeof node.name === 'string' && (node.inputSchema || node.input_schema || node.parameters)) names.add(node.name);
    Object.keys(node).forEach(function (k) { walkJson(node[k], names); });
  }

  function findActions(docs) {
    var names = new Set();
    docs.forEach(function (d) {
      var m, re;
      re = /(?:\.tool|\bregisterTool|\badd_tool)\(\s*['"`]([A-Za-z0-9_.:-]+)['"`]/g;
      while ((m = re.exec(d.text))) names.add(m[1]);
      re = /@(?:\w+\.)?tool(?:\([^)]*\))?[ \t]*\r?\n[ \t]*(?:async[ \t]+)?def[ \t]+(\w+)/g;
      while ((m = re.exec(d.text))) names.add(m[1]);
      if (/\.json$/i.test(d.path)) {
        try { walkJson(JSON.parse(d.text), names); } catch (e) { /* not valid JSON: ignore */ }
      }
      re = /^(?:allowed-tools|tools)\s*:\s*(.+)$/gim;
      while ((m = re.exec(d.text))) {
        m[1].replace(/[\[\]'"]/g, '').split(/[,\s]+/).forEach(function (t) { if (t) names.add(t); });
      }
      if (/(^|\/)SKILL\.md$/i.test(d.path)) names.add('skill:' + (d.path.split('/').slice(-2, -1)[0] || 'root'));
      if (/(^|\/)scripts\/.+\.(sh|py|js|ts)$/i.test(d.path)) names.add('script:' + d.path);
    });
    return Array.from(names).sort();
  }

  // ---- systems: external hosts and known SDKs ----
  function findSystems(docs) {
    var set = new Set();
    docs.forEach(function (d) {
      var m, re = new RegExp(RE.url.source, 'gi');
      while ((m = re.exec(d.text))) {
        var host = m[1].toLowerCase().replace(/\.$/, '');
        if (IGNORE_HOSTS.test(host)) continue;
        var labels = host.split('.');
        set.add(labels.length >= 2 ? labels[labels.length - 2] : host);
      }
      d.text.split('\n').forEach(function (line) {
        if (!RE.sdkLine.test(line)) return;
        var lower = line.toLowerCase();
        KNOWN_SYSTEMS.forEach(function (k) { if (new RegExp('\\b' + k + '\\b').test(lower)) set.add(k); });
      });
    });
    return Array.from(set).sort();
  }

  function analyse(docs) {
    var notes = [];
    var actions = findActions(docs);
    var systems = findSystems(docs);
    var chains = collectHits(docs, RE.chains, 5);
    var heavy = collectHits(docs, RE.heavy, 5);
    var write = collectHits(docs, RE.write, 5);
    var sensitive = collectHits(docs, RE.sensitive, 5);
    var personal = collectHits(docs, RE.personal, 5);
    var unattended = collectHits(docs, RE.unattended, 5);
    var confirm = collectHits(docs, RE.confirm, 5);

    var rights = chains.count ? 3 : heavy.count ? 2 : write.count ? 1 : 0;
    var rightsKey = ['read', 'write', 'money-deletion-access', 'chains'][rights];
    var data = sensitive.count ? 2 : personal.count ? 1 : 0;
    var dataKey = ['none', 'personal-one-org', 'sensitive-or-several-orgs'][data];

    var autonomy, autonomyEvidence;
    if (chains.count) { autonomy = 3; autonomyEvidence = chains.evidence; }
    else if (unattended.count) { autonomy = 2; autonomyEvidence = unattended.evidence; }
    else if (rights === 0) { autonomy = 0; autonomyEvidence = []; }
    else if (confirm.count) { autonomy = 1; autonomyEvidence = confirm.evidence; }
    else { autonomy = 2; autonomyEvidence = []; notes.push('No approval step found although the component can change things. Counted as unattended; correct by hand if a person confirms each step.'); }
    var autonomyKey = ['confirms-each-step', 'confirms-risky-steps', 'unattended', 'chains-agents'][autonomy];

    var lines = 0;
    docs.forEach(function (d) { d.text.split('\n').forEach(function (l) { if (l.trim()) lines++; }); });

    if (!actions.length) notes.push('No tools or skills recognised. The count of actions needs checking by hand.');
    notes.push('"Data of several organisations" cannot be detected. Set it by hand if it applies.');

    var levels = {
      actions: actions.length ? level(actions.length, [3, 8, 15]) : 0,
      rights: rights,
      systems: systems.length ? level(systems.length, [1, 3, 5]) : 0,
      data: data,
      autonomy: autonomy
    };
    var cls = 0;
    Object.keys(levels).forEach(function (k) { if (levels[k] > cls) cls = levels[k]; });

    return {
      size: { actions: actions.length, rights: rightsKey, systems: systems.length, data: dataKey, autonomy: autonomyKey, lines: lines },
      levels: levels,
      class: CLASSES[cls],
      evidence: {
        actions: actions.slice(0, 30),
        systems: systems.slice(0, 30),
        rights: (chains.count ? chains : heavy.count ? heavy : write).evidence,
        data: (sensitive.count ? sensitive : personal).evidence,
        autonomy: autonomyEvidence
      },
      notes: notes
    };
  }

  // files: [{ path, bytes }]. Resolves to the full result.
  function scan(input) {
    if (!getSubtle()) return Promise.reject(new Error('Web Crypto is not available in this browser or context.'));
    var skipped = [];
    var files = stripCommonRoot(input.map(function (f) { return { path: normalisePath(f.path), bytes: f.bytes, size: f.size }; }));
    var read = [], total = 0;
    files.forEach(function (f) {
      var pl = plan(f.path, f.size != null ? f.size : f.bytes.length);
      if (!pl.read) { skipped.push({ path: f.path, reason: pl.reason }); return; }
      if (!isText(f.bytes)) { skipped.push({ path: f.path, reason: 'binary content' }); return; }
      if (read.length >= LIMITS.maxFiles || total + f.bytes.length > LIMITS.maxTotalBytes) { skipped.push({ path: f.path, reason: 'scan limit reached' }); return; }
      total += f.bytes.length;
      read.push(f);
    });
    read.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });

    return Promise.all(read.map(function (f) { return sha256(f.bytes); })).then(function (hashes) {
      var manifest = read.map(function (f, i) { return hashes[i] + '  ' + f.path + '\n'; }).join('');
      return sha256(new TextEncoder().encode(manifest)).then(function (root) {
        var decoder = new TextDecoder('utf-8');
        var docs = read
          .filter(function (f) { return !DOC_PATH.test(f.path); })
          .map(function (f) { return { path: f.path, text: decoder.decode(f.bytes) }; });
        var result = analyse(docs);
        result.scanner = { name: 'm-ko-agent-scanner', version: VERSION };
        result.digest = { algorithm: 'sha256', value: root, files: read.length };
        result.skipped = { count: skipped.length, examples: skipped.slice(0, 20) };
        return result;
      });
    });
  }

  return { VERSION: VERSION, LIMITS: LIMITS, plan: plan, scan: scan, analyse: analyse, normalisePath: normalisePath };
});
