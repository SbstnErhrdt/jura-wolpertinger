# User Stories

Diese Datei beschreibt die wichtigsten Nutzerbedürfnisse für Jura Wolpertinger. Sie soll bei neuen Produkt-, UI- und Workflow-Änderungen aktualisiert werden.

## Primäre Nutzer

- Examenskandidat:in: schreibt regelmäßig Übungsklausuren und möchte Fortschritt, Schwächen und Bewertungen nachvollziehen.
- Examenskandidat:in mit Smartphone: wiederholt Karteikarten unterwegs und möchte schnell in eine kurze Lerneinheit starten.
- Lerngruppe: nutzt dieselbe App auf einem Rechner oder tauscht Prüfungs- und Karteikarten-Dateien aus.
- Korrektor:in oder Lernpartner:in: bewertet abgegebene Klausuren und setzt konkrete Hinweise am Text.
- Release-Operator:in: erstellt, prüft und veröffentlicht plattformspezifische Desktop-Releases, ohne unvollständige Kandidaten live zu schalten.

## Übergreifende UI-Regeln

### Inhalte sicher erstellen und bearbeiten

Als Nutzer:in möchte ich Inhalte in klaren Dialogen oder Detailseiten erstellen und bearbeiten, damit ich nicht versehentlich Listen oder Übersichten verändere.

Akzeptanz:

- Erstellen und Bearbeiten passiert in Modals oder eigenen Detailseiten, nicht als Inline-Formular in Übersichten.
- Untergeordnete Inhalte entstehen im richtigen Kontext, z. B. Karteikarten innerhalb einer geöffneten Sammlung.
- Speichern, Abbrechen und Pflichtfelder sind eindeutig erkennbar.

### Kritische Aktionen bestätigen

Als Nutzer:in möchte ich vor Löschen, Archivieren oder Entfernen eine verständliche Rückfrage sehen, damit ich keine Daten aus Versehen verliere.

Akzeptanz:

- Destruktive Aktionen öffnen ein Confirm-Modal.
- Das Modal beschreibt konkret, was passiert und ob Inhalte wiederherstellbar sind.
- Primäre und sekundäre Aktion sind klar unterscheidbar.

## Home und Motivation

### Motivierend starten

Als Examenskandidat:in möchte ich beim App-Start beziehungsweise nach der Anmeldung einen knappen Home Screen sehen, damit ich sofort weiß, was als nächstes zu tun ist.

Akzeptanz:

- Home zeigt Streak, fällige Karteikarten und schnelle Aktionen für Wiederholen und Prüfung schreiben.
- Die Oberfläche ist freundlich und motivierend, aber nicht verspielt.
- Vorhandene Wolpertinger-/Tiergrafiken können als visueller Einstieg genutzt werden.
- Umfangreiche Analyse bleibt auf eigenen Auswertungsseiten.

### Streak erhalten

Als Nutzer:in möchte ich für echte Lerneinheiten einen Streak sehen, damit ich regelmäßig lerne, ohne durch notwendige Pausen frustriert zu werden.

Akzeptanz:

- Karteikarten-Bewertungen und geschriebene Prüfungen zählen als Lernaktivität.
- App öffnen, Karten nur ansehen oder Einstellungen ändern zählen nicht.
- Pro Woche gibt es zwei freie Tage, die den Streak erhalten, aber nicht erhöhen.
- Die Berechnung nutzt die lokale Zeitzone.

## Karteikarten

### Karteikarten organisieren

Als Examenskandidat:in möchte ich Karteikarten in Sammlungen, Ordnern und Schlagwörtern organisieren, damit ich Rechtsgebiete und Lernstände sauber trennen kann.

Akzeptanz:

- Sammlungen sind fachliche Kartensätze.
- Ordner dienen der persönlichen Ablage.
- Schlagwörter filtern Karten über Sammlungen und Ordner hinweg.
- Eine Karte gehört genau zu einer Sammlung.

### Karteikarten selbst erstellen

Als Nutzer:in möchte ich ohne technische Begriffe neue Karteikarten schreiben können, damit ich eigene Lerninhalte schnell in die Wiederholung bekomme.

Akzeptanz:

- Die Kartenverwaltung bietet eine klare Aktion `Neue Karteikarte`.
- Nutzer:innen öffnen zuerst eine Sammlung und erstellen die Karteikarte dort.
- Nutzer:innen schreiben Vorderseite und Rückseite und können optional Schlagwörter setzen.
- Nach dem Speichern ist die Karte sofort in der Sammlung sichtbar und zählt für die Wiederholung.
- Datei-Funktionen sprechen von Karteikarten-Dateien, nicht von technischen Formaten.
- Die Sammlungsdetailseite zeigt alle Karten der Sammlung mit Suche, Sortierung, Fälligkeit, letzter Bewertung und Wiederholungskennzahlen.

### Karteikarten wiederholen

Als Nutzer:in möchte ich Karteikarten auf dem Handy und Laptop schnell wiederholen, damit kurze Lerneinheiten ohne Reibung möglich sind.

Akzeptanz:

- Der Wiederholen-Flow zeigt Vorderseite und Rückseite.
- Die Bewertung nutzt die vier Optionen Nochmal, Schwer, Gut und Leicht.
- Nach der Bewertung erscheint kurz das nächste Intervall und dann automatisch die nächste Karte.
- Nochmal-Karten erscheinen innerhalb derselben Lerneinheit erneut.
- Der Flow ist mobil mit großen, gut tappbaren Flächen nutzbar.

### Karten beim Lernen korrigieren

Als Nutzer:in möchte ich fehlerhafte Karten direkt aus dem Lernfluss heraus korrigieren können, damit schlechte Karten nicht im System bleiben.

Akzeptanz:

- Ein kleines Aktionsmenü bietet Bearbeiten, Schlagwörter ändern und Aus aktueller Lerneinheit entfernen.
- Das Menü unterbricht den Lernfluss nicht prominent.
- Änderungen werden in der normalen Kartenverwaltung sichtbar.

### Sammlungen übernehmen

Als Nutzer:in möchte ich Karteikarten-Dateien oder später geteilte Sammlungen als eigene Kopie übernehmen, damit ich sie bearbeiten kann, ohne das Original zu verändern.

Akzeptanz:

- Beim Übernehmen entsteht eine eigene Sammlung.
- Schlagwörter werden in die eigene Kopie übernommen.
- Review-Historie, private Notizen, Mitglieder und Rechte werden nicht übernommen.
- Der Nutzer wählt einen Zielordner; Default ist Unsortiert.
- Die Oberfläche spricht von Karteikarten-Dateien auswählen oder sichern, nicht vom technischen Dateiformat.

## Bibliothek und Organisation

### Klausur anlegen

Als Examenskandidat:in möchte ich schnell eine neue Klausur anlegen, damit ich ohne organisatorische Hürden mit dem Schreiben beginnen kann.

Akzeptanz:

- Titel, Ordner und Schlagwörter können beim Anlegen gesetzt werden.
- Die Klausur erscheint sofort in der Bibliothek.
- Ohne Ordner bleibt die Klausur auffindbar.

### Ordner nutzen

Als Nutzer:in möchte ich Klausuren nach Rechtsgebiet oder Kurs organisieren, damit ich ältere Arbeiten schnell wiederfinde.

Akzeptanz:

- Ordner können erstellt, umbenannt und archiviert werden.
- Klausuren können per Drag-and-drop verschoben werden.
- Archivieren löscht Inhalte nicht endgültig.

### Rechtsklick-Aktionen

Als Nutzer:in möchte ich auf Klausuren ein Kontextmenü öffnen, damit wichtige Aktionen ohne Umwege erreichbar sind.

Akzeptanz:

- Kontextmenü bietet Anzeigen, Bearbeiten, Umbenennen, Archivieren, Datei sichern und PDF sichern.
- Aktionen sind klar benannt und beschädigen keine Daten.

## Schreiben und Abgeben

### Prüfungsnah schreiben

Als Examenskandidat:in möchte ich in einem ruhigen Prüfungsmodus schreiben, damit ich mich auf die Klausur konzentrieren kann.

Akzeptanz:

- Der Prüfungsmodus hat eine reduzierte, stabile Oberfläche.
- Heller und dunkler Modus funktionieren.
- Der Text wird automatisch im aktuellen Arbeitsbereich gespeichert: lokal in der Desktop-App, online in der Web-App.

### Arbeit wiederherstellen

Als Nutzer:in möchte ich nach Stromausfall oder App-Absturz weiterarbeiten können, damit keine Klausur verloren geht.

Akzeptanz:

- Autosaves erzeugen lokale Revisionen.
- Nach Neustart ist die letzte gespeicherte Fassung verfügbar.
- Anhänge werden in den App-Speicher kopiert.

### Quellen und Musterlösungen verwalten

Als Referendar:in möchte ich Aufgabenstellung, Bearbeitervermerk und Musterlösung einer Prüfung zuordnen, damit eine spätere KI-Korrektur den richtigen Kontext nutzt.

Akzeptanz:

- Rechtsgebiet, Klausurtyp, Quelle und optionale URL können an der Prüfung gespeichert werden.
- Uploads erhalten Rollen wie Aufgabenstellung, Bearbeitervermerk oder Musterlösung.
- Fremde Klausurentexte werden nicht mitgeliefert, sondern nur durch Nutzer:innen hochgeladen oder zugeordnet.

### Klausur abgeben

Als Examenskandidat:in möchte ich eine Klausur abgeben, damit ein fester Bewertungsstand entsteht.

Akzeptanz:

- Die Abgabe erzeugt einen unveränderlichen Snapshot.
- Danach kann weiter am Entwurf gearbeitet werden.
- Die Bewertung bezieht sich auf die Abgabe, nicht auf spätere Bearbeitungen.

## Bewertung und Kommentare

### Abgaben auswählen

Als Korrektor:in möchte ich alle abgegebenen Klausuren links sehen, damit ich schnell zwischen Bewertungen wechseln kann.

Akzeptanz:

- Die linke Spalte bleibt sichtbar.
- Nur der rechte Arbeitsbereich scrollt.
- Bereits bewertete Abgaben sind erkennbar.

### Gesamtbewertung setzen

Als Korrektor:in möchte ich Punkte und Gesamthinweis erfassen, damit die Bewertung vollständig dokumentiert ist.

Akzeptanz:

- Punkte folgen dem Bayern-System `0-18` inklusive halber Punkte.
- Bewertete Abgaben erhalten eine klare visuelle Markierung.
- Es wird angezeigt, wie lange eine Abgabe auf Bewertung wartet.

### Inline-Kommentare setzen

Als Korrektor:in möchte ich Textstellen markieren und direkt kommentieren, damit Feedback präzise am Dokument steht.

Akzeptanz:

- Bei Textauswahl erscheint ein Kommentar-Popup nahe der Auswahl.
- Kommentare werden in der Randspalte ungefähr auf Höhe der Textstelle angezeigt.
- Hover über einen Kommentar hebt die zugehörige Textstelle hervor.

### KI-Korrektur im Desktop prüfen

Als Examenskandidat:in möchte ich in der Desktop-App für eine abgegebene Prüfung einen KI-Korrekturvorschlag anfordern und vor der Übernahme prüfen, damit automatisches Feedback nicht ungeprüft meine Bewertung verändert.

Akzeptanz:

- Die Anfrage wird nur bewusst gestartet und nutzt den lokal hinterlegten eigenen KI-Schlüssel.
- `gpt-5.5` ist das empfohlene Standardmodell für die komplexe Korrektur.
- Die KI-Korrektur nutzt Aufgabenstellung, Musterlösung und Bearbeitung, sofern diese als Anhänge vorliegen.
- Der Vorschlag wird durch eine zweite KI-Prüfer-Runde auf Punktplausibilität, Halluzinationen, Textanker und konkrete Verbesserungshinweise geprüft.
- Die Einstellungen zeigen für normale Nutzer:innen klar, ob KI-Korrektur eingerichtet ist oder noch eingerichtet werden muss.
- Hinweise zu Entwicklungszugängen erscheinen nur in lokalen Entwicklungsumgebungen und nicht in der Web-App.
- Nach dem Speichern zeigt die App eine kurze Endung des Schlüssels und den Speicherzeitpunkt, damit der Zustand sichtbar ist.
- Der KI-Schlüssel wird nur in einem bewussten Einrichten- oder Ändern-Flow eingegeben; die normale Ansicht zeigt kein leeres Passwortfeld.
- Eine Verbindung kann aus der App heraus getestet werden; laufender Test, Erfolg und Fehler erscheinen direkt in der KI-Karte.
- Der Vorschlag zeigt Punkte, Gesamthinweis, Schlagwörter, Inline-Kommentare und Lernhinweise als Entwurf.
- Annehmen überführt den Entwurf in normale Korrektur, Inline-Kommentare und Lernaufgaben.
- Ablehnen verwirft den Vorschlag für den Arbeitsfluss, ohne Abgabe oder bestehende Korrektur zu verändern.
- Rohentwürfe, KI-Schlüssel und KI-Einstellungen werden nicht in Prüfungsdateien übernommen.

### Online-KI-Grenze verstehen

Als Nutzer:in möchte ich in der Web-App erkennen, warum KI-Korrektur nicht verfügbar ist, damit die Funktion nicht kaputt wirkt.

Akzeptanz:

- KI-Korrektur bleibt in Navigation und Prüfungskontext sichtbar.
- In der Online-Version ist die Aktion deaktiviert.
- Die UI erklärt kurz, dass KI-Korrektur online noch nicht freigeschaltet ist.
- Die Desktop-Version kann weiterhin den eigenen KI-Schlüssel nutzen.

## Schlagwörter und Auswertung

### Schlagwörter konsequent nutzen

Als Examenskandidat:in möchte ich Klausuren und Korrekturen verschlagworten, damit spätere Auswertungen aussagekräftig sind.

Akzeptanz:

- Schlagwörter können schnell als Chips eingegeben werden.
- Sinnvolle Vorschläge unterstützen Rechtsgebiet, Prüfungsgebiet, Klausurtyp und Fehlergruppe.
- Die Tour erklärt Schlagwörter ohne technische Begriffe.

### Fortschritt auswerten

Als Nutzer:in möchte ich Punkte und Schlagwörter auswerten, damit ich erkenne, wo ich besser werde und wo ich wiederholen sollte.

Akzeptanz:

- Zeitraumfilter und Schlagwort-Filter bleiben nach erneutem Öffnen erhalten.
- Durchschnitt, Verlauf und Tabellenansicht sind sichtbar.
- Auswertungen funktionieren offline.

### Lernaufgaben nachverfolgen

Als Examenskandidat:in möchte ich Lernaufgaben aus angenommenen KI-Korrekturen in der Auswertung sehen, damit ich wiederkehrende Schwächen gezielt bearbeiten kann.

Akzeptanz:

- Offene Lernaufgaben erscheinen lokal in der Auswertung.
- Lernaufgaben haben Kategorie, Priorität und Status.
- Statusänderungen bleiben lokal erhalten.
- Lernaufgaben werden vorerst nicht in Prüfungsdateien übernommen.

## Datenschutz und Online-Grenze

### Lokale Daten schützen und Online-Nutzung verstehen

Als Nutzer:in möchte ich klar verstehen, welche Daten lokal bleiben und welche Daten ich bewusst online nutze, damit ich Prüfungsdaten kontrolliert verwalte.

Akzeptanz:

- Die Desktop-App funktioniert ohne Account und speichert lokal.
- Die Web-App speichert Daten nach der Anmeldung online auf dem Betreiber-Server.
- Ohne Anmeldung werden in der Web-App keine App-Daten geladen.
- Eine Verbindung zwischen Desktop und Online-Konto wird bewusst gestartet; lokale Daten gehen dabei nicht verloren.
- Daten an einen KI-Anbieter werden nur bei ausdrücklicher KI-Korrektur übertragen.
- Prüfungsdateien enthalten Prüfungsdaten wie Metadaten, Abgaben, Korrekturen und Attachment-Rollen, aber keine KI-Schlüssel, KI-Einstellungen, rohe KI-Entwürfe oder lokale Lernaufgaben.

## Installation und Updates

### Passenden Desktop-Build erhalten

Als Desktop-Nutzer:in möchte ich auf der Projektseite nur den aktuellen stabilen Build für mein System angeboten bekommen, damit ich keine internen Kandidaten oder unpassenden Architekturen installiere.

Akzeptanz:

- Die Downloadseite liest ausschließlich das öffentliche Stable-Manifest.
- Angeboten werden macOS ARM64, macOS Intel, Windows x64 und Linux x64.
- Ist der Feed nicht erreichbar oder unvollständig, zeigt die Seite einen Fehler statt eines veralteten Ersatzlinks.
- Die Installation ist nicht von einem öffentlichen GitHub-Repository oder GitHub Release abhängig.

### Update bewusst installieren

Als Desktop-Nutzer:in möchte ich über ein verfügbares stabiles Update informiert werden und den Neustart selbst bestätigen, damit meine laufende Arbeit nicht unerwartet unterbrochen wird.

Akzeptanz:

- Die App prüft nur den plattform- und architekturgerechten Stable-Feed.
- Ein Feed- oder Netzwerkfehler verhindert den App-Start nicht.
- Das Update darf im Hintergrund heruntergeladen werden.
- Die Installation beginnt erst nach der ausdrücklichen Aktion `Jetzt neu starten`; `Später` beendet die laufende Sitzung nicht.

### Release-Kandidaten getrennt veröffentlichen

Als Release-Operator:in möchte ich Windows- und Linux-Kandidaten in CI sowie signierte macOS-Kandidaten lokal unveränderlich bereitstellen, damit Build und Live-Schaltung getrennte, überprüfbare Schritte bleiben.

Akzeptanz:

- Ein Stage- oder Dry-Run-Befehl ändert weder `latest*.yml` noch `manifest.json`.
- Jede Plattform wird vor dem Umschalten ihrer Live-Metadatei vollständig remote validiert.
- Die Veröffentlichung verlangt die exakte Bestätigung `publish <version>`.
- Das globale Manifest wird erst nach den vier Plattform-Metadateien geschrieben.
- Eine bereits gestagte ältere Version kann durch erneutes Publizieren ihrer Metadaten als Rollback aktiviert werden; installierte neuere Apps werden nicht automatisch heruntergestuft.

## Nutzer und Onboarding

### Web-App anmelden

Als Nutzer:in möchte ich mich in der Web-App selbst registrieren und anmelden, damit ich den Service ohne Einladung nutzen kann.

Akzeptanz:

- `app.jura-wolpi.de` zeigt ohne gültige Anmeldung nur Anmeldung und Account-Erstellung.
- Ohne Anmeldung werden keine App-Daten, Demo-Daten oder zwischengespeicherten Browserdaten geladen.
- Nach der Anmeldung wird eine notwendige Hinweisbestätigung geprüft, bevor die App-Shell erscheint.
- Wenn die Anmeldung abläuft, kehrt die Web-App zur Anmeldeseite zurück.

### Lokale App mit Online-Konto verbinden

Als Desktop-Nutzer:in möchte ich mein lokales Profil mit einem Online-Konto verbinden, damit ich später Daten synchronisieren kann.

Akzeptanz:

- Die Desktop-App funktioniert weiterhin ohne Account.
- Neue Nutzer:innen wählen im Einstieg zwischen `Auf diesem Gerät starten` und `Mit Online-Sicherung starten`.
- Bestehende lokale Arbeitsbereiche können die Online-Sicherung später in den Einstellungen einrichten.
- Lokale Daten gehen beim Verbinden nicht verloren.
- Nach dem Verbinden fragt die App nach der Richtung: alles abgleichen, online sichern oder auf dieses Gerät holen.
- Die Einstellungen zeigen, ob der Arbeitsbereich nur lokal liegt, bereit zum ersten Abgleich ist oder zuletzt online gesichert wurde.
- Der Datenfluss zwischen diesem Gerät, Online-Sicherung und anderen Geräten ist sichtbar erklärt.
- Konflikte werden nicht still überschrieben.
- Lokale und Online-Identität bleiben nachvollziehbar verknüpft.

### Einstellungen zentral verwalten

Als Nutzer:in möchte ich Nutzer, Online-Verbindung, KI-Korrektur und Oberfläche an einer Stelle einstellen, damit ich die App nicht in einzelnen Arbeitsansichten konfigurieren muss.

Akzeptanz:

- Die linke Navigation enthält eine Einstellungsseite.
- Nutzerwechsel, Nutzername, neuer lokaler Nutzer und Tour-Aktionen sind dort erreichbar.
- In der Desktop-App können KI-Zugang und Modell für KI-Korrekturen gespeichert werden.
- In der Web-App ist klar sichtbar, dass KI-Korrektur online noch nicht freigeschaltet ist.
- Die Seite erklärt, dass KI-Korrekturen Daten nur auf ausdrückliche Anfrage an den konfigurierten KI-Anbieter übertragen.

### Arbeitsbereich wechseln

Als Desktop-Nutzer:in möchte ich zwischen meinem Arbeitsbereich und Demo-Daten wechseln, damit ich die App ausprobieren kann, ohne eigene Daten zu vermischen.

Akzeptanz:

- Nutzerwechsel ist in der Sidebar erreichbar.
- Daten bleiben pro Arbeitsbereich getrennt.
- Der Wechsel ist schnell und nachvollziehbar.
- Die Web-App zeigt Demo- oder zwischengespeicherte Browserdaten nicht vor der Anmeldung.

### Einstiegstour nutzen

Als neue:r Nutzer:in möchte ich gefragt werden, ob ich eine Tour sehen möchte, damit ich die wichtigsten Arbeitsabläufe schnell verstehe.

Akzeptanz:

- Der Welcome-Screen zeigt das Welcome-Bild.
- Die Tour kann gestartet oder übersprungen werden.
- Die Tour kann später über Sidebar oder Hilfe erneut gestartet werden.
- Technische Begriffe erscheinen nicht in der Tour.

### Hilfe finden

Als Nutzer:in möchte ich eine Hilfeseite mit kurzen Antworten, damit ich bei typischen Fragen nicht suchen muss.

Akzeptanz:

- FAQ beantwortet Offline-Speicherung, Nutzerwechsel, Schlagwörter, Bewertung und Papierkorb.
- Die Tour ist von der Hilfeseite aus erneut startbar.
- Texte sind nutzerfreundlich und nicht technisch formuliert.
