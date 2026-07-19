import { describe, expect, it, vi } from 'vitest'
import {
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_MENU_LABEL,
  createAutoUpdateCoordinator,
  createUpdateMenuTemplate
} from '@main/autoUpdates'

describe('auto update coordinator', () => {
  it('runs the startup check and then checks once per hour in the background', () => {
    const checkForUpdates = vi.fn().mockResolvedValue(null)
    const setTimeout = vi.fn((callback: () => void) => {
      callback()
      return 1
    })
    const setInterval = vi.fn()

    const coordinator = createAutoUpdateCoordinator({
      checkForUpdates,
      notify: vi.fn(),
      setTimeout,
      setInterval
    })

    coordinator.scheduleBackgroundChecks(3000)

    expect(checkForUpdates).toHaveBeenCalledTimes(1)
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), UPDATE_CHECK_INTERVAL_MS)
  })

  it('shows no-update feedback for manual checks only', async () => {
    const checkForUpdates = vi.fn().mockResolvedValue(null)
    const notify = vi.fn()
    const coordinator = createAutoUpdateCoordinator({
      checkForUpdates,
      notify,
      setTimeout: vi.fn(),
      setInterval: vi.fn()
    })

    await coordinator.checkNow()

    expect(notify).toHaveBeenCalledWith({
      type: 'info',
      title: 'Keine Aktualisierung gefunden',
      message: 'Du nutzt bereits die aktuelle Version von Jura Wolpertinger.'
    })
  })

  it('shows readable failure feedback for manual checks', async () => {
    const notify = vi.fn()
    const coordinator = createAutoUpdateCoordinator({
      checkForUpdates: vi.fn().mockRejectedValue(new Error('network down')),
      notify,
      setTimeout: vi.fn(),
      setInterval: vi.fn()
    })

    await coordinator.checkNow()

    expect(notify).toHaveBeenCalledWith({
      type: 'error',
      title: 'Aktualisierung konnte nicht geprüft werden',
      message: 'Bitte prüfe deine Internetverbindung und versuche es später erneut.'
    })
  })

  it('does not start parallel update checks', async () => {
    let resolveCheck!: () => void
    const checkForUpdates = vi.fn(
      () =>
        new Promise<null>((resolve) => {
          resolveCheck = () => resolve(null)
        })
    )
    const coordinator = createAutoUpdateCoordinator({
      checkForUpdates,
      notify: vi.fn(),
      setTimeout: vi.fn(),
      setInterval: vi.fn()
    })

    const first = coordinator.checkNow()
    const second = coordinator.checkNow()
    resolveCheck()
    await Promise.all([first, second])

    expect(checkForUpdates).toHaveBeenCalledTimes(1)
  })
})

describe('update menu template', () => {
  it('puts the update command into the macOS app menu', () => {
    const template = createUpdateMenuTemplate({
      platform: 'darwin',
      appName: 'Jura Wolpertinger',
      checkForUpdates: vi.fn()
    })

    expect(template[0]?.label).toBe('Jura Wolpertinger')
    expect(JSON.stringify(template[0])).toContain(UPDATE_MENU_LABEL)
  })

  it('puts the update command into the help menu on Windows and Linux', () => {
    const template = createUpdateMenuTemplate({
      platform: 'win32',
      appName: 'Jura Wolpertinger',
      checkForUpdates: vi.fn()
    })

    const helpMenu = template.find((entry) => entry.label === 'Hilfe')
    expect(JSON.stringify(helpMenu)).toContain(UPDATE_MENU_LABEL)
  })
})
