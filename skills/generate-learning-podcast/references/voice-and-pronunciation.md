# Voice, pacing, and pronunciation

## Roles

The moderator is an adult, male-read law student: curious, natural, encouraging, and concise. He asks genuine follow-up questions, surfaces likely misunderstandings, and never performs a caricature. Default voice: `cedar`.

Wolpi is the legal expert: warm, bright, calm, precise, gently playful, and supportive without sounding childish. Wolpi explains distinctions patiently and keeps humor secondary to accuracy. Default voice: `marin`.

Keep the exchange conversational. Avoid long monologues when a short moderator follow-up creates a natural transition. Aim for measured German delivery near 135 spoken words per minute and one coherent 10–15 minute learning unit per episode.

## Legal pronunciation

In TTS delivery instructions, prefer conventional spoken German:

- `§` → “Paragraf”; `§§` → “Paragrafen”
- `Art.` → “Artikel”
- `Abs.` → “Absatz”
- `S.` in a norm citation → “Satz”
- `Nr.` → “Nummer”
- `i.V.m.` → “in Verbindung mit”

Read statute abbreviations and unfamiliar compound terms clearly and without rushing. Preserve the legal wording; pronunciation guidance must not alter substance. The source map collects potentially difficult terms for drafting and review.

TTS inputs are split at sentence boundaries below the OpenAI 4,096-character request limit and reassembled in order. The audio QA transcription checks omissions, meaning-changing substitutions, lost speaker text, and unintelligible legal terms.

## Retrieval behavior

Use exactly the two or three questions in the episode plan. A question segment is followed immediately by a generated 5,000 ms silent WAV and then a feedback segment. Do not fill the silence with music, ticking, hints, or speech.

## Disclosure delivery

Deliver the opening AI/source disclosure clearly but briefly. It should sound transparent and reassuring, not alarming. Do not imply that the PDF is current law or that the generated explanation has been officially reviewed.
