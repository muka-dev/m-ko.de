# Switching on the request endpoint

`agents/request.php` accepts a JSON request from people and AI agents and forwards it as a plain-text email.
It stays **off** until a config file exists outside the web root.

## Steps (once)

1. **Mailbox.** Done: mailbox `anfragen@m-ko.de` with the aliases `request@`, `requests@` and `r@` (konsoleH).
2. **Config folder.** Via SFTP create `mko-private/` in the home directory, next to `public_html/` (not inside it).
3. **Config file.** Copy `deploy/request-config.example.php` there as `request-config.php`, set a random `salt`
   (`openssl rand -hex 16`) and check `to` and `from`. Set permissions to 600.
4. **Check.**
   ```bash
   curl -s https://m-ko.de/agents/request.php?status
   ```
   should answer `{"enabled":true,...}`.
5. **Test request.**
   ```bash
   curl -s -X POST https://m-ko.de/agents/request.php -H 'Content-Type: application/json' \
     -d '{"service":"other","subject":"test","contact":{"email":"you@example.org"}}'
   ```
   The answer has a `ref`; the mail should arrive at `anfragen@m-ko.de` within a minute. Look in the spam folder too.
6. **Deliverability.** If mails land in spam, check the SPF record of `m-ko.de` (it must allow the Hetzner web server) and ask Hetzner support whether DKIM is available for web hosting. Alternative: switch the script to authenticated SMTP.
7. **Request assistant.** The mail link already uses `request@m-ko.de`; send a test mail to it and check that it arrives in `anfragen@`.

## Switching it off

Delete or rename `mko-private/request-config.php`. The endpoint then answers `503` and the "Send directly" button disappears.

## What it does and does not do

- Accepts only `application/json`, at most 20 KB, strict fields (see `agents/offer.json`).
- Limits: 5 requests per hour and 20 per day per IP. Only a salted hash of the IP and timestamps are kept, for at most 24 hours, in `mko-private/rate/`.
- Refuses texts that look like keys or passwords (without echoing them).
- Forwards plain text only, with a warning at the top that the content is untrusted and may contain instructions aimed at AI assistants.
- Stores nothing else: no database, no copy of the request.
