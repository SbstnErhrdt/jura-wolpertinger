import { DOWNLOAD_MANIFEST_URL, formatDownloadLabel, readManifestEntries, selectDownload } from './downloads-core.js'

const osLabels = {
  windows: 'Windows',
  macosArm: 'macOS Apple Silicon',
  macosIntel: 'macOS Intel',
  linux: 'Linux'
}

function detectOs() {
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase()
  const value = `${userAgent} ${platform}`

  if (value.includes('win')) return 'windows'
  if (value.includes('mac')) return 'macos'
  if (value.includes('linux') || value.includes('x11')) return 'linux'
  return null
}

function detectMacArchitecture() {
  const architecture = (navigator.userAgentData?.architecture || '').toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = (navigator.platform || '').toLowerCase()
  const value = `${architecture} ${userAgent} ${platform}`

  if (value.includes('arm64') || value.includes('aarch64')) return 'arm64'
  if (
    value.includes('x64') ||
    value.includes('x86_64') ||
    value.includes('amd64') ||
    value.includes('intel')
  ) return 'x64'

  return null
}

function updateCard(card, asset, os) {
  const detail = card.querySelector('small')
  card.classList.toggle('recommended', getRecommendedDownloadKeys().includes(os))

  if (!asset) {
    markUnavailable(card, detail)
    return
  }

  card.href = asset.url
  card.setAttribute('download', '')
  card.removeAttribute('aria-disabled')
  card.classList.remove('unavailable')
  if (detail) detail.textContent = formatDownloadLabel(asset)
}

function markUnavailable(card, detail) {
  card.href = '#download'
  card.removeAttribute('download')
  card.setAttribute('aria-disabled', 'true')
  card.classList.add('unavailable')
  if (detail) detail.textContent = 'Download noch nicht bereit'
}

const detectedOs = detectOs()
const detectedMacArchitecture = detectedOs === 'macos' ? detectMacArchitecture() : null

function getRecommendedDownloadKeys() {
  if (detectedOs === 'macos') return ['macosArm', 'macosIntel']
  return detectedOs ? [detectedOs] : []
}

function getDetectedDownloadKey() {
  if (detectedOs === 'macos') {
    if (detectedMacArchitecture === 'arm64') return 'macosArm'
    if (detectedMacArchitecture === 'x64') return 'macosIntel'
    return null
  }

  return detectedOs
}

async function loadDownloads() {
  const cards = [...document.querySelectorAll('.download-card[data-os]')]
  const detectedDownload = document.querySelector('#detected-download')
  const detectedDownloadLink = document.querySelector('#detected-download-link')
  const detectedLabel = document.querySelector('#detected-label')

  try {
    const response = await fetch(DOWNLOAD_MANIFEST_URL, { cache: 'no-cache' })
    if (!response.ok) throw new Error(`Manifest returned ${response.status}`)
    const manifest = await response.json()

    if (!readManifestEntries(manifest)) {
      throw new Error('Manifest is missing required release entries.')
    }

    const assetsByOs = {
      windows: selectDownload(manifest, 'windows', 'x64'),
      macosArm: selectDownload(manifest, 'macos', 'arm64'),
      macosIntel: selectDownload(manifest, 'macos', 'x64'),
      linux: selectDownload(manifest, 'linux', 'x64')
    }

    for (const card of cards) {
      const os = card.dataset.os
      updateCard(card, assetsByOs[os], os)
    }

    const detectedKey = getDetectedDownloadKey()
    const detectedAsset = detectedKey ? assetsByOs[detectedKey] : null

    if (detectedAsset && detectedKey) {
      detectedDownload.hidden = false
      detectedDownloadLink.href = detectedAsset.url
      detectedDownloadLink.setAttribute('download', '')
      detectedDownloadLink.textContent = `Download für ${osLabels[detectedKey]}`
      detectedLabel.textContent = `Erkanntes System: ${osLabels[detectedKey]} · ${formatDownloadLabel(detectedAsset)}`
    } else if (detectedOs === 'macos') {
      detectedDownload.hidden = false
      detectedDownloadLink.href = '#download-grid'
      detectedDownloadLink.removeAttribute('download')
      detectedDownloadLink.textContent = 'Mac auswählen'
      detectedLabel.textContent = 'macOS erkannt: Bitte Apple Chip oder Intel auswählen.'
    }
  } catch {
    for (const card of cards) {
      const detail = card.querySelector('small')
      markUnavailable(card, detail)
      if (getRecommendedDownloadKeys().includes(card.dataset.os)) card.classList.add('recommended')
    }
  }
}

loadDownloads()
