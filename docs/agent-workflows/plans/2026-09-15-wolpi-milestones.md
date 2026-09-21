# Wolpi-Erfolgsmomente

Freigegeben: 15. September 2026. Nach jeweils zehn bewerteten unterschiedlichen Karten eines Durchgangs erscheint ein wechselndes Wolpi-Bild für vier Sekunden. Jede Lernbewertung zählt; Aufdecken und Zurückstellen nicht. Am tatsächlichen Abschluss erscheint ein dauerhaftes Bild, auch unter zehn Karten; kein gleichzeitiger Zwischenjubel.

## Umsetzung

- [x] Renderer-Zustand `ui/studyCelebration.ts`: bestätigte Ereignisse pro Nutzer und Durchgang, eindeutige Karten, Rücknahme, persistierte gezeigte Schwellen und Motivwechsel. Speicherung lokal auf dem jeweiligen Gerät; keine Änderung der Lernalgorithmen oder Datenbank. Speicherfehler dürfen das Lernen nicht blockieren.
- [x] `ui/studySession.ts`: erfolgreich angewandte Befehle samt Antwort für die gemeinsame Anzeige bereitstellen. Sowohl direkte Bewertungen als auch erneutes Senden nutzen denselben Weg.
- [x] `components/StudyCelebration.vue` und `FlashcardsReviewView.vue`: sichtbares, schließbares Bild ohne Modal oder Fokuswechsel; kein verdeckter Karteninhalt, reduzierte Bewegung und hell/dunkel. Timer beim Wechsel, Undo, Pause und Verlassen aufräumen. Abschlussbild separat in der Zusammenfassung.
- [x] Tests zuerst: Schwelle, drei Einschätzungen, doppelte Ereignisse/Karten, Speicherausfall und Retry, Undo/Neubewertung, Laden/Fortsetzen, Nutzer-/Durchgangswechsel, Motivwechsel und Abschluss an einer Zehnerschwelle.
- [x] Hilfe, Über-Seite und Nutzerbeschreibung angleichen. Den alten Test, der Motivationsbilder pauschal verbietet, durch die Anforderung eines ununterbrochen bedienbaren Lernablaufs ersetzen.
- [x] Typecheck, relevante und vollständige Unit-Tests, Electron-E2E und visuelle Prüfung auf Desktop und Mobilbreite einschließlich Axe-Prüfung.
- [x] Isolierten Produktionsbuild aus dem bestehenden ausgelieferten Lernstand plus dieser Änderung erstellen. Unabhängige Podcaständerungen nicht veröffentlichen. Backup, Assets zuerst und Index zuletzt veröffentlichen; öffentliche Dateien und authentifizierten Lernablauf mit temporären Prüfdaten verifizieren.

## Prüfbare Erwartungen

9 Bewertungen: kein Bild. Zehnte erfolgreiche Bewertung: ein Bild und nächste Karte bedienbar. Fehlgeschlagenes Speichern: kein Fortschritt und kein Jubel. Retry: ein Ereignis. Undo von zehn auf neun, danach Neubewertung: kein zweites Zehnerbild. Reload nach neun: die nächste Bewertung erreicht zehn. Neuer Durchgang und anderes Konto: unabhängiger Zähler. Bei zehn Karten Gesamtumfang: nur Abschlussbild; bei einer Karte ebenfalls Abschlussbild.

Die lokalen Motivationsdaten ergänzen die gespeicherten Lernstände; sie werden nicht zwischen Geräten synchronisiert. Bereits beim Öffnen vorhandene Bewertungen lösen keine nachträgliche Serie von Bildern aus.
