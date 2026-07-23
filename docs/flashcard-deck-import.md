# Karteikarten-Decks importieren

Dieses Runbook beschreibt den manuellen Import vorbereiteter Karteikarten-Decks in die produktive Cloud-Datenbank.

## Zweck

Die vorbereiteten Deck-Dateien liegen typischerweise als JSON-Dateien vor, z. B. unter:

```text
/Users/sbstn/Documents/sabine/Karteikarten/decks/*.json
```

Sie werden in die Tabellen der Karteikarten-Funktion importiert:

- `learning_collections`
- `learning_items`
- `learning_prompts`
- `learning_tags`
- `learning_item_tags`
- `learning_prompt_schedules`

## Wichtige Regeln

- Keine Secrets, Keys oder Passwörter in Markdown, Git, Logs oder Antworten ausgeben.
- Vor jedem Import das Deck lokal lesen und Kartenanzahl sowie eindeutige Karten-IDs prüfen.
- Im Import stabile UUIDs aus Deck- und Karten-IDs erzeugen. Dadurch ist der Import wiederholbar und erzeugt keine Duplikate.
- `external_id` muss stabil und sprechend sein, z. B. `deck:grundskript-ao`.
- `source_kind` ist bei importierten Karten `imported`.
- `prompt_type` ist für normale Frage-Antwort-Karten `qa`.
- Wiederholungspläne für den Zielnutzer direkt anlegen, sonst erscheinen Karten unter Umständen nicht sofort im Wiederholungsmodus.
- Die Web-App listet Cloud-Sammlungen aktuell über `owner_user_id`. Wenn ein anderer Nutzer ein Deck sehen soll, reicht `collection_members` nicht aus. Bis die UI geteilte Sammlungen vollständig unterstützt, braucht der Zielnutzer eine eigene Kopie der Sammlung.

## Zielnutzer finden

Produktionsdatenbank:

```bash
ssh server.02 "docker exec -i jura-supabase-db psql -U postgres -d postgres -tAc \"select id,email from auth.users where lower(email)='name@example.com';\""
```

Bekannte produktive Nutzer aus bisherigen Imports:

```text
sabine.meyding@googlemail.com
erhardt.sebastian@gmail.com
```

Keine Nutzer-ID raten. Immer aus `auth.users` lesen.

## Deck lokal prüfen

```bash
node -e "const fs=require('fs'); const file='/pfad/zum/deck.json'; const d=JSON.parse(fs.readFileSync(file,'utf8')); console.log(JSON.stringify(d.deck,null,2)); console.log('cards', d.cards.length); console.log('unique_ids', new Set(d.cards.map(c=>c.id)).size); console.log(JSON.stringify(d.cards[0],null,2));"
```

Prüfen:

- `deck.title`
- `deck.subject`
- `deck.source`
- `cards.length`
- `unique_ids === cards.length`
- Karten haben `id`, `topic`, `front`, `back`, `tags`

## Bestehenden Import prüfen

```bash
ssh server.02 "docker exec -i jura-supabase-db psql -U postgres -d postgres -tAc \"
select c.name, c.external_id, count(distinct i.id) as items, count(distinct p.id) as prompts
from public.learning_collections c
left join public.learning_items i on i.primary_collection_id=c.id and i.is_archived=false
left join public.learning_prompts p on p.item_id=i.id and p.is_archived=false
where c.owner_user_id='<USER_ID>'
  and (c.external_id='<EXTERNAL_ID>' or c.name='<DECK_NAME>')
group by c.id, c.name, c.external_id;
\""
```

Wenn die Sammlung schon existiert, den Import trotzdem idempotent ausführen oder bewusst abbrechen. Nicht manuell löschen.

## Importskript

Das folgende Muster importiert ein Deck in einen Zielaccount. Vor dem Ausführen diese Werte ersetzen:

- `<USER_ID>`
- `<DECK_FILE>`
- `<EXTERNAL_ID>`

```bash
node <<'NODE' | ssh server.02 "docker exec -i jura-supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1"
const fs = require('fs')
const crypto = require('crypto')

const owner = '<USER_ID>'
const spec = {
  file: '<DECK_FILE>',
  externalId: '<EXTERNAL_ID>'
}

function uuidFor(input) {
  const hash = crypto.createHash('sha1').update(`jura-wolpi:${input}`).digest()
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = hash.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function sql(value) {
  if (value === null || value === undefined) return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function md(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('\n\n')
  return String(value || '')
}

const data = JSON.parse(fs.readFileSync(spec.file, 'utf8'))
const deck = data.deck || {}
const collectionId = uuidFor(`${spec.externalId}:collection`)
const desc = [
  deck.source ? `Quelle: ${deck.source}` : '',
  deck.extraction?.coverage ? deck.extraction.coverage : ''
].filter(Boolean).join('\n\n')
const collectionRows = [[
  collectionId,
  owner,
  owner,
  deck.title,
  desc,
  deck.subject || null,
  deck.source || null,
  spec.externalId
]]
const cardRows = []

for (const card of data.cards || []) {
  const cardExternalId = `${spec.externalId}:card:${card.id}`
  cardRows.push([
    collectionId,
    uuidFor(`${cardExternalId}:item`),
    uuidFor(`${cardExternalId}:prompt`),
    owner,
    owner,
    card.topic || card.id,
    'imported',
    cardExternalId,
    'qa',
    md(card.front),
    md(card.back),
    JSON.stringify(Array.isArray(card.tags) ? card.tags : [])
  ])
}

console.log('begin;')
console.log(`create temp table import_collections (
  id uuid primary key,
  owner_user_id uuid not null,
  author_user_id uuid not null,
  name text not null,
  description_markdown text,
  subject text,
  source text,
  external_id text not null
) on commit drop;`)
console.log('insert into import_collections (id, owner_user_id, author_user_id, name, description_markdown, subject, source, external_id) values')
console.log(collectionRows.map(r => `(${r.map(sql).join(', ')})`).join(',\n') + ';')

console.log(`create temp table import_cards (
  collection_id uuid not null,
  item_id uuid not null,
  prompt_id uuid not null,
  owner_user_id uuid not null,
  author_user_id uuid not null,
  title text not null,
  source_kind text not null,
  external_id text not null,
  prompt_type text not null,
  front_markdown text not null,
  back_markdown text not null,
  tags jsonb not null
) on commit drop;`)
console.log('insert into import_cards (collection_id, item_id, prompt_id, owner_user_id, author_user_id, title, source_kind, external_id, prompt_type, front_markdown, back_markdown, tags) values')
console.log(cardRows.map(r => `(${r.map(sql).join(', ')})`).join(',\n') + ';')

console.log(`insert into public.learning_collections (id, owner_user_id, author_user_id, name, description_markdown, subject, source, external_id)
select id, owner_user_id, author_user_id, name, description_markdown, subject, source, external_id
from import_collections
on conflict (owner_user_id, external_id) where external_id is not null do update set
  name = excluded.name,
  description_markdown = excluded.description_markdown,
  subject = excluded.subject,
  source = excluded.source,
  is_archived = false,
  updated_at = now();`)

console.log(`insert into public.learning_items (id, primary_collection_id, owner_user_id, author_user_id, title, source_kind, external_id)
select item_id, collection_id, owner_user_id, author_user_id, title, source_kind, external_id
from import_cards
on conflict (owner_user_id, primary_collection_id, external_id) where external_id is not null do update set
  title = excluded.title,
  source_kind = excluded.source_kind,
  is_archived = false,
  updated_at = now();`)

console.log(`insert into public.learning_prompts (id, item_id, prompt_type, front_markdown, back_markdown, sort_index, is_archived)
select prompt_id, item_id, prompt_type, front_markdown, back_markdown, 0, false
from import_cards
on conflict (id) do update set
  prompt_type = excluded.prompt_type,
  front_markdown = excluded.front_markdown,
  back_markdown = excluded.back_markdown,
  is_archived = false,
  updated_at = now();`)

console.log(`insert into public.learning_tags (owner_user_id, name)
select distinct owner_user_id, value as name
from import_cards, jsonb_array_elements_text(tags)
where trim(value) <> ''
on conflict (owner_user_id, name) do nothing;`)

console.log(`insert into public.learning_item_tags (item_id, tag_id)
select distinct c.item_id, t.id
from import_cards c
cross join jsonb_array_elements_text(c.tags) tag_name(value)
join public.learning_tags t on t.owner_user_id = c.owner_user_id and t.name = tag_name.value
on conflict (item_id, tag_id) do nothing;`)

console.log(`insert into public.learning_prompt_schedules (user_id, prompt_id, due_at, stability_days, difficulty, reps, lapses, last_rating, last_reviewed_at, scheduler_version, updated_at)
select owner_user_id, prompt_id, now(), 0, 0, 0, 0, null, null, 'jw-simple-v1', now()
from import_cards
on conflict (user_id, prompt_id) do update set updated_at = now();`)

console.log(`select 'staged_collections=' || count(*) from import_collections;`)
console.log(`select 'staged_cards=' || count(*) from import_cards;`)
console.log('commit;')
NODE
```

## Import verifizieren

```bash
ssh server.02 "docker exec -i jura-supabase-db psql -U postgres -d postgres -tAc \"
select c.name, c.subject, c.source, c.external_id,
       count(distinct i.id) as items,
       count(distinct p.id) as prompts,
       count(distinct s.prompt_id) as schedules
from public.learning_collections c
left join public.learning_items i on i.primary_collection_id=c.id and i.is_archived=false
left join public.learning_prompts p on p.item_id=i.id and p.is_archived=false
left join public.learning_prompt_schedules s on s.prompt_id=p.id and s.user_id='<USER_ID>'
where c.owner_user_id='<USER_ID>'
  and c.external_id='<EXTERNAL_ID>'
group by c.id,c.name,c.subject,c.source,c.external_id;
\""
```

Erwartung:

- `items` entspricht der Kartenanzahl in der JSON-Datei.
- `prompts` entspricht der Kartenanzahl.
- `schedules` entspricht der Kartenanzahl.

Zusätzlich Gesamtbestand prüfen:

```bash
ssh server.02 "docker exec -i jura-supabase-db psql -U postgres -d postgres -tAc \"
select count(distinct c.id) as collections, count(distinct i.id) as items, count(distinct p.id) as prompts, count(distinct s.prompt_id) as schedules
from public.learning_collections c
left join public.learning_items i on i.primary_collection_id=c.id and i.is_archived=false
left join public.learning_prompts p on p.item_id=i.id and p.is_archived=false
left join public.learning_prompt_schedules s on s.prompt_id=p.id and s.user_id='<USER_ID>'
where c.owner_user_id='<USER_ID>' and c.is_archived=false;
\""
```

## Decks für weitere Nutzer zugänglich machen

Der aktuelle Cloud-Flow listet Sammlungen nach `owner_user_id`. Für einen weiteren Nutzer daher nicht nur `collection_members` schreiben, sondern eine eigene Kopie erzeugen.

Vorgehen:

1. Quellnutzer und Zielnutzer über `auth.users` bestimmen.
2. Quell-Sammlungen mit Anzahl prüfen.
3. Ziel-Sammlungen mit Anzahl prüfen.
4. Nur fehlende Sammlungen kopieren, damit keine Dubletten entstehen.
5. Bei der Kopie:
   - Zielnutzer wird `owner_user_id`.
   - Ursprüngliche Autorin oder ursprünglicher Autor bleibt `author_user_id`.
   - Sammlungen, Items, Prompts und Schedules bekommen neue stabile UUIDs.
   - Tags werden für den Zielnutzer angelegt und verknüpft.
6. Danach Zielbestand mit Counts prüfen.

Nicht blind alle Sammlungen erneut kopieren. Vorhandene Decks anhand des Namens und der `external_id` prüfen.

## Abschlussnotiz

In der Antwort an den Nutzer keine technischen SQL-Details ausgeben. Nennen:

- Zielaccount
- importierte oder kopierte Sammlungen
- Kartenanzahl
- dass Prompts und Wiederholungspläne angelegt wurden
- dass die Produktionsdatenbank geprüft wurde
