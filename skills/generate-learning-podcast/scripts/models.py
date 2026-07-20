from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class SourceAnchor(BaseModel):
    page: int = Field(ge=1)
    section: str = Field(min_length=1)
    excerpt: str = Field(min_length=1, max_length=350)


class SourceSection(BaseModel):
    id: str = Field(pattern=r"^section-[a-z0-9-]+$")
    title: str = Field(min_length=1)
    summary: str = Field(min_length=1)
    anchors: list[SourceAnchor] = Field(min_length=1)


class Concept(BaseModel):
    id: str = Field(pattern=r"^concept-[a-z0-9-]+$")
    title: str = Field(min_length=1)
    kind: Literal[
        "definition",
        "norm",
        "schema",
        "dispute",
        "distinction",
        "example",
        "note",
    ]
    explanation: str = Field(min_length=1)
    anchors: list[SourceAnchor] = Field(min_length=1)
    pronunciation_terms: list[str] = Field(default_factory=list)


class SourceChunkAnalysis(BaseModel):
    document_title: str = Field(min_length=1)
    sections: list[SourceSection]
    concepts: list[Concept]


class SourceMap(SourceChunkAnalysis):
    pronunciation_terms: list[str] = Field(default_factory=list)


class RecallPrompt(BaseModel):
    question: str = Field(min_length=1)
    expected_points: list[str] = Field(min_length=1)


class EpisodePlan(BaseModel):
    number: int = Field(ge=1)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=1)
    learning_goals: list[str] = Field(min_length=1, max_length=4)
    concept_ids: list[str] = Field(min_length=1)
    source_pages: list[int] = Field(min_length=1)
    target_words: int = Field(ge=1350, le=2025)
    recall_prompts: list[RecallPrompt] = Field(min_length=2, max_length=3)
    application_kind: Literal["mini-case", "example", "distinction"]


class SeriesPlan(BaseModel):
    title: str = Field(min_length=1)
    episodes: list[EpisodePlan] = Field(min_length=1)

    @model_validator(mode="after")
    def episode_numbers_are_contiguous(self) -> "SeriesPlan":
        numbers = [episode.number for episode in self.episodes]
        if numbers != list(range(1, len(numbers) + 1)):
            raise ValueError("episode numbers must be contiguous and start at one")
        if len({episode.slug for episode in self.episodes}) != len(self.episodes):
            raise ValueError("episode slugs must be unique")
        return self


class SpeechSegment(BaseModel):
    kind: Literal["speech"] = "speech"
    id: str = Field(pattern=r"^segment-[0-9]{3,}$")
    speaker: Literal["moderator", "wolpi"]
    text: str = Field(min_length=1)
    anchors: list[SourceAnchor] = Field(default_factory=list)
    delivery: str = "natural"
    purpose: Literal[
        "disclosure",
        "dialogue",
        "retrieval-question",
        "feedback",
        "application",
        "summary",
    ] = "dialogue"


class PauseSegment(BaseModel):
    kind: Literal["pause"] = "pause"
    id: str = Field(pattern=r"^segment-[0-9]{3,}$")
    duration_ms: int = Field(ge=100, le=10000)
    purpose: Literal["retrieval", "beat"]


EpisodeSegment = SpeechSegment | PauseSegment


class EpisodeDraft(BaseModel):
    number: int = Field(ge=1)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title: str = Field(min_length=1)
    segments: list[EpisodeSegment] = Field(min_length=1)


class GroundingIssue(BaseModel):
    segment_id: str
    reason: str = Field(min_length=1)
    suggested_text: str | None = None


class GroundingReport(BaseModel):
    approved: bool
    issues: list[GroundingIssue] = Field(default_factory=list)

    @model_validator(mode="after")
    def approval_matches_issues(self) -> "GroundingReport":
        if self.approved == bool(self.issues):
            raise ValueError("approved must be true exactly when issues is empty")
        return self


class AudioIssue(BaseModel):
    segment_id: str
    expected: str
    observed: str
    reason: str


class AudioCheck(BaseModel):
    passed: bool
    issues: list[AudioIssue] = Field(default_factory=list)

    @model_validator(mode="after")
    def pass_matches_issues(self) -> "AudioCheck":
        if self.passed == bool(self.issues):
            raise ValueError("passed must be true exactly when issues is empty")
        return self
