# User Stories

Diese Datei beschreibt die wichtigsten Nutzerbedürfnisse für Jura Wolpertinger. Sie soll bei neuen Produkt-, UI- und Workflow-Änderungen aktualisiert werden.

## Primäre Nutzer

- Examenskandidat:in: schreibt regelmäßig Übungsklausuren und möchte Fortschritt, Schwächen und Bewertungen nachvollziehen.
- Lerngruppe: nutzt dieselbe App auf einem Rechner oder tauscht `.jura` Dateien aus.
- Korrektor:in oder Lernpartner:in: bewertet abgegebene Klausuren und setzt konkrete Hinweise am Text.

## Bibliothek und Organisation

### Klausur anlegen

Als Examenskandidat:in möchte ich schnell eine neue Klausur anlegen, damit ich ohne organisatorische Hürden mit dem Schreiben beginnen kann.

Akzeptanz:

- Titel, Ordner und Tags können beim Anlegen gesetzt werden.
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

- Kontextmenü bietet Anzeigen, Bearbeiten, Umbenennen, Löschen/Archivieren, Export und Download.
- Aktionen sind klar benannt und beschädigen keine Daten.

## Schreiben und Abgeben

### Prüfungsnah schreiben

Als Examenskandidat:in möchte ich in einem ruhigen Prüfungsmodus schreiben, damit ich mich auf die Klausur konzentrieren kann.

Akzeptanz:

- Der Prüfungsmodus hat eine reduzierte, stabile Oberfläche.
- Heller und dunkler Modus funktionieren.
- Der Text wird automatisch lokal gespeichert.

### Arbeit wiederherstellen

Als Nutzer:in möchte ich nach Stromausfall oder App-Absturz weiterarbeiten können, damit keine Klausur verloren geht.

Akzeptanz:

- Autosaves erzeugen lokale Revisionen.
- Nach Neustart ist die letzte gespeicherte Fassung verfügbar.
- Anhänge werden in den App-Speicher kopiert.

### Quellen und Musterloesungen verwalten

Als Referendar:in moechte ich Aufgabenstellung, Bearbeitervermerk und Musterloesung einer Pruefung zuordnen, damit eine spaetere KI-Korrektur den richtigen Kontext nutzt.

Akzeptanz:

- Rechtsgebiet, Klausurtyp, Quelle und optionale URL koennen an der Pruefung gespeichert werden.
- Uploads erhalten Rollen wie Aufgabenstellung, Bearbeitervermerk oder Musterloesung.
- Fremde Klausurentexte werden nicht mitgeliefert, sondern nur durch Nutzer:innen importiert.

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

## Tags und Auswertung

### Tags konsequent nutzen

Als Examenskandidat:in möchte ich Klausuren und Korrekturen taggen, damit spätere Auswertungen aussagekräftig sind.

Akzeptanz:

- Tags können schnell als Chips eingegeben werden.
- Sinnvolle Vorschläge unterstützen Rechtsgebiet, Prüfungsgebiet, Klausurtyp und Fehlergruppe.
- Die Tour erklärt Tagging ohne technische Begriffe.

### Fortschritt auswerten

Als Nutzer:in möchte ich Punkte und Tags auswerten, damit ich erkenne, wo ich besser werde und wo ich wiederholen sollte.

Akzeptanz:

- Zeitraumfilter und Tag-Filter bleiben nach Reload erhalten.
- Durchschnitt, Verlauf und Tabellenansicht sind sichtbar.
- Auswertungen funktionieren offline.

## Nutzer und Onboarding

### Arbeitsbereich wechseln

Als Nutzer:in möchte ich zwischen meinem Arbeitsbereich und Demo-Daten wechseln, damit ich die App ausprobieren kann, ohne eigene Daten zu vermischen.

Akzeptanz:

- Nutzerwechsel ist in der Sidebar erreichbar.
- Daten bleiben pro Arbeitsbereich getrennt.
- Der Wechsel ist schnell und nachvollziehbar.

### Einstiegstour nutzen

Als neue:r Nutzer:in möchte ich gefragt werden, ob ich eine Tour sehen möchte, damit ich die wichtigsten Arbeitsabläufe schnell verstehe.

Akzeptanz:

- Der Welcome-Screen zeigt das Welcome-Bild.
- Die Tour kann gestartet oder übersprungen werden.
- Die Tour kann später über Sidebar oder Hilfe erneut gestartet werden.
- Technische Begriffe wie UUID oder Sync erscheinen nicht in der Tour.

### Hilfe finden

Als Nutzer:in möchte ich eine Hilfeseite mit kurzen Antworten, damit ich bei typischen Fragen nicht suchen muss.

Akzeptanz:

- FAQ beantwortet Offline-Speicherung, Nutzerwechsel, Tags, Bewertung und Papierkorb.
- Die Tour ist von der Hilfeseite aus erneut startbar.
- Texte sind nutzerfreundlich und nicht technisch formuliert.
