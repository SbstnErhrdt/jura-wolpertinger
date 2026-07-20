from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Callable

from pydantic import BaseModel

from config import PipelineConfig
from inspect_pdf import (
    PdfChunk,
    copy_source_pdf,
    inspect_pdf,
    write_page_chunks,
)
from manifest import (
    ManifestStore,
    atomic_write_json,
    atomic_write_text,
    file_sha256,
    stable_hash,
)
from models import (
    AudioCheck,
    EpisodeDraft,
    EpisodePlan,
    GroundingReport,
    PauseSegment,
    SeriesPlan,
    SourceChunkAnalysis,
    SourceMap,
    SpeechSegment,
)
from openai_steps import MODERATOR_DELIVERY, WOLPI_DELIVERY
from render_audio import (
    create_silence_wav,
    render_mp3,
    split_tts_text,
    validate_mp3,
)


PROMPT_VERSION = "learning-podcast-prompts-v1"

SOURCE_ONLY = """Use only the uploaded PDF and the supplied source map. Do not add facts from memory, the web, statutes, cases, or general legal knowledge. Every substantive legal statement must carry at least one page anchor from the PDF. If the source does not support a statement, omit it and say the script does not establish it."""

ANALYSIS_INSTRUCTIONS = SOURCE_ONLY + """ Analyse this PDF chunk into coherent sections and exam-relevant concepts. Preserve definitions, statutory references, schemas, disputes, distinctions, and examples exactly as presented. Ignore repeated headers, footers, and page furniture. Use lowercase ASCII slug IDs beginning with section- or concept-. Page numbers in the returned anchors are absolute PDF page numbers supplied in the request."""

PLAN_INSTRUCTIONS = SOURCE_ONLY + """ Split every supplied concept exactly once into complete legal learning units. Each episode targets 1,350-2,025 spoken words, two or three retrieval questions, and one source-supported mini-case, example, or distinction. Use only page numbers anchored by the selected concepts. Do not ask the user to approve the plan."""

DRAFT_INSTRUCTIONS = SOURCE_ONLY + """ Write supportive German dialogue between moderator and Wolpi. The moderator is a curious adult law student who genuinely asks follow-up questions. Wolpi is warm, bright, calm, lightly playful, and precise. Begin with a disclosure that the episode is AI-generated, uses only the uploaded script, performs no update check, and is no official assessment. Add exactly the planned retrieval questions, each immediately followed by a 5,000 ms retrieval pause and then feedback. Use the segment purpose fields for disclosure, retrieval-question, feedback, and exactly one application. Keep segment IDs unique and sequential from segment-001. Produce 1,350-2,025 spoken words. Do not speak page citations."""

GROUNDING_INSTRUCTIONS = SOURCE_ONLY + """ Audit every legal speech segment against the source anchors. Mark the episode approved only when all legal claims are entailed by the supplied source map and excerpts. Style preferences are not grounding issues."""

REPAIR_INSTRUCTIONS = SOURCE_ONLY + """ Rewrite only the reported segments. Keep segment IDs, roles, retrieval pauses, order, word-count range, and all already grounded material unchanged. Remove unsupported claims rather than enriching them."""

STRUCTURE_REPAIR_INSTRUCTIONS = SOURCE_ONLY + """ Return the complete corrected episode after applying the validation error. Preserve the plan, roles, meaning, order, and grounded material. Keep exactly one opening disclosure, one application, sequential segment IDs, the planned retrieval question/pause/feedback triples, 1,350-2,025 spoken words, and at least one valid source anchor on every non-disclosure speech segment."""


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
    disclosures = [
        segment
        for segment in draft.segments
        if isinstance(segment, SpeechSegment) and segment.purpose == "disclosure"
    ]
    if (
        len(disclosures) != 1
        or not isinstance(draft.segments[0], SpeechSegment)
        or draft.segments[0].purpose != "disclosure"
    ):
        raise ValueError("episode must begin with exactly one opening disclosure")
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
    retrieval_questions = [
        segment
        for segment in draft.segments
        if isinstance(segment, SpeechSegment)
        and segment.purpose == "retrieval-question"
    ]
    feedback_segments = [
        segment
        for segment in draft.segments
        if isinstance(segment, SpeechSegment) and segment.purpose == "feedback"
    ]
    if not (
        len(retrieval_questions)
        == len(feedback_segments)
        == len(plan.recall_prompts)
    ):
        raise ValueError(
            "episode retrieval questions and feedback must match the plan exactly"
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
    draft_observer: Callable[
        [str, int, EpisodeDraft, str | None], None
    ]
    | None = None,
) -> tuple[EpisodeDraft, GroundingReport]:
    draft = gateway.generate_structured(
        result_type=EpisodeDraft,
        instructions=DRAFT_INSTRUCTIONS,
        input_text=(
            plan.model_dump_json(indent=2) + "\nSOURCE MAP\n" + source_map_text
        ),
    )
    for repair_attempt in range(max_rewrites + 1):
        phase = "initial" if repair_attempt == 0 else "structure-repair"
        try:
            validate_episode(plan, draft)
            if draft_observer is not None:
                draft_observer(phase, repair_attempt, draft, None)
            break
        except ValueError as error:
            if draft_observer is not None:
                draft_observer(phase, repair_attempt, draft, str(error))
            if repair_attempt == max_rewrites:
                raise
            draft = gateway.generate_structured(
                result_type=EpisodeDraft,
                instructions=STRUCTURE_REPAIR_INSTRUCTIONS,
                input_text=(
                    source_map_text
                    + "\nEPISODE\n"
                    + draft.model_dump_json(indent=2)
                    + "\nVALIDATION ERROR\n"
                    + str(error)
                ),
            )
    report = gateway.generate_structured(
        result_type=GroundingReport,
        instructions=GROUNDING_INSTRUCTIONS,
        input_text=(
            source_map_text + "\nEPISODE\n" + draft.model_dump_json(indent=2)
        ),
    )
    if report.approved:
        return draft, report
    for repair_attempt in range(1, max_rewrites + 1):
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
        try:
            validate_episode(plan, draft)
        except ValueError as error:
            if draft_observer is not None:
                draft_observer(
                    "grounding-repair", repair_attempt, draft, str(error)
                )
            raise
        if draft_observer is not None:
            draft_observer("grounding-repair", repair_attempt, draft, None)
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


def _load_model(path: Path, model_type: type[BaseModel]):
    return model_type.model_validate(json.loads(path.read_text(encoding="utf-8")))


def _stage_outputs(manifest: ManifestStore, stage: str) -> list[Path]:
    records = manifest.data["stages"][stage]["outputs"]
    return [manifest.path.parent / record["path"] for record in records]


def _execute_stage(
    manifest: ManifestStore,
    stage: str,
    input_hash: str,
    action: Callable[[], list[Path]],
    *,
    force: bool = False,
) -> bool:
    if not force and not manifest.should_run(stage, input_hash):
        return False
    manifest.begin(stage, input_hash)
    try:
        outputs = action()
        manifest.complete(stage, input_hash, outputs)
        return True
    except Exception as error:
        manifest.fail(stage, input_hash, str(error))
        raise


def _ffmpeg_version(ffmpeg_path: Path) -> str:
    result = subprocess.run(
        [str(ffmpeg_path), "-version"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.splitlines()[0] if result.stdout else str(ffmpeg_path)


def _write_wav_atomically(path: Path, writer: Callable[[Path], None]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_name(path.name + ".partial")
    partial.unlink(missing_ok=True)
    try:
        writer(partial)
        if not partial.is_file() or partial.stat().st_size <= 44:
            raise ValueError(f"audio writer returned an empty WAV: {path.name}")
        os.replace(partial, path)
    finally:
        partial.unlink(missing_ok=True)


def _source_stage(
    config: PipelineConfig,
    manifest: ManifestStore,
    source_sha: str,
) -> tuple[Path, list[PdfChunk]]:
    source_dir = config.job_dir / "source"
    copied_pdf = source_dir / "source.pdf"
    inspection_path = source_dir / "inspection.json"
    stage_hash = stable_hash(
        {"source_sha256": source_sha, "inspection_version": "pdf-inspection-v1"}
    )

    def create_source_artifacts() -> list[Path]:
        copy_source_pdf(config.input_pdf.resolve(), copied_pdf)
        inspection = inspect_pdf(copied_pdf)
        if inspection.sha256 != source_sha:
            raise ValueError("input PDF changed while it was being copied")
        chunks = write_page_chunks(copied_pdf, source_dir / "chunks")
        atomic_write_json(
            inspection_path,
            {
                "inspection": inspection.to_dict(),
                "chunks": [
                    {
                        "index": chunk.index,
                        "page_start": chunk.page_start,
                        "page_end": chunk.page_end,
                        "path": str(chunk.path.relative_to(config.job_dir)),
                    }
                    for chunk in chunks
                ],
            },
        )
        return [copied_pdf, inspection_path, *(chunk.path for chunk in chunks)]

    _execute_stage(
        manifest,
        "source",
        stage_hash,
        create_source_artifacts,
    )
    inspection_data = json.loads(inspection_path.read_text(encoding="utf-8"))
    chunks = [
        PdfChunk(
            index=record["index"],
            page_start=record["page_start"],
            page_end=record["page_end"],
            path=config.job_dir / record["path"],
        )
        for record in inspection_data["chunks"]
    ]
    return copied_pdf, chunks


def _segment_audio(
    *,
    config: PipelineConfig,
    gateway,
    manifest: ManifestStore,
    episode_dir: Path,
    episode_number: int,
    lineage_hash: str,
    segment: SpeechSegment | PauseSegment,
    force: bool = False,
    repair_guidance: str | None = None,
) -> list[Path]:
    work_dir = episode_dir / "work"
    stage = f"episode/{episode_number:02d}/tts/{segment.id}"
    if isinstance(segment, PauseSegment):
        output = work_dir / f"{segment.id}.wav"
        input_hash = stable_hash(
            {
                "kind": "pause",
                "duration_ms": segment.duration_ms,
                "sample_rate": 24000,
                "lineage_hash": lineage_hash,
            }
        )

        def create_pause() -> list[Path]:
            _write_wav_atomically(
                output,
                lambda partial: create_silence_wav(
                    partial, duration_ms=segment.duration_ms
                ),
            )
            return [output]

        ran = _execute_stage(
            manifest, stage, input_hash, create_pause, force=force
        )
        return [output] if ran else _stage_outputs(manifest, stage)

    chunks = split_tts_text(segment.text)
    if len(chunks) == 1:
        outputs = [work_dir / f"{segment.id}.wav"]
    else:
        outputs = [
            work_dir / f"{segment.id}-part-{index:03d}.wav"
            for index in range(1, len(chunks) + 1)
        ]
    voice = (
        config.moderator_voice
        if segment.speaker == "moderator"
        else config.wolpi_voice
    )
    role_delivery = (
        MODERATOR_DELIVERY if segment.speaker == "moderator" else WOLPI_DELIVERY
    )
    base_instructions = f"{role_delivery} Segment delivery: {segment.delivery}."
    instructions = base_instructions
    if repair_guidance:
        instructions += " Pronunciation correction for this retry: " + repair_guidance
    input_hash = stable_hash(
        {
            "text_chunks": chunks,
            "speaker": segment.speaker,
            "voice": voice,
            "tts_model": config.tts_model,
            "instructions": base_instructions,
            "lineage_hash": lineage_hash,
        }
    )

    def synthesize_parts() -> list[Path]:
        for text_chunk, output in zip(chunks, outputs, strict=True):
            _write_wav_atomically(
                output,
                lambda partial, text_chunk=text_chunk: gateway.synthesize(
                    text=text_chunk,
                    voice=voice,
                    instructions=instructions,
                    output_path=partial,
                ),
            )
        return outputs

    ran = _execute_stage(
        manifest, stage, input_hash, synthesize_parts, force=force
    )
    return outputs if ran else _stage_outputs(manifest, stage)


def _render_episode(
    *,
    config: PipelineConfig,
    manifest: ManifestStore,
    plan: SeriesPlan,
    episode: EpisodePlan,
    episode_dir: Path,
    audio_inputs: list[Path],
    ffmpeg_path: Path,
    ffmpeg_version: str,
    lineage_hash: str,
    force: bool = False,
) -> tuple[Path, str]:
    mp3_path = episode_dir / f"{episode.number:02d}-{episode.slug}.mp3"
    input_hash = stable_hash(
        {
            "wav_sha256": [file_sha256(path) for path in audio_inputs],
            "lineage_hash": lineage_hash,
            "bitrate": config.mp3_bitrate,
            "target_lufs": config.target_lufs,
            "true_peak_db": config.true_peak_db,
            "tts_model": config.tts_model,
            "voices": {
                "moderator": config.moderator_voice,
                "wolpi": config.wolpi_voice,
            },
            "ffmpeg_path": str(ffmpeg_path.resolve()),
            "ffmpeg_version": ffmpeg_version,
        }
    )

    def create_mp3() -> list[Path]:
        render_mp3(
            audio_inputs,
            mp3_path,
            title=episode.title,
            series=plan.title,
            source_name=config.input_pdf.name,
            ffmpeg_path=ffmpeg_path,
        )
        validate_mp3(mp3_path)
        return [mp3_path]

    _execute_stage(
        manifest,
        f"episode/{episode.number:02d}/render",
        input_hash,
        create_mp3,
        force=force,
    )
    return mp3_path, input_hash


def _check_episode_audio(
    *,
    config: PipelineConfig,
    gateway,
    manifest: ManifestStore,
    episode: EpisodePlan,
    episode_dir: Path,
    draft: EpisodeDraft,
    mp3_path: Path,
    lineage_hash: str,
    force: bool = False,
) -> tuple[AudioCheck, str]:
    transcript_path = episode_dir / "audio-transcript.txt"
    check_path = episode_dir / "audio-check.json"
    input_hash = stable_hash(
        {
            "mp3_sha256": file_sha256(mp3_path),
            "draft_sha256": stable_hash(draft.model_dump(mode="json")),
            "lineage_hash": lineage_hash,
            "transcribe_model": config.transcribe_model,
            "transcription_strategy": "server-vad-auto-de-v1",
            "text_model": config.text_model,
            "tts_model": config.tts_model,
            "voices": {
                "moderator": config.moderator_voice,
                "wolpi": config.wolpi_voice,
            },
            "comparison_prompt": "audio-comparison-v1",
        }
    )

    def create_check() -> list[Path]:
        transcript = gateway.transcribe(mp3_path)
        write_text(transcript_path, transcript.rstrip() + "\n")
        check = gateway.compare_audio(draft, transcript)
        write_model(check_path, check)
        return [transcript_path, check_path]

    _execute_stage(
        manifest,
        f"episode/{episode.number:02d}/audio-qa",
        input_hash,
        create_check,
        force=force,
    )
    return _load_model(check_path, AudioCheck), input_hash


def run_pipeline(
    config: PipelineConfig,
    gateway,
    ffmpeg_path: Path,
    *,
    minimum_duration_seconds: float = 480.0,
) -> Path:
    input_pdf = config.input_pdf.resolve()
    source_sha = file_sha256(input_pdf)
    job_dir = config.job_dir
    manifest = ManifestStore(job_dir / "manifest.json")
    manifest.set_run_metadata(
        {
            "input_pdf": str(input_pdf),
            "source_sha256": source_sha,
            "models": {
                "text": config.text_model,
                "tts": config.tts_model,
                "transcribe": config.transcribe_model,
            },
            "voices": {
                "moderator": config.moderator_voice,
                "wolpi": config.wolpi_voice,
            },
        }
    )

    _, chunks = _source_stage(config, manifest, source_sha)
    source_map_path = job_dir / "analysis/source-map.json"
    concepts_path = job_dir / "analysis/concepts.json"
    analysis_hash = stable_hash(
        {
            "source_sha256": source_sha,
            "text_model": config.text_model,
            "prompt_version": PROMPT_VERSION,
            "instructions": ANALYSIS_INSTRUCTIONS,
        }
    )

    def create_analysis() -> list[Path]:
        source_map = analyse_source(gateway, chunks)
        write_model(source_map_path, source_map)
        atomic_write_json(
            concepts_path,
            [concept.model_dump(mode="json") for concept in source_map.concepts],
        )
        return [source_map_path, concepts_path]

    _execute_stage(
        manifest, "analysis", analysis_hash, create_analysis
    )
    source_map = _load_model(source_map_path, SourceMap)

    plan_path = job_dir / "series-plan.json"
    plan_markdown_path = job_dir / "series-plan.md"
    plan_hash = stable_hash(
        {
            "source_sha256": source_sha,
            "source_map_sha256": file_sha256(source_map_path),
            "text_model": config.text_model,
            "prompt_version": PROMPT_VERSION,
            "instructions": PLAN_INSTRUCTIONS,
        }
    )

    def create_plan() -> list[Path]:
        plan = plan_series(gateway, source_map)
        write_model(plan_path, plan)
        write_text(plan_markdown_path, render_series_plan(plan))
        return [plan_path, plan_markdown_path]

    _execute_stage(manifest, "plan", plan_hash, create_plan)
    plan = _load_model(plan_path, SeriesPlan)
    ffmpeg_version = _ffmpeg_version(ffmpeg_path)

    completed_artifacts: list[Path] = [plan_path]
    for episode in plan.episodes:
        episode_dir = job_dir / "episodes" / f"{episode.number:02d}-{episode.slug}"
        draft_path = episode_dir / "draft.json"
        source_check_path = episode_dir / "source-check.json"
        transcript_path = episode_dir / "transcript.md"
        episode_source = source_slice(source_map, episode)
        content_hash = stable_hash(
            {
                "source_sha256": source_sha,
                "source_map_sha256": file_sha256(source_map_path),
                "episode": episode.model_dump(mode="json"),
                "text_model": config.text_model,
                "prompt_version": PROMPT_VERSION,
                "draft_instructions": DRAFT_INSTRUCTIONS,
                "grounding_instructions": GROUNDING_INSTRUCTIONS,
            }
        )

        def create_content(
            episode: EpisodePlan = episode,
            episode_source: SourceMap = episode_source,
        ) -> list[Path]:
            attempt_dir = episode_dir / "work/content-attempts"

            def observe_draft(
                phase: str,
                attempt: int,
                observed_draft: EpisodeDraft,
                error: str | None,
            ) -> None:
                stem = f"{content_hash[:12]}-{phase}-{attempt:02d}"
                write_model(attempt_dir / f"{stem}.json", observed_draft)
                if error is not None:
                    write_text(attempt_dir / f"{stem}.error.txt", error + "\n")

            draft, report = draft_and_ground(
                gateway,
                episode,
                episode_source.model_dump_json(indent=2),
                config.max_grounding_rewrites,
                draft_observer=observe_draft,
            )
            write_model(draft_path, draft)
            write_model(source_check_path, report)
            write_text(transcript_path, render_transcript(draft))
            return [draft_path, source_check_path, transcript_path]

        _execute_stage(
            manifest,
            f"episode/{episode.number:02d}/content",
            content_hash,
            create_content,
        )
        draft = _load_model(draft_path, EpisodeDraft)
        validate_episode(episode, draft)

        segment_outputs: dict[str, list[Path]] = {}
        for segment in draft.segments:
            segment_outputs[segment.id] = _segment_audio(
                config=config,
                gateway=gateway,
                manifest=manifest,
                episode_dir=episode_dir,
                episode_number=episode.number,
                lineage_hash=content_hash,
                segment=segment,
            )
        ordered_audio = [
            path
            for segment in draft.segments
            for path in segment_outputs[segment.id]
        ]
        mp3_path, _ = _render_episode(
            config=config,
            manifest=manifest,
            plan=plan,
            episode=episode,
            episode_dir=episode_dir,
            audio_inputs=ordered_audio,
            ffmpeg_path=ffmpeg_path,
            ffmpeg_version=ffmpeg_version,
            lineage_hash=content_hash,
        )
        audio_check, audio_check_hash = _check_episode_audio(
            config=config,
            gateway=gateway,
            manifest=manifest,
            episode=episode,
            episode_dir=episode_dir,
            draft=draft,
            mp3_path=mp3_path,
            lineage_hash=content_hash,
        )

        for _ in range(config.max_audio_repairs):
            if audio_check.passed:
                break
            speech_by_id = {
                segment.id: segment
                for segment in draft.segments
                if isinstance(segment, SpeechSegment)
            }
            affected = sorted({issue.segment_id for issue in audio_check.issues})
            issues_by_segment = {
                segment_id: [
                    issue
                    for issue in audio_check.issues
                    if issue.segment_id == segment_id
                ]
                for segment_id in affected
            }
            unknown = [segment_id for segment_id in affected if segment_id not in speech_by_id]
            if unknown:
                manifest.fail(
                    f"episode/{episode.number:02d}/audio-qa",
                    audio_check_hash,
                    f"audio check references unknown speech segments: {unknown}",
                )
                raise ValueError(
                    f"audio check references unknown speech segments: {unknown}"
                )
            for segment_id in affected:
                repair_guidance = " ".join(
                    (
                        f"Say the intended wording exactly: {issue.expected[:500]} "
                        f"The previous transcription heard: {issue.observed[:500]} "
                        f"Correction reason: {issue.reason[:500]}"
                    )
                    for issue in issues_by_segment[segment_id]
                )
                segment_outputs[segment_id] = _segment_audio(
                    config=config,
                    gateway=gateway,
                    manifest=manifest,
                    episode_dir=episode_dir,
                    episode_number=episode.number,
                    lineage_hash=content_hash,
                    segment=speech_by_id[segment_id],
                    force=True,
                    repair_guidance=repair_guidance,
                )
            ordered_audio = [
                path
                for segment in draft.segments
                for path in segment_outputs[segment.id]
            ]
            mp3_path, _ = _render_episode(
                config=config,
                manifest=manifest,
                plan=plan,
                episode=episode,
                episode_dir=episode_dir,
                audio_inputs=ordered_audio,
                ffmpeg_path=ffmpeg_path,
                ffmpeg_version=ffmpeg_version,
                lineage_hash=content_hash,
                force=True,
            )
            audio_check, audio_check_hash = _check_episode_audio(
                config=config,
                gateway=gateway,
                manifest=manifest,
                episode=episode,
                episode_dir=episode_dir,
                draft=draft,
                mp3_path=mp3_path,
                lineage_hash=content_hash,
                force=True,
            )
        if not audio_check.passed:
            message = (
                f"episode {episode.number} audio remains inaccurate after "
                f"{config.max_audio_repairs} repairs"
            )
            manifest.fail(
                f"episode/{episode.number:02d}/audio-qa",
                audio_check_hash,
                message,
            )
            raise ValueError(message)
        completed_artifacts.extend([source_check_path, episode_dir / "audio-check.json", mp3_path])

    summary_path = job_dir / "summary.json"
    final_hash = stable_hash(
        {
            "artifacts": [file_sha256(path) for path in completed_artifacts],
            "minimum_duration_seconds": minimum_duration_seconds,
        }
    )

    def finalize() -> list[Path]:
        from validate_output import validate_job

        summary = validate_job(
            job_dir, minimum_duration_seconds=minimum_duration_seconds
        )
        atomic_write_json(summary_path, summary)
        return [summary_path]

    _execute_stage(manifest, "final", final_hash, finalize)
    return job_dir.resolve()
