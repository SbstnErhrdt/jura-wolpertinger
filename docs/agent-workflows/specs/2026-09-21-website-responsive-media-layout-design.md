# Robustes Medien- und Hero-Layout der Website

## Ausgangslage

Die Startseite skaliert mehrere Bilder nur über ihre Breite. Die `width`- und
`height`-Attribute im HTML werden dadurch in der gerenderten Seite nicht
zuverlässig gemeinsam überschrieben. Auf großen und schmalen Viewports werden
der App-Screenshot und die freigestellte Wolpi-Grafik deshalb vertikal
gestreckt. Die absolute Wolpi-Positionierung verstärkt den Eindruck einer
weißen Bildfläche, weil die transparente Grafik über dem überwiegend weißen
App-Screenshot liegt.

## Ziel

Die Website präsentiert die App auf Desktop, Tablet und Mobil professionell,
ohne Bildverzerrung oder horizontalen Überlauf. Produkt-Screenshots behalten
immer ihr Format 3:2. Quadratische Wolpi-Grafiken behalten immer ihr Format
1:1 und werden nur als zurückhaltende Markenelemente eingesetzt.

## Gewählter Ansatz

Der Hero erhält einen eigenen, zentrierten Inhaltscontainer mit begrenzter
Maximalbreite. Der dunkle Hintergrund bleibt weiterhin vollflächig. Text und
Produktvorschau bilden innerhalb des Containers ein stabiles Zweispaltenraster,
das auf Tablet und Mobil in eine Spalte wechselt.

Alle Bilder erhalten grundsätzlich `height: auto`. Kritische Produktbilder
bekommen zusätzlich ein explizites `aspect-ratio` und `object-fit`, damit auch
spätere Assetwechsel die Komposition nicht brechen. Der Hero-Wolpi wird klein,
quadratisch und teilweise außerhalb des Produktfensters positioniert. Auf
Mobilgeräten sitzt er unterhalb der Vorschau, ohne Text oder Bedienelemente zu
verdecken.

## Responsive Regeln

- Ab 1100 px: zwei Spalten in einem maximal 1520 px breiten Container.
- Unter 1100 px: Text und Produktvorschau untereinander; Vorschau maximal
  960 px breit.
- Unter 760 px: kompaktere Abstände, kleine Wolpi-Dekoration und kein
  horizontaler Überlauf.
- App-Screenshots bleiben 3:2, Wolpi-Grafiken bleiben 1:1.

## Qualitätssicherung

Ein browserbasierter Regressionstest rendert die echte Homepage-Struktur und
das echte Stylesheet auf Desktop und Mobil. Er vergleicht natürliche und
gerenderte Seitenverhältnisse, prüft die Hero-Maximalbreite sowie horizontalen
Überlauf. Zusätzlich laufen die bestehenden Website-Tests und ein Hugo-Build.

## Nicht im Umfang

Es werden keine neuen Illustrationen erzeugt, keine Produkttexte umgeschrieben
und keine App-Funktionen verändert.
