import type { LocationQuery, RouteLocationRaw } from 'vue-router'

export const UNASSIGNED_FOLDER_ID = 'unassigned'

export function folderFromQuery(value: LocationQuery[string]): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function examLibraryLocation(folderId: string | null = null, query: LocationQuery = {}): RouteLocationRaw {
  return { name: 'dashboard', query: { ...query, folder: folderId ?? undefined } }
}
