<?php
// Copy to ~/mko-private/request-config.php on the server, one level ABOVE public_html.
// This file holds no passwords. Never commit the real one.
return [
    'to'   => 'anfragen@m-ko.de',   // where requests arrive
    'from' => 'anfragen@m-ko.de',   // sender address (a mailbox on the same domain)
    'salt' => 'REPLACE_WITH_RANDOM_HEX', // openssl rand -hex 16
    // optional: 'per_hour' => 5, 'per_day' => 20,
];
