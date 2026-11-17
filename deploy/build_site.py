#!/usr/bin/env python3
"""Build the site folder with one address per language.

The pages in the repository stay trilingual: every text exists three times,
marked with lang="de|en|pt". This script writes site/ for the server:

  site/            German   (https://m-ko.de/...)
  site/en/         English  (https://m-ko.de/en/...)
  site/pt/         Portuguese (https://m-ko.de/pt/...)

Each built page keeps only its own language, carries a fixed title,
description and canonical address, and links to its two siblings with
hreflang. Links to other pages stay inside the language, links to files
(css, js, images) point to the one shared copy at the root.

Usage: python3 deploy/build_site.py [output folder, default: site]
"""
import html
import os
import posixpath
import re
import shutil
import sys

ORIGIN = 'https://m-ko.de'
LANGS = ['de', 'en', 'pt']
DEFAULT = 'de'
# Copied as they are, once, at the root.
STATIC = ['favicon.svg', 'llms.txt', 'robots.txt', 'css', 'js', 'fonts', 'img', 'get']
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
        'meta', 'source', 'track', 'wbr'}
LOCALE = {'de': 'de_DE', 'en': 'en_GB', 'pt': 'pt_PT'}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN = re.compile(r'<!--.*?-->|<(script|style)\b[^>]*>.*?</\1\s*>|<(/?)([a-zA-Z][\w-]*)((?:"[^"]*"|\'[^\']*\'|[^\'">])*)>', re.S)
LANG_ATTR = re.compile(r'\slang="([a-z]{2})"')


def pages():
    """Page folders relative to the root: '' for the home page, 'about/' ..."""
    found = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if not d.startswith('.') and d not in ('site', 'node_modules', 'tests', 'deploy')]
        if 'index.html' in filenames:
            rel = os.path.relpath(dirpath, ROOT).replace(os.sep, '/')
            found.append('' if rel == '.' else rel + '/')
    return sorted(found)


def url_for(page, lang):
    return '/' + ('' if lang == DEFAULT else lang + '/') + page


def strip_languages(src, lang):
    """Drop every element whose lang attribute names another language."""
    out, pos, skip, depth = [], 0, None, 0
    for m in TOKEN.finditer(src):
        if skip is None:
            out.append(src[pos:m.start()])
        pos = m.end()
        closing, name, attrs = m.group(2), (m.group(3) or '').lower(), m.group(4) or ''
        if skip is not None:
            if not name or name in VOID or attrs.rstrip().endswith('/'):
                continue
            if closing:
                depth -= 1
                if depth == 0:
                    skip = None
            else:
                depth += 1
            continue
        tag_lang = LANG_ATTR.search(attrs) if name and not closing and name != 'html' else None
        if tag_lang and tag_lang.group(1) in LANGS and tag_lang.group(1) != lang:
            if name in VOID or attrs.rstrip().endswith('/'):
                continue
            skip, depth = name, 1
            continue
        out.append(m.group(0))
    if skip is not None:
        raise ValueError('unclosed <%s lang=...>' % skip)
    out.append(src[pos:])
    return ''.join(out)


def rewrite_refs(doc, page, lang, page_set):
    """Make relative links absolute: pages inside the language, files at the root."""
    base = '/' + page

    def fix(m):
        attr, ref = m.group(1), m.group(2)
        if re.match(r'^(?:[a-z][a-z0-9+.-]*:|#|//|/)', ref, re.I) or ref == '':
            return m.group(0)
        path, sep, rest = re.match(r'^([^?#]*)([?#]?)(.*)$', ref).groups()
        target = posixpath.normpath(posixpath.join(base, path or '.'))
        target = target.lstrip('/')
        if target == '.':
            target = ''
        is_dir = path == '' or path.endswith('/') or path in ('.', '..')
        key = target + '/' if is_dir and target else target
        if key.endswith('index.html'):
            key = key[:-len('index.html')]
        if key in page_set:
            new = url_for(key, lang if page_set[key] else DEFAULT)
        else:
            new = '/' + key
        return '%s="%s%s%s"' % (attr, new, sep, rest)

    return re.sub(r'\b(href|src|action)="([^"]*)"', fix, doc)


def head_tags(page):
    lines = ['<link rel="alternate" hreflang="%s" href="%s%s">' % (l, ORIGIN, url_for(page, l)) for l in LANGS]
    lines.append('<link rel="alternate" hreflang="x-default" href="%s%s">' % (ORIGIN, url_for(page, DEFAULT)))
    return '\n  '.join(lines)


# Replaces the inline script that picked the language at runtime. On the
# German addresses a first-time visitor whose browser asks for English or
# Portuguese (or any language the site does not offer: English) is sent there; crawlers are left alone, so each
# address keeps its own language for search engines.
PICK = """<script>
    (function () {
      var root = document.documentElement;
      root.classList.add('js');
      if (root.getAttribute('lang') !== 'de') return;
      if (/bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent || '')) return;
      var want = null;
      try { want = localStorage.getItem('lang'); } catch (e) {}
      if (!want) want = (navigator.language || 'de').slice(0, 2).toLowerCase();
      if (want !== 'de' && want !== 'pt') want = 'en';
      if (want === 'en' || want === 'pt') location.replace('/' + want + location.pathname + location.search + location.hash);
    })();
  </script>"""


def build_page(src, page, lang, page_set):
    html_tag = re.search(r'<html\b[^>]*>', src).group(0)
    attr = lambda n: (re.search(r'\s%s="([^"]*)"' % n, html_tag) or [None, None])[1]
    title = attr('data-title-' + lang)
    desc = attr('data-desc-' + lang)

    doc = strip_languages(src, lang)
    doc = doc.replace(html_tag, '<html lang="%s" data-lang="%s" data-fixed-lang>' % (lang, lang), 1)

    # Home page: title and description live in main.js.
    if title is None:
        with open(os.path.join(ROOT, 'js/main.js'), encoding='utf-8') as fh:
            main = fh.read()
        title = re.search(r"%s: '([^']*)'" % lang, main.split('var descriptions')[0].split('var titles')[1]).group(1)
        desc = re.search(r"%s: '([^']*)'" % lang, main.split('var descriptions')[1]).group(1)
    t, d = html.escape(html.unescape(title), quote=True), html.escape(html.unescape(desc), quote=True)
    url = ORIGIN + url_for(page, lang)
    doc = re.sub(r'<title>.*?</title>', '<title>%s</title>' % t, doc, count=1, flags=re.S)
    doc = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % d, doc, count=1)
    doc = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="%s">' % t, doc, count=1)
    doc = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="%s">' % d, doc, count=1)
    doc = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="%s">' % url, doc, count=1)
    doc = re.sub(r'<meta property="og:locale" content="[^"]*">\s*', '', doc)
    doc = re.sub(r'<link rel="canonical" href="[^"]*">',
                 '<link rel="canonical" href="%s">\n  <meta property="og:locale" content="%s">\n  %s' % (url, LOCALE[lang], head_tags(page)), doc, count=1)
    if '<link rel="canonical"' not in doc:
        raise ValueError(page + ': no canonical link')

    # Language-dependent alt texts become fixed.
    def alt(m):
        tag = m.group(0)
        a = re.search(r'\sdata-alt-%s="([^"]*)"' % lang, tag)
        if a:
            tag = re.sub(r'\salt="[^"]*"', '', tag)
            tag = tag.replace('<img', '<img alt="%s"' % a.group(1), 1)
        return re.sub(r'\sdata-alt-[a-z]{2}="[^"]*"', '', tag)
    doc = re.sub(r'<img\b[^>]*>', alt, doc)

    # Runtime language picker → fixed language plus first-visit redirect.
    doc, n = re.subn(r'<script>\s*// Pick the language before first paint.*?</script>', PICK, doc, count=1, flags=re.S)
    if n != 1:
        raise ValueError(page + ': language picker script not found')

    # The switch buttons become links to the same page in the other language.
    def switch(m):
        l = m.group(1)
        label = m.group(2)
        title_attr = re.search(r'title="([^"]*)"', m.group(0)).group(1)
        current = ' aria-current="true"' if l == lang else ''
        return '<a href="%s" hreflang="%s" data-set-lang="%s" title="%s"%s>%s</a>' % (
            url_for(page, l), l, l, title_attr, current, label)
    doc = re.sub(r'<button type="button" data-set-lang="([a-z]{2})"[^>]*>([^<]*)</button>', switch, doc)

    return rewrite_refs(doc, page, lang, page_set)


def sitemap(page_list, page_set, src):
    lastmod = dict(re.findall(r'<loc>%s/([^<]*)</loc><lastmod>([^<]*)</lastmod>' % re.escape(ORIGIN), src))
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for page in page_list:
        if page not in lastmod or not page_set[page]:
            continue
        for lang in LANGS:
            out.append('  <url><loc>%s%s</loc><lastmod>%s</lastmod>' % (ORIGIN, url_for(page, lang), lastmod[page]))
            for l in LANGS:
                out.append('    <xhtml:link rel="alternate" hreflang="%s" href="%s%s"/>' % (l, ORIGIN, url_for(page, l)))
            out.append('  </url>')
    out.append('</urlset>')
    return '\n'.join(out) + '\n'


def main():
    dest = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'site'))
    if os.path.exists(dest):
        shutil.rmtree(dest)
    os.makedirs(dest)
    for name in STATIC:
        s = os.path.join(ROOT, name)
        (shutil.copytree if os.path.isdir(s) else shutil.copy2)(s, os.path.join(dest, name))

    page_list = pages()
    sources = {}
    for p in page_list:
        with open(os.path.join(ROOT, p, 'index.html'), encoding='utf-8') as fh:
            sources[p] = fh.read()
    # True: trilingual page, built three times. False: single-language page
    # (brand, assistant), copied once as it is.
    page_set = {p: 'Pick the language before first paint' in sources[p] for p in page_list}
    for page in page_list:
        folder = os.path.join(ROOT, page)
        src = sources[page]
        # Other files in a page folder (request.php, offer.json, ...) stay at the root.
        for f in os.listdir(folder):
            p = os.path.join(folder, f)
            if page and os.path.isfile(p) and f != 'index.html':
                os.makedirs(os.path.join(dest, page), exist_ok=True)
                shutil.copy2(p, os.path.join(dest, page, f))
        if not page_set[page]:
            os.makedirs(os.path.join(dest, page), exist_ok=True)
            shutil.copy2(os.path.join(folder, 'index.html'), os.path.join(dest, page, 'index.html'))
            continue
        for lang in LANGS:
            out_dir = os.path.join(dest, url_for(page, lang).lstrip('/'))
            os.makedirs(out_dir, exist_ok=True)
            with open(os.path.join(out_dir, 'index.html'), 'w', encoding='utf-8') as fh:
                fh.write(build_page(src, page, lang, page_set))

    with open(os.path.join(ROOT, 'sitemap.xml'), encoding='utf-8') as fh:
        sm = sitemap(page_list, page_set, fh.read())
    with open(os.path.join(dest, 'sitemap.xml'), 'w', encoding='utf-8') as fh:
        fh.write(sm)
    print('built %d pages x %d languages into %s' % (len(page_list), len(LANGS), dest))


if __name__ == '__main__':
    main()
