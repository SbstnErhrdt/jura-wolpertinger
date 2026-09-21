# Cache-sichere transparente Website-Medien

## Ausgangslage

Die aktuellen Wolpi-PNGs besitzen echte Transparenz. Die Website hat diese
Dateien jedoch unter denselben URLs wie frühere Varianten mit weißem
Hintergrund veröffentlicht. Da der Server Bilddateien für ein Jahr als
`immutable` ausliefert, dürfen Browser diese alten Varianten weiterhin ohne
erneute Prüfung anzeigen. Dasselbe betrifft ältere Produkt-Screenshots. Die
Linux-Downloadkarte verwendet außerdem nur eine Raute statt eines erkennbaren
Plattformzeichens.

## Ziel

Transparente Wolpi-Grafiken und aktuelle Screenshots müssen bei jedem
Assetwechsel zuverlässig im Browser ankommen. Die Downloadkarten zeigen für
Linux ein echtes, zum bestehenden UI passendes Tux-Symbol. Die vorhandenen
Proportionen, Ladeoptimierungen und responsiven Regeln bleiben erhalten.

## Gewählter Ansatz

Alle von Hugo eingebundenen Wolpi-Grafiken und Produkt-Screenshots werden aus
dem Asset-Pipeline-Verzeichnis geladen und mit `fingerprint` verarbeitet.
Hugo erzeugt dadurch inhaltsbasierte Dateinamen. Ändert sich ein Bild, ändert
sich automatisch seine URL; unveränderte Dateien können weiterhin langfristig
gecacht werden.

Das Linux-Symbol wird als lokales, schlankes SVG eingebunden und ebenfalls
fingergeprintet. Es ist rein dekorativ, weil der Kartenname die Plattform
bereits zugänglich bezeichnet. Die Quelle wird im Asset-Verzeichnis
dokumentiert.

## Qualitätsregeln

- Wolpi-PNGs müssen mindestens 25 Prozent vollständig transparente Pixel
  enthalten; ein einzelnes transparentes Pixel reicht nicht als Nachweis.
- Homepage, Inhaltsseiten, Download und Installation dürfen keine alten
  `/assets/wolpi/`- oder `/screenshots/`-Bildpfade mehr ausgeben.
- Alle produktiven Bildressourcen erhalten gehashte URLs.
- Linux zeigt in allen drei Downloadkarten dasselbe SVG und keine Raute.
- Layout-, Accessibility- und Gesamtprojekt-Tests bleiben grün.

## Nicht im Umfang

Die bereits korrekt freigestellten Wolpis werden nicht neu generiert. Farben,
Texte, Downloadlogik und die Windows- beziehungsweise macOS-Symbole bleiben
unverändert.
