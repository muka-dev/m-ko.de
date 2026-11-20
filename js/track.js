/* Cookie-free counting of page views and clicks. See privacy/ section 4.
   Sends: kind (view or click), page path, event name, language, referrer domain.
   Sends no IP address, no identifier and stores nothing in the browser.
   Off when the browser signals Do Not Track or Global Privacy Control. */
(function () {
  'use strict';

  var ENDPOINT = '/stats/collect.php';
  var nav = navigator;
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true || nav.webdriver) return;

  function send(kind, name) {
    var ref = '';
    try {
      var r = document.referrer ? new URL(document.referrer).hostname : '';
      if (r && r !== location.hostname) ref = r;
    } catch (e) {}
    var body = JSON.stringify({
      k: kind,
      p: location.pathname,
      n: name || '',
      l: document.documentElement.getAttribute('lang') || '',
      r: kind === 'view' ? ref : ''
    });
    try {
      if (nav.sendBeacon && nav.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
    } catch (e) {}
    try {
      fetch(ENDPOINT, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
    } catch (e) {}
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  // Name of the click, or '' when it is not worth counting.
  function clickName(el) {
    var tagged = el.closest('[data-track]');
    if (tagged) return slug(tagged.getAttribute('data-track'));
    var lang = el.closest('[data-set-lang]');
    if (lang) return 'lang-' + slug(lang.getAttribute('data-set-lang'));
    var a = el.closest('a[href]');
    if (!a) return '';
    if (a.classList.contains('js-mail')) return 'mail';
    var url;
    try { url = new URL(a.href, location.href); } catch (e) { return ''; }
    if (url.protocol === 'mailto:') return 'mail';
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    if (url.hostname !== location.hostname) return 'out-' + slug(url.hostname);
    if (/\/get\//.test(url.pathname) || /\.(pdf|zip)$/i.test(url.pathname)) {
      return 'download-' + slug(url.pathname.split('/').pop());
    }
    return '';
  }

  document.addEventListener('click', function (e) {
    if (!(e.target instanceof Element)) return;
    var name = clickName(e.target);
    if (name) send('click', name);
  }, true);

  if (document.visibilityState === 'prerender') {
    document.addEventListener('visibilitychange', function once() {
      document.removeEventListener('visibilitychange', once);
      send('view');
    });
  } else {
    send('view');
  }
})();
