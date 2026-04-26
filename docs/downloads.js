const releaseApiUrl = 'https://api.github.com/repos/SbstnErhrdt/jura-wolpertinger/releases/latest'

const assetMatchers = {
  windows: (name) => /win.*\.exe$/i.test(name) || /\.exe$/i.test(name),
  macosArm: (name) => /arm64.*mac.*\.dmg$/i.test(name),
  macosIntel: (name) => /x64.*mac.*\.dmg$/i.test(name),
  linux: (name) => /linux.*\.AppImage$/i.test(name) || /\.AppImage$/i.test(name)
}

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

function formatAssetLabel(asset) {
  if (!asset) return 'Direkter Download'
  const sizeInMb = asset.size ? ` · ${(asset.size / 1024 / 1024).toFixed(1)} MB` : ''
  return `${asset.name}${sizeInMb}`
}

function findAsset(assets, os) {
  return assets.find((asset) => assetMatchers[os](asset.name))
}

function updateCard(card, asset, os) {
  const detail = card.querySelector('small')
  if (!asset) {
    markUnavailable(card, detail)
    return
  }

  card.href = asset.browser_download_url
  card.setAttribute('download', '')
  if (detail) detail.textContent = formatAssetLabel(asset)
  if (getRecommendedDownloadKeys().includes(os)) card.classList.add('recommended')
}

function markUnavailable(card, detail) {
  card.href = '#download'
  card.removeAttribute('download')
  card.setAttribute('aria-disabled', 'true')
  card.classList.add('unavailable')
  if (detail) detail.textContent = 'Download noch nicht bereit'
}

const detectedOs = detectOs()

function getRecommendedDownloadKeys() {
  if (detectedOs === 'macos') return ['macosArm', 'macosIntel']
  return detectedOs ? [detectedOs] : []
}

async function loadDownloads() {
  const cards = [...document.querySelectorAll('.download-card[data-os]')]
  const detectedDownload = document.querySelector('#detected-download')
  const detectedDownloadLink = document.querySelector('#detected-download-link')
  const detectedLabel = document.querySelector('#detected-label')

  try {
    const response = await fetch(releaseApiUrl, { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) throw new Error(`Release API returned ${response.status}`)
    const release = await response.json()
    const assets = release.assets || []
    const assetsByOs = {
      windows: findAsset(assets, 'windows'),
      macosArm: findAsset(assets, 'macosArm'),
      macosIntel: findAsset(assets, 'macosIntel'),
      linux: findAsset(assets, 'linux')
    }

    for (const card of cards) {
      const os = card.dataset.os
      updateCard(card, assetsByOs[os], os)
    }

    const recommendedKeys = getRecommendedDownloadKeys()
    const detectedAsset = recommendedKeys.length === 1 ? assetsByOs[recommendedKeys[0]] : null
    if (detectedAsset && detectedOs) {
      detectedDownload.hidden = false
      detectedDownloadLink.href = detectedAsset.browser_download_url
      detectedDownloadLink.setAttribute('download', '')
      detectedDownloadLink.textContent = `Download für ${osLabels[recommendedKeys[0]]}`
      detectedLabel.textContent = `Erkanntes System: ${osLabels[recommendedKeys[0]]} · ${formatAssetLabel(detectedAsset)}`
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
