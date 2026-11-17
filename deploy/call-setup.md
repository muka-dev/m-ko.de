# Call button: setting up the phone number

The emergency page (`/emergency/`) can show a "Call now" button. The phone number is **not** in the repository
and not in any page. It sits in a config file outside the web root and is handed out by `agents/call.php`
only when someone presses the button. Without the file the button stays hidden.

## 1. Create the file

On the server, next to the request config, create `mko-private/call-config.php` (same folder as `request-config.php`):

```php
<?php
return [
    'phone' => '+49 911 0000000',   // the number that should ring
    // 'per_hour' => 30,            // optional: how often the number can be revealed per hour, for everybody together
];
```

Allowed characters in the number: digits, `+`, spaces, `( ) / -`.

## 2. Check it

Open `https://m-ko.de/agents/call.php?status`. It must answer `{"enabled":true}`. The number itself is never shown there.

## What this does and does not protect

- The number is not in the page source, the search index or the repository.
- It is handed out only to requests that come from a page of this site, at most `per_hour` times an hour in total.
  When the limit is used up the button hides itself and the request form stays.
- Nothing about the caller is stored. Only an hourly counter is kept.
- It does **not** stop a person who presses the button: whoever does sees the number. It keeps out harvesters and
  simple scripts, which is what causes most spam calls.

To switch the button off, delete the file.
