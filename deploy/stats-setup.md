# Switching on the page view and click counter

`js/track.js` sends page views and clicks to `stats/collect.php`. The endpoint stays **off** until a folder
`mko-private/stats/` exists outside the web root. Until then it answers `204` and stores nothing.

## Steps (once)

1. Via SFTP create `mko-private/stats/` in the home directory, next to `public_html/` (the `mko-private/` folder
   already exists if the request endpoint is on). Permissions 700 or 755; PHP must be able to write there.
2. Check:
   ```bash
   curl -s https://m-ko.de/stats/collect.php?status
   ```
   should answer `{"enabled":true}`.
3. Open a few pages, click a download, then look in `mko-private/stats/`: one file per month, `2026-11.tsv`.

## Reading the numbers

Download the `.tsv` files via SFTP and run

```bash
node deploy/stats-report.js path/to/2026-11.tsv      # or a folder with several months
```

It prints views per day, pages, clicks, languages and referrers.

## What is stored

One line per event: date (no time), `view` or `click`, page path, click name, language, referrer domain
(page views only). No IP address, no user agent, no identifier, nothing in the browser. Robots are filtered by
user agent and never stored.

- Click names come from `data-track="..."` on an element, from `data-set-lang` buttons (`lang-de` ...), and
  automatically from email links (`mail`), external links (`out-host`) and files under `/get/` or ending in
  `.pdf` / `.zip` (`download-file`).
- The script stays off when the browser sends Do Not Track or Global Privacy Control.
- A month file stops growing at 2 MB, so a flood of fake hits cannot fill the disk.
- The privacy page promises a retention of 12 months at most: delete `.tsv` files older than that.

## Switching it off

Remove `mko-private/stats/` (or just rename it). The endpoint then stores nothing. To remove the script as well,
delete the `track.js` line from the pages and update `privacy/` section 5.
