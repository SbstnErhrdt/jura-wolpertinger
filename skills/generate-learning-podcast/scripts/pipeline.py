from __future__ import annotations

import re
from pathlib import Path

from pydantic import BaseModel

from inspect_pdf import PdfChunk
from manifest import atomic_write_json, atomic_write_text
from models import (
    EpisodeDraft,
    EpisodePlan,
    GroundingReport,
    PauseSegment,
    SeriesPlan,
    SourceChunkAnalysis,
    SourceMap,
    SpeechSegment,
)


PROMPT_VERSION = "learning-podcast-prompts-v1"

SOURCE_ONLY = """Use only the uploaded PDF and the supplied source map. Do not add facts from memory, the web, statutes, cases, or general legal knowledge. Every substantive legal statement must carry at least one page anchor from the PDF. If the source does not support a statement, omit it and say the script does not establish it."""

ANALYSIS_INSTRUCTIONS = SOURCE_ONLY + """ Analyse this PDF chunk into coherent sections and exam-relevant concepts. Preserve definitions, statutory references, schemas, disputes, distinctions, and examples exactly as presented. Ignore repeated headers, footers, and page furniture. Use lowercase ASCII slug IDs beginning with section- or concept-. Page numbers in the returned anchors are absolute PDF page numbers supplied in the request."""

PLAN_INSTRUCTIONS = SOURCE_ONLY + """ Split every supplied concept exactly once into complete legal learning units. Each episode targets 1,350-2,025 spoken words, two or three retrieval questions, and one source-supported mini-case, example, or distinction. Use only page numbers anchored by the selected concepts. Do not ask the user to approve the plan."""

DRAFT_INSTRUCTIONS = SOURCE_ONLY + """ Write supportive German dialogue between moderator and Wolpi. The moderator is a curious adult law student who genuinely asks follow-up questions. Wolpi is warm, bright, calm, lightly playful, and precise. Begin with a disclosure that the episode is AI-generated, uses only the uploaded script, performs no update check, and is no official assessment. Add exactly the planned retrieval questions, each immediately followed by a 5,000 ms retrieval pause and then feedback. Use the segment purpose fields for disclosure, retrieval-question, feedback, and exactly one application. Keep segment IDs unique and sequential from segment-001. Produce 1,350-2,025 spoken words. Do not speak page citations."""

GROUNDING_INSTRUCTIONS = SOURCE_ONLY + """ Audit every legal speech segment against the source anchors. Mark the episode approved only when all legal claims are entailed by the supplied source map and excerpts. Style preferences are not grounding issues."""

REPAIR_INSTRUCTIONS = SOURCE_ONLY + """ Rewrite only the reported segments. Keep segment IDs, roles, retrieval pauses, order, word-count range, and all already grounded material unchanged. Remove unsupported claims rather than enriching them."""


def analyse_source(gateway, chunks: list[PdfChunk]) -> SourceMap:
    analyses: list[SourceChunkAnalysis] = []
    for chunk in chunks:
        analysis = gateway.generate_structured(
            result_type=SourceChunkAnalysis,
            instructions=ANALYSIS_INSTRUCTIONS,
            input_text=(
                f"This chunk contains original PDF pages {chunk.page_start}-{chunk.page_end}. "
                f"Chunk page 1 equals original PDF page {chunk.page_start}; add "
                f"{chunk.page_start - 1} to each chunk-local page number when returning anchors."
            ),
            input_pdf=chunk.path,
        )
        for anchored in [*analysis.sections, *analysis.concepts]:
            if any(
                not chunk.page_start <= anchor.page <= chunk.page_end
                for anchor in anchored.anchors
            ):
                raise ValueError(
                    f"chunk {chunk.index} returned an anchor outside its absolute page range"
                )
        analyses.append(analysis)

    sections = [
        section.model_copy(
            update={
                "id": (
                    f"section-chunk-{chunk.index:03d}-"
                    f"{section.id.removeprefix('section-')}"
                )
            }
        )
        for chunk, analysis in zip(chunks, analyses, strict=True)
        for section in analysis.sections
    ]
    concepts = [
        concept.model_copy(
            update={
                "id": (
                    f"concept-chunk-{chunk.index:03d}-"
                    f"{concept.id.removeprefix('concept-')}"
                )
            }
        )
        for chunk, analysis in zip(chunks, analyses, strict=True)
        for concept in analysis.concepts
    ]
    if not concepts:
        raise ValueError("source analysis returned no concepts")
    terms = sorted({term for concept in concepts for term in concept.pronunciation_terms})
    title = next(
        (analysis.document_title for analysis in analyses if analysis.document_title),
        "Lernskript",
    )
    return SourceMap(
        document_title=title,
        sections=sections,
        concepts=concepts,
        pronunciation_terms=terms,
    )


def plan_series(gateway, source_map: SourceMap) -> SeriesPlan:
    plan = gateway.generate_structured(
        result_type=SeriesPlan,
        instructions=PLAN_INSTRUCTIONS,
        input_text=source_map.model_dump_json(indent=2),
    )
    concepts_by_id = {concept.id: concept for concept in source_map.concepts}
    known = set(concepts_by_id)
    planned: list[str] = []
    for episode in plan.episodes:
        unknown = sorted(set(episode.concept_ids) - known)
        if unknown:
            raise ValueError(f"episode references unknown concepts: {unknown}")
        if len(episode.concept_ids) != len(set(episode.concept_ids)):
            raise ValueError(f"episode {episode.number} repeats a concept")
        allowed_pages = {
            anchor.page
            for concept_id in episode.concept_ids
            for anchor in concepts_by_id[concept_id].anchors
        }
        if not set(episode.source_pages) <= allowed_pages:
            raise ValueError(
                f"episode {episode.number} references pages outside its concepts"
            )
        planned.extend(episode.concept_ids)
    if set(planned) != known or len(planned) != len(set(planned)):
        raise ValueError("series plan must cover every analysed concept exactly once")
    return plan


def source_slice(source_map: SourceMap, plan: EpisodePlan) -> SourceMap:
    concept_ids = set(plan.concept_ids)
    page_ids = set(plan.source_pages)
    concepts = [concept for concept in source_map.concepts if concept.id in concept_ids]
    sections = [
        section
        for section in source_map.sections
        if any(anchor.page in page_ids for anchor in section.anchors)
    ]
    terms = sorted({term for concept in concepts for term in concept.pronunciation_terms})
    if {concept.id for concept in concepts} != concept_ids:
        raise ValueError("episode source slice is missing a planned concept")
    return SourceMap(
        document_title=source_map.document_title,
        sections=sections,
        concepts=concepts,
        pronunciation_terms=terms,
    )


def spoken_word_count(draft: EpisodeDraft) -> int:
    return sum(
        len(re.findall(r"\b[\wÄÖÜäöüß]+\b", segment.text, flags=re.UNICODE))
        for segment in draft.segments
        if isinstance(segment, SpeechSegment)
    )


def validate_episode(plan: EpisodePlan, draft: EpisodeDraft) -> None:
    if draft.number != plan.number or draft.slug != plan.slug:
        raise ValueError("draft identity does not match episode plan")
    speakers = {
        segment.speaker
        for segment in draft.segments
        if isinstance(segment, SpeechSegment)
    }
    if speakers != {"moderator", "wolpi"}:
        raise ValueError("episode must contain both moderator and wolpi")
    retrieval_pauses = [
        segment
        for segment in draft.segments
        if isinstance(segment, PauseSegment) and segment.purpose == "retrieval"
    ]
    if len(retrieval_pauses) != len(plan.recall_prompts) or any(
        pause.duration_ms != 5000 for pause in retrieval_pauses
    ):
        raise ValueError(
            "episode retrieval pauses must match the plan and last 5000 ms"
        )
    for index, segment in enumerate(draft.segments):
        if isinstance(segment, PauseSegment) and segment.purpose == "retrieval":
            if index == 0 or index + 1 == len(draft.segments):
                raise ValueError(
                    "retrieval pause must follow a question and precede feedback"
                )
            before, after = draft.segments[index - 1], draft.segments[index + 1]
            if not (
                isinstance(before, SpeechSegment)
                and before.purpose == "retrieval-question"
                and isinstance(after, SpeechSegment)
                and after.purpose == "feedback"
            ):
                raise ValueError(
                    "retrieval pause must follow a question and precede feedback"
                )
    if (
        sum(
            isinstance(segment, SpeechSegment) and segment.purpose == "application"
            for segment in draft.segments
        )
        != 1
    ):
        raise ValueError("episode must contain exactly one planned application")
    ids = [segment.id for segment in draft.segments]
    expected_ids = [f"segment-{index:03d}" for index in range(1, len(ids) + 1)]
    if ids != expected_ids:
        raise ValueError("segment IDs must be unique and sequential")
    spoken = " ".join(
        segment.text
        for segment in draft.segments
        if isinstance(segment, SpeechSegment)
    ).lower()
    disclosure_terms = ("ki", "skript", "aktual", "prüfung")
    if not all(term in spoken for term in disclosure_terms):
        raise ValueError("episode must disclose AI generation and source limitations")
    if not 1350 <= spoken_word_count(draft) <= 2025:
        raise ValueError("episode must contain 1350 to 2025 spoken words")
    legal_segments = [
        segment
        for segment in draft.segments
        if isinstance(segment, SpeechSegment) and segment.purpose != "disclosure"
    ]
    if any(not segment.anchors for segment in legal_segments):
        raise ValueError("every substantive speech segment needs a source anchor")
    planned_pages = set(plan.source_pages)
    if any(
        anchor.page not in planned_pages
        for segment in legal_segments
        for anchor in segment.anchors
    ):
        raise ValueError("episode anchor falls outside planned source pages")


def draft_and_ground(
    gateway,
    plan: EpisodePlan,
    source_map_text: str,
    max_rewrites: int,
) -> tuple[EpisodeDraft, GroundingReport]:
    draft = gateway.generate_structured(
        result_type=EpisodeDraft,
        instructions=DRAFT_INSTRUCTIONS,
        input_text=(
            plan.model_dump_json(indent=2) + "\nSOURCE MAP\n" + source_map_text
        ),
    )
    validate_episode(plan, draft)
    report = gateway.generate_structured(
        result_type=GroundingReport,
        instructions=GROUNDING_INSTRUCTIONS,
        input_text=(
            source_map_text + "\nEPISODE\n" + draft.model_dump_json(indent=2)
        ),
    )
    if report.approved:
        return draft, report
    for _ in range(max_rewrites):
        draft = gateway.generate_structured(
            result_type=EpisodeDraft,
            instructions=REPAIR_INSTRUCTIONS,
            input_text=(
                source_map_text
                + "\nEPISODE\n"
                + draft.model_dump_json(indent=2)
                + "\nISSUES\n"
                + report.model_dump_json(indent=2)
            ),
        )
        validate_episode(plan, draft)
        report = gateway.generate_structured(
            result_type=GroundingReport,
            instructions=GROUNDING_INSTRUCTIONS,
            input_text=(
                source_map_text + "\nEPISODE\n" + draft.model_dump_json(indent=2)
            ),
        )
        if report.approved:
            return draft, report
    raise ValueError(
        f"episode {plan.number} remains ungrounded after {max_rewrites} rewrites"
    )


def render_transcript(draft: EpisodeDraft) -> str:
    lines = [f"# Folge {draft.number}: {draft.title}", ""]
    for segment in draft.segments:
        if isinstance(segment, PauseSegment):
            lines.extend(
                [f"_[{segment.duration_ms / 1000:g} Sekunden Denkpause]_", ""]
            )
            continue
        label = "Moderator" if segment.speaker == "moderator" else "Wolpi"
        pages = sorted({anchor.page for anchor in segment.anchors})
        citation = "" if not pages else " " + " ".join(
            f"[S. {page}]" for page in pages
        )
        lines.extend([f"**{label}:** {segment.text}{citation}", ""])
    return "\n".join(lines).rstrip() + "\n"


def render_series_plan(plan: SeriesPlan) -> str:
    lines = [f"# {plan.title}", ""]
    for episode in plan.episodes:
        pages = ", ".join(str(page) for page in sorted(set(episode.source_pages)))
        lines.extend(
            [
                f"## {episode.number}. {episode.title}",
                "",
                f"- Zielwörter: {episode.target_words}",
                f"- PDF-Seiten: {pages}",
                f"- Lernziele: {'; '.join(episode.learning_goals)}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def write_model(path: Path, model: BaseModel) -> None:
    atomic_write_json(path, model.model_dump(mode="json"))


def write_text(path: Path, text: str) -> None:
    atomic_write_text(path, text)
