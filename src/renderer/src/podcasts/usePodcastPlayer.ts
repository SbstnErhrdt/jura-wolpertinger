import { computed, ref } from 'vue'
import type { PodcastCatalog, PodcastEpisode, PodcastProgress } from '@shared/schemas'
import {
  findPodcastSeriesSlug,
  isPodcastEpisodeComplete,
  savePodcastProgressWithoutInterrupting,
  shouldPersistPodcastProgress
} from '@shared/podcastProgress'
import { api } from '../api'

const catalog = ref<PodcastCatalog | null>(null)
const catalogLoading = ref(false)
const catalogError = ref('')
const currentEpisode = ref<PodcastEpisode | null>(null)
const queue = ref<PodcastEpisode[]>([])
const playing = ref(false)
const expanded = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playbackRate = ref(1)
let audio: HTMLAudioElement | null = null
let lastPersistedAt = 0
let catalogPromise: Promise<PodcastCatalog> | null = null
let catalogGeneration = 0

export function usePodcastPlayer() {
  const queueIndex = computed(() =>
    currentEpisode.value
      ? queue.value.findIndex((episode) => episode.id === currentEpisode.value?.id)
      : -1
  )
  const canGoPrevious = computed(() => queueIndex.value > 0)
  const canGoNext = computed(
    () => queueIndex.value >= 0 && queueIndex.value < queue.value.length - 1
  )
  const currentSeriesSlug = computed(() =>
    catalog.value && currentEpisode.value
      ? findPodcastSeriesSlug(catalog.value, currentEpisode.value.id)
      : null
  )

  async function loadCatalog(force = false): Promise<PodcastCatalog> {
    if (catalog.value && !force) return catalog.value
    if (catalogPromise && !force) return catalogPromise
    catalogLoading.value = true
    catalogError.value = ''
    const generation = catalogGeneration
    const request = api
      .getPodcastCatalog()
      .then((value) => {
        if (generation === catalogGeneration) catalog.value = value
        return value
      })
      .catch((error) => {
        if (generation === catalogGeneration) {
          catalogError.value =
            error instanceof Error ? error.message : 'Podcasts konnten nicht geladen werden.'
        }
        throw error
      })
      .finally(() => {
        if (catalogPromise === request) {
          catalogLoading.value = false
          catalogPromise = null
        }
      })
    catalogPromise = request
    return request
  }

  function setCatalog(value: PodcastCatalog): void {
    catalog.value = value
  }

  async function playEpisode(episode: PodcastEpisode, episodes: PodcastEpisode[]): Promise<void> {
    const player = ensureAudio()
    queue.value = episodes
    if (currentEpisode.value?.id !== episode.id) {
      if (currentEpisode.value) await persistProgress(true)
      currentEpisode.value = episode
      player.src = episode.audioUrl
      currentTime.value = episode.progress?.positionSeconds ?? 0
      duration.value = episode.durationSeconds
      player.currentTime = currentTime.value
      updateMediaSession(episode)
    }
    try {
      await player.play()
    } catch {
      playing.value = false
    }
  }

  async function togglePlayback(): Promise<void> {
    if (!currentEpisode.value) return
    const player = ensureAudio()
    if (player.paused) {
      await player.play()
    } else {
      player.pause()
    }
  }

  function seekTo(value: number): void {
    const player = ensureAudio()
    const maximum = duration.value || currentEpisode.value?.durationSeconds || 0
    player.currentTime = Math.min(Math.max(value, 0), maximum)
    currentTime.value = player.currentTime
    void persistProgress(false)
  }

  function seekBy(seconds: number): void {
    seekTo(currentTime.value + seconds)
  }

  function setPlaybackRate(value: number): void {
    const next = Math.min(Math.max(value, 0.75), 2)
    playbackRate.value = next
    ensureAudio().playbackRate = next
  }

  async function previousEpisode(): Promise<void> {
    if (!canGoPrevious.value) return
    await playEpisode(queue.value[queueIndex.value - 1], queue.value)
  }

  async function nextEpisode(): Promise<void> {
    if (!canGoNext.value) return
    await playEpisode(queue.value[queueIndex.value + 1], queue.value)
  }

  function toggleExpanded(): void {
    expanded.value = !expanded.value
  }

  async function persistProgress(force: boolean): Promise<void> {
    const episode = currentEpisode.value
    if (!episode) return
    const timestamp = Date.now()
    if (!shouldPersistPodcastProgress(lastPersistedAt, timestamp, force)) return
    const previousPersistedAt = lastPersistedAt
    lastPersistedAt = timestamp
    const progress = await savePodcastProgressWithoutInterrupting(() =>
      api.savePodcastProgress({
        episodeId: episode.id,
        positionSeconds: currentTime.value,
        durationSeconds: duration.value || episode.durationSeconds,
        completed: isPodcastEpisodeComplete(
          currentTime.value,
          duration.value || episode.durationSeconds
        )
      })
    )
    if (!progress) {
      if (lastPersistedAt === timestamp) lastPersistedAt = previousPersistedAt
      return
    }
    applyProgress(progress)
  }

  async function prepareForAccountChange(persist = true): Promise<void> {
    if (persist) await persistProgress(true)
    catalogGeneration += 1
    currentEpisode.value = null
    queue.value = []
    playing.value = false
    expanded.value = false
    currentTime.value = 0
    duration.value = 0
    catalog.value = null
    catalogError.value = ''
    catalogLoading.value = false
    catalogPromise = null
    lastPersistedAt = 0
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
  }

  function ensureAudio(): HTMLAudioElement {
    if (audio) return audio
    audio = new Audio()
    audio.preload = 'metadata'
    audio.playbackRate = playbackRate.value
    audio.addEventListener('play', () => {
      playing.value = true
    })
    audio.addEventListener('pause', () => {
      playing.value = false
      void persistProgress(true)
    })
    audio.addEventListener('timeupdate', () => {
      if (!audio) return
      currentTime.value = audio.currentTime
      duration.value = Number.isFinite(audio.duration)
        ? audio.duration
        : currentEpisode.value?.durationSeconds ?? 0
      void persistProgress(false)
    })
    audio.addEventListener('loadedmetadata', () => {
      if (!audio) return
      duration.value = Number.isFinite(audio.duration)
        ? audio.duration
        : currentEpisode.value?.durationSeconds ?? 0
      const resumeAt = currentEpisode.value?.progress?.positionSeconds ?? 0
      if (resumeAt > 0 && audio.currentTime === 0) audio.currentTime = resumeAt
    })
    audio.addEventListener('ended', () => {
      playing.value = false
      currentTime.value = duration.value
      void persistProgress(true).then(() => nextEpisode())
    })
    configureMediaSessionActions()
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        void persistProgress(true)
      })
    }
    return audio
  }

  function applyProgress(progress: PodcastProgress): void {
    if (currentEpisode.value?.id === progress.episodeId) {
      currentEpisode.value = { ...currentEpisode.value, progress }
    }
    if (!catalog.value) return
    catalog.value = {
      legalAreas: catalog.value.legalAreas.map((area) => ({
        ...area,
        series: area.series.map((series) => ({
          ...series,
          episodes: series.episodes.map((episode) =>
            episode.id === progress.episodeId ? { ...episode, progress } : episode
          )
        }))
      }))
    }
  }

  function updateMediaSession(episode: PodcastEpisode): void {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.title,
      artist: 'Jura Wolpertinger',
      album: 'Bayerische Bauordnung'
    })
  }

  function configureMediaSessionActions(): void {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', () => void togglePlayback())
    navigator.mediaSession.setActionHandler('pause', () => void togglePlayback())
    navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-15))
    navigator.mediaSession.setActionHandler('seekforward', () => seekBy(30))
    navigator.mediaSession.setActionHandler('previoustrack', () => void previousEpisode())
    navigator.mediaSession.setActionHandler('nexttrack', () => void nextEpisode())
  }

  return {
    catalog,
    catalogLoading,
    catalogError,
    currentEpisode,
    playing,
    expanded,
    currentTime,
    duration,
    playbackRate,
    canGoPrevious,
    canGoNext,
    currentSeriesSlug,
    loadCatalog,
    setCatalog,
    playEpisode,
    togglePlayback,
    seekTo,
    seekBy,
    setPlaybackRate,
    previousEpisode,
    nextEpisode,
    toggleExpanded,
    persistProgress,
    prepareForAccountChange
  }
}
