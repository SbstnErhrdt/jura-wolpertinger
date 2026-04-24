const releaseApiUrl = 'https://api.github.com/repos/SbstnErhrdt/jura-wolpertinger/releases/latest'
const fallbackReleaseUrl = 'https://github.com/SbstnErhrdt/jura-wolpertinger/releases/latest'

const assetMatchers = {
  windows: (name) => /win.*\.exe$/i.test(name) || /\.exe$/i.test(name),
  macos: (name) => /mac.*\.(dmg|zip)$/i.test(name) || /\.(dmg)$/i.test(name),
  linux: (name) => /linux.*\.AppImage$/i.test(name) || /\.AppImage$/i.test(name)
}

const osLabels = {
  windows: 'Windows',
  macos: 'macOS',
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
  if (!asset) return 'GitHub Release öffnen'
  const sizeInMb = asset.size ? ` · ${(asset.size / 1024 / 1024).toFixed(1)} MB` : ''
  return `${asset.name}${sizeInMb}`
}

function findAsset(assets, os) {
  return assets.find((asset) => assetMatchers[os](asset.name))
}

function updateCard(card, asset, os) {
  const detail = card.querySelector('small')
  if (!asset) {
    card.href = fallbackReleaseUrl
    if (detail) detail.textContent = 'Zum neuesten Release'
    return
  }

  card.href = asset.browser_download_url
  card.setAttribute('download', '')
  if (detail) detail.textContent = formatAssetLabel(asset)
  if (os === detectedOs) card.classList.add('recommended')
}

const detectedOs = detectOs()

async function loadDownloads() {
  const cards = [...document.querySelectorAll('.download-card[data-os]')]
  const primaryDownload = document.querySelector('#primary-download')
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
      macos: findAsset(assets, 'macos'),
      linux: findAsset(assets, 'linux')
    }

    for (const card of cards) {
      const os = card.dataset.os
      updateCard(card, assetsByOs[os], os)
    }

    const detectedAsset = detectedOs ? assetsByOs[detectedOs] : null
    if (detectedAsset) {
      primaryDownload.href = detectedAsset.browser_download_url
      primaryDownload.setAttribute('download', '')
      primaryDownload.textContent = `Download für ${osLabels[detectedOs]}`
      detectedDownload.hidden = false
      detectedDownloadLink.href = detectedAsset.browser_download_url
      detectedDownloadLink.setAttribute('download', '')
      detectedDownloadLink.textContent = `Download für ${osLabels[detectedOs]}`
      detectedLabel.textContent = `Erkanntes System: ${osLabels[detectedOs]} · ${formatAssetLabel(detectedAsset)}`
    }
  } catch {
    for (const card of cards) {
      const detail = card.querySelector('small')
      card.href = fallbackReleaseUrl
      if (detail) detail.textContent = 'Zum neuesten Release'
      if (card.dataset.os === detectedOs) card.classList.add('recommended')
    }
  }
}

loadDownloads()
