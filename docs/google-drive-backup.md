# Google-Drive-Sicherung einrichten

Die App sichert alle Daten automatisch in Google Drive (Ordner „Speiseplan Sicherungen“, eine Datei pro Tag, 30 Tage). Die Anmeldung läuft über die Vercel-Funktionen in `api/google/*`; dafür braucht Vercel zwei Umgebungsvariablen aus einem Google-Cloud-Projekt.

## 1. Google Cloud (einmalig, ca. 10 Minuten)

1. <https://console.cloud.google.com/> → neues Projekt anlegen (z.B. „Speiseplan“).
2. **APIs & Dienste → Bibliothek** → „Google Drive API“ → **Aktivieren**.
3. **APIs & Dienste → OAuth-Zustimmungsbildschirm**: Nutzertyp **Extern**, App-Name „Speiseplan“, eigene E-Mail eintragen. Bereich (Scope) `.../auth/drive.file` hinzufügen.
4. Unter **Zielgruppe / Veröffentlichungsstatus** auf **„In Produktion“** stellen. Wichtig: Im Status „Test“ läuft die Anmeldung nach 7 Tagen ab und die automatische Sicherung stoppt. `drive.file` ist ein nicht-sensibler Bereich, eine Google-Prüfung ist dafür nicht nötig.
5. **APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID**: Typ **Webanwendung**, unter **Autorisierte Weiterleitungs-URIs** eintragen:
   `https://<DEINE-APP-ADRESSE>/api/google/callback`
   (genau die Adresse, unter der die App auf dem Handy geöffnet wird).
6. Client-ID und Clientschlüssel kopieren.

## 2. Vercel

Projekt `speiseplan` → **Settings → Environment Variables** (Environment: Production):

- `GOOGLE_CLIENT_ID` = Client-ID
- `GOOGLE_CLIENT_SECRET` = Clientschlüssel

Danach unter **Deployments** das letzte Deployment **Redeploy**en.

## 3. In der App

Archiv → Datensicherung → **Mit Google Drive verbinden** → Google-Konto wählen → zustimmen. Ab dann wird jede Änderung nach ca. 15 Sekunden automatisch gesichert.

Nach einer Neuinstallation: wieder verbinden → die App zeigt die Sicherungen aus Drive zur Auswahl an. Eine leere App lädt nie automatisch etwas hoch, und ein neues Gerät überschreibt vorhandene Drive-Sicherungen nicht ungefragt.
