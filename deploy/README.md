# Automatisches Deployment von m-ko.de

Bei jedem Push auf `main` prüft GitHub Actions die Seite und lädt sie per
SFTP auf den Server hoch. Pull Requests werden nur geprüft, nie
ausgeliefert.

```
Pull Request  ──► check (Dateien vorhanden, Skripte gültig)
Merge in main ──► check ──► SFTP-Upload ──► m-ko.de ──► Live-Check
```

Solange das Secret `DEPLOY_HOST` fehlt, wird nichts hochgeladen. Der Job
meldet dann "Deploy skipped". Man kann den Workflow also gefahrlos mergen
und die Zugangsdaten danach einrichten.

Was auf den Server geht: `index.html`, `favicon.svg`, `css/`, `js/`,
`fonts/`, `img/`, `get/`. Dateien, die nur auf dem Server liegen, bleiben
unberührt (kein Löschen). Dateien bekommen die Rechte 644 und Ordner 755,
damit der Webserver sie ausliefern darf.

## Einrichtung für Hetzner Webhosting (konsoleH)

Der Upload läuft über SFTP auf Port 22 mit einem Schlüssel für den
FTP-Hauptbenutzer. Eine Shell oder `rsync` braucht es dafür nicht.

### 1. Schlüssel erzeugen

Auf dem eigenen Rechner, Passphrase leer lassen (zweimal Enter):

```bash
ssh-keygen -t ed25519 -C mko-deploy -f mko-deploy
```

### 2. Öffentlichen Schlüssel in konsoleH eintragen

Einstellungen → Logindaten → Öffentliche SFTP-Schlüssel → Hinzufügen. Dort
den Inhalt von `mko-deploy.pub` einfügen (eine Zeile, beginnt mit
`ssh-ed25519`). konsoleH wandelt das Format selbst um.

### 3. SFTP-Login testen

```bash
sftp -P 22 -i mko-deploy BENUTZER@HOST
```

Kommt der Prompt `sftp>`, funktioniert der Schlüssel. Mit `ls` den
Webordner suchen, bei einer Hauptdomain meist `public_html`.

### 4. Host-Schlüssel des Servers holen

```bash
ssh-keyscan -p 22 HOST
```

Die komplette Ausgabe wird das Secret `DEPLOY_KNOWN_HOSTS`.

### 5. GitHub-Secrets

Im Repository unter Settings → Secrets and variables → Actions:

| Secret | Inhalt |
|---|---|
| `DEPLOY_HOST` | Hostname, z. B. `www751.your-server.de` |
| `DEPLOY_USER` | FTP-Hauptbenutzer |
| `DEPLOY_SSH_KEY` | Inhalt der privaten Datei `mko-deploy` (ohne `.pub`), inklusive der Zeilen `BEGIN` und `END` |
| `DEPLOY_KNOWN_HOSTS` | Ausgabe aus Schritt 4 |
| `DEPLOY_PATH` | Optional. Zielordner, Standard `public_html` |
| `DEPLOY_PORT` | Optional. Standard `22` |

Die private Schlüsseldatei danach vom Rechner löschen oder im
Passwortmanager ablegen.

Hinweis zur Sicherheit: Der Schlüssel gilt für den ganzen Account, nicht
nur für einen Ordner. Darum einen eigenen Schlüssel nur dafür verwenden
und ihn in konsoleH entfernen, wenn er nicht mehr gebraucht wird.

### 6. Erster Lauf

Actions → Deploy → Run workflow, auf `main`. Der letzte Schritt ruft die
Startseite, das CSS, das JS und das Foto live ab. Schlägt eines davon fehl,
wird der Lauf rot.
