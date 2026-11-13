# Automatisches Deployment von m-ko.de

Bei jedem Push auf `main` prüft GitHub Actions die Seite und kopiert sie
per rsync über SSH auf den Server. Pull Requests werden nur geprüft, nie
ausgeliefert.

```
Pull Request  ──► check (Dateien vorhanden, Skripte gültig)
Merge in main ──► check ──► rsync über SSH ──► m-ko.de ──► Live-Check
```

Solange das Secret `DEPLOY_HOST` fehlt, wird nichts hochgeladen. Der Job
meldet dann "Deploy skipped". Man kann den Workflow also gefahrlos mergen
und die Zugangsdaten danach einrichten.

Was auf den Server geht: `index.html`, `favicon.svg`, `css/`, `js/`,
`fonts/`, `img/`, `get/`. Dateien, die nur auf dem Server liegen, bleiben
unberührt (kein `--delete`). Alle Dateien bekommen die Rechte 644 und alle
Ordner 755, damit der Webserver sie ausliefern darf.

## Einrichtung für Hetzner Webhosting (konsoleH)

Stand der Hetzner-Dokumentation, die Menünamen in konsoleH können
abweichen.

### 1. Prüfen, ob SSH im Paket enthalten ist

SSH gibt es laut Hetzner nur bei bestimmten Paketen (Webhosting L und XL
sowie Managed Server). Die Zugangsdaten sind die des FTP-Hauptbenutzers,
der Port ist **222**, nicht 22. Der Hostname steht in konsoleH unter
Einstellungen → Logindaten (Form `www123.your-server.de`).

### 2. Deploy-Schlüssel erzeugen

Auf dem eigenen Rechner:

```bash
ssh-keygen -t ed25519 -N "" -C mko-deploy -f mko-deploy
```

### 3. Öffentlichen Schlüssel in konsoleH eintragen

Einstellungen → Logindaten → Öffentliche SFTP-Schlüssel → Hinzufügen. Dort
den Inhalt von `mko-deploy.pub` einfügen. Lehnt konsoleH das Format ab,
ins RFC4716-Format umwandeln und das Ergebnis einfügen:

```bash
ssh-keygen -e -f mko-deploy.pub
```

### 4. Verbindung und rsync testen

```bash
ssh -p 222 -i mko-deploy BENUTZER@HOST 'rsync --version | head -1; ls'
```

Kommt die rsync-Version und eine Ordnerliste mit `public_html` zurück,
passt alles. Meldet der Server "rsync: command not found", geht dieser Weg
nicht und der Upload muss auf SFTP umgestellt werden.

### 5. Host-Schlüssel des Servers holen

```bash
ssh-keyscan -p 222 HOST
```

Die komplette Ausgabe wird das Secret `DEPLOY_KNOWN_HOSTS`. Sie sollte
mit der Fingerprint-Anzeige beim ersten manuellen Login aus Schritt 4
übereinstimmen.

### 6. GitHub-Secrets

Im Repository unter Settings → Secrets and variables → Actions:

| Secret | Inhalt |
|---|---|
| `DEPLOY_HOST` | Hostname aus Schritt 1 |
| `DEPLOY_USER` | FTP-Hauptbenutzer |
| `DEPLOY_SSH_KEY` | Inhalt der privaten Datei `mko-deploy` (ohne `.pub`) |
| `DEPLOY_KNOWN_HOSTS` | Ausgabe aus Schritt 5 |
| `DEPLOY_PORT` | `222` |
| `DEPLOY_PATH` | Zielordner, meist `public_html/` |

Die private Schlüsseldatei danach vom Rechner löschen oder im
Passwortmanager ablegen.

Hinweis zur Sicherheit: Bei Webhosting lässt sich der Schlüssel nicht auf
rsync oder einen Ordner beschränken. Er hat Zugriff auf den ganzen
Account. Darum einen eigenen Schlüssel nur dafür verwenden und ihn in
konsoleH entfernen, wenn er nicht mehr gebraucht wird.

### 7. Erster Lauf

Actions → Deploy → Run workflow, auf `main`. Der letzte Schritt ruft die
Startseite, das CSS, das JS und das Foto live ab. Schlägt eines davon fehl,
wird der Lauf rot.

## Andere Server

Eigener Server mit Root-Zugang: Schlüssel in `~/.ssh/authorized_keys` des
Deploy-Benutzers eintragen, am besten mit `command="rrsync /PFAD",restrict`
davor, `DEPLOY_PORT` weglassen (Standard 22). Reines FTP-Hosting ohne SSH
braucht einen anderen Upload-Schritt.
