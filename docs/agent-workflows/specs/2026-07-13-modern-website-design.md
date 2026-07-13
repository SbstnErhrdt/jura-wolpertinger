# Modern Website Design

Date: 2026-07-13

## Goal

Modernize the public website so it feels like the same product as the app: professional, calm, blue, exam-focused, and recognizably Jura Wolpertinger. The website should still be a static Hugo site and keep the current download feed integration.

## Direction

Use the app-adjacent direction with Wolpi character:

- Primary visual language follows the app: deep blue navigation color, soft blue background, white work surfaces, restrained borders, 8px radii.
- Wolpi images appear as brand accents in several places, but not as decoration that competes with product screenshots.
- Screenshots remain the main proof of the product. Wolpi supports motivation and brand memory.
- Copy stays non-technical and speaks to Jura students and Referendare without mentioning internal infrastructure.

## Information Architecture

The page keeps the existing one-page flow:

1. Header with brand, section links, download, installation, and Web-App.
2. Hero that immediately communicates: Karteikarten, Klausuren, Fortschritt.
3. Product capabilities: Karteikarten, Prüfungen, Autosave, Auswertung, lokal/online.
4. Karteikarten section with a stronger mobile-learning angle.
5. Screenshots section with larger product visuals and short captions.
6. Download section powered by the stable feed.
7. Local-first / web-account explanation.
8. Footer with clear product disclaimer.

The installation page should inherit the updated visual system, but does not need a new content model.

## Visual Design

Use a stronger visual relationship to the app:

- Primary blue: `#005a84`.
- Dark surface: `#06212c` or a close app-compatible deep blue.
- Accent blue: `#0b6d99`.
- Soft page background: `#eef6fa`.
- Cards and screenshots: white panels with subtle blue-gray borders.
- Avoid green accents and avoid a one-note pale-blue page.

Hero:

- Use a deep-blue visual block or split composition with a real app screenshot and Wolpi image.
- Keep hero text large but not marketing-fluffy.
- Primary CTA: Desktop-App laden.
- Secondary CTA: Web-App öffnen.

Wolpi usage:

- Copy selected Wolpi PNGs into `website/static/assets/wolpi/` with simple ASCII filenames.
- Use one main Wolpi in the hero, one small motivating Wolpi near flashcards, and one near the offline/desktop section.
- Keep images optimized and sized with CSS so they do not dominate on mobile.

## Content Rules

- No technical language such as JSON, Supabase, Storage, S3, or API on the public website.
- Keep the target user in mind: Jura students and Referendare, not developers.
- Feature copy should describe outcomes: wiederholen, schreiben, sichern, auswerten.
- The website can mention "lokal" for the Desktop-App and "Account" for Web-App, but must not expose backend details.

## Implementation

- Update Hugo templates under `website/layouts/`.
- Update CSS in `website/assets/css/main.css`.
- Copy selected Wolpi images from `assets/wolpi/` into `website/static/assets/wolpi/`.
- Rebuild Hugo output into `docs/` and production deploy folder as already established.
- Keep `website/static/js/downloads-core.js` and `website/static/js/downloads.js` behavior unchanged unless layout classes require small markup adjustments.

## Testing

Run:

- Hugo build for `website/`.
- Existing website/download tests.
- Visual screenshot check for desktop and mobile widths.
- Smoke checks for:
  - `https://jura-wolpi.de/`
  - `https://jura-wolpi.de/installation/`
  - `https://downloads.jura-wolpi.de/desktop/stable/manifest.json`

## Out Of Scope

- App UI changes.
- New download logic.
- New authentication or backend copy.
- Changing the release feed.
