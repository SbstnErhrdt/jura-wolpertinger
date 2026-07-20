# Legal source rules

## Sole-source boundary

Use only the uploaded PDF for legal substance. Do not use web search, statute lookup, case-law lookup, retrieval systems, or facts from model memory. This applies even when the model knows a rule is incomplete, outdated, or wrong.

Do not silently correct the script. If the PDF does not establish a claim, omit it or state that the script does not establish it. The podcast is a learning aid for the supplied material, not legal advice, an update check, or an official assessment.

## Page anchors

Every substantive legal speech segment requires at least one `SourceAnchor` with:

- the absolute PDF page number;
- the section label;
- a short supporting excerpt.

Chunk-local page numbers must be converted back to absolute source pages. Episode anchors may use only pages attached to the concepts assigned to that episode.

Routine page citations are not spoken because they interrupt listening. `transcript.md` appends `[S. N]` citations to grounded speech segments. Disclosure text and literal pauses need no source anchor.

## Grounding and repair

After drafting, compare every legal claim with the narrow episode source map. Style preferences are not grounding issues. When unsupported content is found, rewrite only the reported segments, preserve IDs, roles, order, retrieval pauses, word range, and already supported material, then check again.

Allow at most two grounding rewrites. If the second recheck still fails, stop that episode and leave the resumable artifacts and redacted manifest error in place. Never relax the source boundary to complete a failed episode.

## Required disclosure

Open every episode with one disclosure that communicates all of these points in natural German:

- the audio was generated with AI;
- it uses only the uploaded script;
- it does not perform an update check;
- it is not an official assessment or examination evaluation.

Repeat the AI/source limitation in MP3 metadata.
