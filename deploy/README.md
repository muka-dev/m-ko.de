# Automatisches Deployment von m-ko.de

Bei jedem Push auf `main` prüft GitHub Actions die Seite und kopiert sie
per rsync über SSH auf den Server. Pull Requests werden nur geprüft, nie
ausgeliefert. Dieselbe Technik nutzt humanreviewed.com.

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

## Voraussetzung

Der Server braucht SSH-Zugang und `rsync`. Bei reinem FTP-Hosting ohne SSH
geht der Weg so nicht. Dann ersetzt man den Schritt "Deploy over SSH" durch
einen FTP-Upload.

## 1. Deploy-Schlüssel erzeugen

Auf dem eigenen Rechner:

```bash
ssh-keygen -t ed25519 -N "" -C mko-deploy -f mko-deploy
```

## 2. Schlüssel auf dem Server auf rsync beschränken

In `~/.ssh/authorized_keys` des Server-Benutzers eine Zeile ergänzen. Der
Schlüssel darf danach nur noch in den Webordner kopieren (`rrsync` liegt
rsync ab Version 3.2.4 bei):

```
command="rrsync /PFAD/ZUM/WEBORDNER",restrict <Inhalt von mko-deploy.pub>
```

## 3. GitHub-Secrets

Im Repository unter Settings → Secrets and variables → Actions:

| Secret | Inhalt |
|---|---|
| `DEPLOY_HOST` | Name oder IP des Servers für SSH |
| `DEPLOY_USER` | SSH-Benutzer |
| `DEPLOY_SSH_KEY` | Inhalt der privaten Datei `mko-deploy` |
| `DEPLOY_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan -t ed25519 <host>`, verglichen mit dem Host-Schlüssel auf dem Server |
| `DEPLOY_PATH` | Optional. Zielordner relativ zum rrsync-Ordner, Standard `./` |

Die private Schlüsseldatei danach vom Rechner löschen oder im
Passwortmanager ablegen.

## 4. Erster Lauf

Actions → Deploy → Run workflow, auf `main`. Der letzte Schritt ruft die
Startseite, das CSS, das JS und das Foto live ab. Schlägt eines davon fehl,
wird der Lauf rot.
