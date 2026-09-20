# Karteikarten: Fortschritt, Suche und nächster Lernschritt

Stand: 20. September 2026. Die Funktionsauswahl und die Reihenfolge „Wiederholen → Fortsetzen → Neu anfangen“ wurden im Gespräch freigegeben. Diese schriftliche Spezifikation steht zur abschließenden Durchsicht bereit; die Implementierung hat noch nicht begonnen.

## Ziel und Umfang

Die Sammlungsübersicht soll auch bei vielen Sammlungen einen verständlichen Einstieg bieten. Oberhalb der Sammlungssuche steht genau eine begründete Empfehlung. Jede Sammlung zeigt ihren Bearbeitungsfortschritt. Die freie Auswahl bleibt erhalten.

Enthalten sind die gemeinsame Sammlungsansicht im Karteikarten-Hub und auf der Sammlungsroute, ihre Datenanbindung sowie die zugehörigen Tests und Hilfetexte. Nicht enthalten sind Änderungen an Karteninhalten, Bewertungen, Wiederholungsintervallen, bestehenden Durchgängen, Kontozuordnungen oder ein Produktionsdeployment. Keine neuen Abhängigkeiten.

## 1. Eine Empfehlung: „Als Nächstes lernen“

Die Empfehlung berücksichtigt alle zugänglichen Sammlungen des aktuellen Nutzers, unabhängig von Suchbegriff oder sichtbarer Ergebnisseite. Sie zeigt Sammlungsname, Rechtsgebiet, eine kurze Begründung und genau eine primäre Lernaktion. Darunter bleibt die reguläre Auswahl verfügbar.

Die Auswahl ist deterministisch und verwendet ausschließlich vorhandene Lernstände:

1. **Fällige Wiederholungen:** Eine Sammlung mit bereits bewerteten, jetzt fälligen und lernbaren Karten. Unter mehreren Kandidaten gewinnt die mit den meisten fälligen Karten. Beispiel: „12 Karten sind zur Wiederholung fällig.“ Der Button „Jetzt wiederholen“ öffnet ausdrücklich den Modus `review`; ein parallel laufender erster Durchgang darf ihn nicht ersetzen.
2. **Durchgang fortsetzen:** Wenn keine Wiederholungen fällig sind, wird der zuletzt aktualisierte aktive Durchgang mit offenen, lernbaren Karten vorgeschlagen. Die Begründung nennt die noch offenen Karten. Der Button setzt genau diesen Durchgang mit seiner ID und seinem Modus fort. Besteht der Rest nur aus zurückgestellten Karten, wird dies ausdrücklich benannt.
3. **Neue Karten bearbeiten:** Ohne fällige Wiederholungen und ohne aktiven Durchgang wird die Sammlung mit der kleinsten positiven Zahl noch nicht bearbeiteter, lernbarer Karten angeboten. So erhalten auch teilweise bearbeitete Sammlungen ohne aktiven Durchgang einen Einstieg. Bei einer vollständig neuen Sammlung lautet die Begründung beispielsweise „Ein überschaubarer Einstieg mit 28 Karten“, sonst „Noch 8 Karten erstmals bearbeiten“. Die Aktion öffnet `first_pass`.

Bei Gleichstand entscheidet die stabile Sammlungs-ID. Leere Sammlungen und solche ohne lernbare Karten sind nie Kandidaten. Die Empfehlung erstellt beim bloßen Anzeigen keinen Durchgang und verändert keine Lerndaten.

Sind alle lernbaren Karten bereits bearbeitet, kein Durchgang offen und keine Wiederholungen fällig, erscheint: „Aktuell ist nichts zur Wiederholung fällig. Du kannst unten eine Sammlung frei auswählen.“ Es wird kein dringender Lernbedarf erfunden. Fehlen Sammlungen beziehungsweise lernbare Karten vollständig, wird stattdessen dieser konkrete Zustand erklärt.

Keine Behauptungen über besondere Examensrelevanz, sichere Beherrschung, wissenschaftlich optimale Reihenfolgen oder geschätzte Lernminuten. Die Empfehlung ist eine transparente Orientierung, keine verpflichtende Reihenfolge.

## 2. Fortschrittsbalken pro Sammlung

Am unteren Rand jeder Übersichtskarte steht ein Balken mit dem sichtbaren Text „32 von 80 Karten einmal bearbeitet · 40 %“.

- Zähler: `reviewedCards`; Nenner: `eligibleCards` aus derselben Lernübersicht. Beide beziehen sich auf nicht archivierte, aktuell lernbare Karten.
- „Einmal bearbeitet“ bedeutet mindestens einmal bewertet, unabhängig von der Bewertung. Es bedeutet nicht „sicher beherrscht“.
- Prozentanzeige ganzzahlig, Balken im Bereich 0–100 %. Solange Karten offen sind, darf Rundung keine vollständigen 100 % behaupten.
- Pausierte Karten werden separat als „N Karten pausiert“ erklärt und nicht stillschweigend in den Nenner aufgenommen.
- Bei null lernbaren Karten: „Keine lernbaren Karten“, kein abgeschlossener Balken und kein Lernstart. Die Sammlung bleibt zum Öffnen erreichbar.
- Bei fehlenden Lerndaten wird kein fiktiver Nullfortschritt gezeigt. Stattdessen erscheint ein Lade- beziehungsweise Fehlerzustand.
- Der Balken besitzt einen zugänglichen Namen mit Sammlungskontext und einen verständlichen Werttext. Farbe allein vermittelt keine Information.

Die vorhandenen Aktionen zum Lernen und Öffnen bleiben bestehen. Ihre Ausrichtung und die Abstände werden vereinheitlicht; die Empfehlung ändert nicht die bisherige Standardaktion innerhalb einzelner Sammlungskarten.

## 3. Suche und Ergebnisliste

Eine sichtbar beschriftete Suche „Sammlungen suchen“ findet Namen und Rechtsgebiete im gesamten Bestand des aktuellen Nutzers. Groß-/Kleinschreibung ist unerheblich; Leerraum am Anfang und Ende wird ignoriert. Texteingaben werden als Suchtext und nicht als Abfragesyntax behandelt.

- Suche nach kurzer Eingabepause von 250 ms; ein neuer Suchbegriff setzt die Ergebnisseite zurück.
- Anzeige der Trefferzahl sowie „Suche zurücksetzen“, sobald ein Suchbegriff aktiv ist.
- Cloud-Suche und Begrenzung erfolgen serverseitig. Keine vollständigen Kartendaten herunterladen und im Renderer filtern.
- Ergebnisse werden in Seiten von 24 Sammlungen geladen, in stabiler Reihenfolge. Bei mehr Treffern gibt es klar beschriftete Vor-/Zurück-Aktionen.
- Desktop und lokaler Browsermodus liefern dieselben Such- und Ergebnissemantiken über ihre bestehenden Adapter.
- Veraltete Antworten einer früheren Suchanfrage dürfen neuere Ergebnisse nicht überschreiben.
- „Noch keine Sammlungen“ und „Keine passenden Sammlungen gefunden“ sind getrennte Zustände. Bei fehlenden Treffern bleibt das Zurücksetzen direkt erreichbar.
- Ladefehler bieten „Erneut versuchen“. Eine fehlgeschlagene Anfrage wird nicht als leere Trefferliste ausgegeben.

Die Empfehlung bleibt beim Suchen unverändert und wird als Vorschlag aus allen Sammlungen kenntlich gemacht. Ein Suchfilter verändert nicht unbemerkt den Umfang eines gestarteten Durchgangs.

## 4. Datenfluss und technische Grenzen

Die bestehende `FlashcardsCollectionsView.vue` bleibt der Einstieg. Eine kleine, unabhängig testbare Auswahllogik beschreibt Empfehlungstyp, Begründungsdaten und das exakt passende Lernziel. Die vorhandenen Lernmodi und Fortschrittsdefinitionen bleiben maßgeblich.

Für die Übersicht werden paginierte Sammlungssummaries einschließlich ihrer Fortschrittswerte sowie eine globale Empfehlung benötigt. Cloud-Abfragen liefern nur diese begrenzten Ergebnisse und aggregierten Empfehlungsdaten; sie sind durch die vorhandene Nutzerzuordnung geschützt. Die Suche darf nicht nur die aktuell geladenen Sammlungen durchsuchen, und die Empfehlung darf nicht nur aus der ersten Ergebnisseite gewählt werden.

Die bestehenden unpaginierten Schnittstellen anderer Ansichten werden nicht beiläufig umgestellt. Neue beziehungsweise erweiterte Schnittstellen sind über Shared Types, Browser-/Cloud-Adapter, Main-Service, IPC und Preload konsistent abzubilden. Server-Erweiterungen werden als versionierte SQL-Migration im benachbarten `jura-supabase`-Projekt abgelegt. Für die beschriebenen Funktionen sind keine neuen persistenten Lernfelder nötig.

Anzeige und Suche bleiben lesend. Bestehende Änderungen in beiden Projekten werden erhalten; es werden keine fremden Änderungen in einen Feature-Commit aufgenommen. Änderungen an `HelpView.vue`, `AboutView.vue` und `docs/user-stories.md` erläutern Fortschritt und Empfehlung in Nutzersprache.

## 5. Darstellung und Prüfung

Das bestehende ruhige Farbsystem und die vorhandenen UI-Komponenten bleiben erhalten. Die Empfehlung dominiert durch Position und klare Handlungsaufforderung, nicht durch zusätzliche Animationen oder mehrere konkurrierende Vorschläge. Lange Titel, schmale Displays, Tastaturbedienung sowie heller und dunkler Modus werden berücksichtigt.

Tests werden vor der jeweiligen Implementierung geschrieben und zunächst mit dem erwarteten Fehler ausgeführt. Abgedeckt werden:

- Vorrang fälliger Wiederholungen vor aktiven Durchgängen und neuen Karten; stabile Auswahl bei Gleichstand.
- Passende Navigation: `review` trotz anderem aktivem Durchgang, exakte Fortsetzung, `first_pass` für neue Karten.
- Leere, pausierte, abgeschlossene und vollständig zurückgestellte Sammlungen; keine ungerechtfertigten Empfehlungen.
- Fortschritt bei 0, teilweise und vollständig bearbeiteten Karten, pausierten Karten und fehlenden Daten.
- Suche über Seitengrenzen, Trefferzahl, Reset, konkurrierende Antworten sowie Nutzerisolation der Cloud-Abfrage.
- Ein echtes UI-Szenario mit Suche, Fortschrittsanzeige und dem Start der empfohlenen Sammlung; mobile Darstellung und Hell-/Dunkelmodus.

Vor Abschluss: Typecheck, relevante Shared-/Adapter-/Service-/Renderer-Tests, SQL-Tests für neue Cloud-Funktionen und relevante UI-/Accessibility-Prüfungen. Nicht ausführbare Checks werden ausdrücklich benannt. Ein lokaler Erfolg wird nicht als bereits veröffentlichtes Feature dargestellt.

## Selbstprüfung

Die Empfehlung und die Einzelkartenaktionen haben bewusst unterschiedliche Prioritäten; ihr jeweiliges Lernziel ist eindeutig. Fortschritt misst Bearbeitung, nicht Wissen. Suche und Empfehlung gelten über den gesamten Nutzerbestand und laden keine vollständigen Kartensammlungen zum clientseitigen Filtern. Die Änderungen sind auf die Orientierung in der Sammlungsübersicht begrenzt.
