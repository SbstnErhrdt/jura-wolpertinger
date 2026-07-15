# Voice Profile Personalization Design

## Ziel

Die Sprachwiederholung soll natuerlicher werden: Nutzer koennen die Voice-Session muendlich beenden, Wolpi spricht konsequent Deutsch, stellt sich nur einmal pro Uebungsrunde vor und kann den Nutzer mit Vornamen ansprechen.

## Design

- Voice-Kommandos werden im Renderer lokal aus finalen deutschen Transkripten erkannt: `next_card`, `previous_card`, `end_session`.
- `end_session` stoppt nur die Voice-Verbindung. Es wird kein Review-Event und keine Bewertung erzeugt.
- Die erste Voice-Session einer Uebungsrunde sendet eine Vorstellung. Danach wird nur noch die aktuelle Karte gestellt.
- Wenn ein Vorname bekannt ist, lautet die Vorstellung personalisiert: `Hallo {Vorname}, ich bin Wolpi ...`.
- Deutsch ist in Client-Greeting, Realtime-Transcription und Backend-Prompt explizit festgelegt.
- Cloud-Profile werden in `public.user_profiles` gespeichert. RLS erlaubt nur Zugriff auf das eigene Profil.
- Die Home-Seite zeigt angemeldeten Cloud-Nutzern eine Profilbox, solange der Vorname fehlt. Das Formular erscheint in einem Modal.

## Datenmodell

`public.user_profiles`

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `first_name text`
- `last_name text`
- `created_at timestamptz`
- `updated_at timestamptz`

## Tests

- Renderer Voice-Parser erkennt `end_session` und vermeidet Fehltrigger bei normalen Antworten.
- Renderer-Greeting unterscheidet erste und weitere Karten.
- Home-UI enthaelt Profilbox und Modal.
- Cloud-API liest und schreibt `user_profiles`.
- Voice-API reicht `firstName` in den Realtime-Prompt durch.
