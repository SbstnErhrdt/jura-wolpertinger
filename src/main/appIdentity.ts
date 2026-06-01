type ResolveAssetPath = (...segments: string[]) => string

export function resolveRuntimeDockIconPath(options: {
  platform: NodeJS.Platform
  isPackaged: boolean
  resolveAssetPath: ResolveAssetPath
}): string | null {
  if (options.platform !== 'darwin') return null
  if (options.isPackaged) return null

  const iconPath = options.resolveAssetPath('build', 'icon.icns')
  return iconPath.endsWith('.icns') ? iconPath : null
}
