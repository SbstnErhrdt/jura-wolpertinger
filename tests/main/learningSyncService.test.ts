import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppServices } from '@main/services/services'
import {
  buildCloudLearningStateFromLocal,
  mergeCloudLearningStateIntoLocal,
  type CloudLearningSyncState
} from '@main/services/learningSyncService'

let dataDir: string
let services: AppServices

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'jura-learning-sync-'))
  services = new AppServices(dataDir)
})

afterEach(async () => {
  services?.close()
  await rm(dataDir, { recursive: true, force: true })
})

describe('learning table sync', () => {
  it('merges cloud cards into local data and prepares a stable cloud payload', () => {
    const user = services.getCurrentUser()
    const collection = services.createLearningCollection({ name: 'BGB AT' })
    const localCard = services.createLearningCard({
      collectionId: collection.id,
      title: 'Lokale Karte',
      frontMarkdown: 'Alt?',
      backMarkdown: 'Alt.',
      tags: ['lokal']
    })
    services.recordReview({ cardId: localCard.id, rating: 3, elapsedMs: 1000 })

    const oldDate = '2026-01-01T00:00:00.000Z'
    services.db.prepare('UPDATE learning_collections SET updated_at = ? WHERE id = ?').run(oldDate, collection.id)
    services.db.prepare('UPDATE learning_cards SET updated_at = ? WHERE id = ?').run(oldDate, localCard.id)
    services.db.prepare('UPDATE learning_card_schedules SET updated_at = ? WHERE card_id = ?').run(oldDate, localCard.id)

    const cloudState: CloudLearningSyncState = {
      collections: [
        {
          id: collection.id,
          ownerUserId: '00000000-0000-4000-8000-0000000000a1',
          name: 'BGB Allgemeiner Teil',
          description: 'Cloud-Beschreibung',
          subject: 'Zivilrecht',
          source: null,
          isArchived: false,
          createdAt: oldDate,
          updatedAt: '2026-02-01T00:00:00.000Z'
        }
      ],
      cards: [
        {
          id: localCard.id,
          itemId: '10000000-0000-4000-8000-000000000001',
          collectionId: collection.id,
          ownerUserId: '00000000-0000-4000-8000-0000000000a1',
          title: 'Cloud gewinnt',
          externalId: localCard.id,
          frontMarkdown: 'Neu?',
          backMarkdown: 'Neu.',
          tags: ['cloud'],
          isArchived: false,
          createdAt: oldDate,
          updatedAt: '2026-02-01T00:00:00.000Z'
        },
        {
          id: '20000000-0000-4000-8000-000000000002',
          itemId: '10000000-0000-4000-8000-000000000002',
          collectionId: collection.id,
          ownerUserId: '00000000-0000-4000-8000-0000000000a1',
          title: 'Nur online',
          externalId: null,
          frontMarkdown: 'Online?',
          backMarkdown: 'Ja.',
          tags: ['neu'],
          isArchived: false,
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z'
        }
      ],
      schedules: [
        {
          userId: '00000000-0000-4000-8000-0000000000a1',
          cardId: localCard.id,
          dueAt: '2026-02-02T00:00:00.000Z',
          reps: 4,
          lapses: 1,
          lastRating: 2,
          lastReviewedAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z'
        }
      ],
      reviewEvents: [
        {
          id: '30000000-0000-4000-8000-000000000001',
          userId: '00000000-0000-4000-8000-0000000000a1',
          cardId: localCard.id,
          rating: 2,
          reviewedAt: '2026-02-01T00:00:00.000Z',
          elapsedMs: 900
        }
      ]
    }

    const result = mergeCloudLearningStateIntoLocal({
      db: services.db,
      localUserId: user.id,
      cloudState
    })

    expect(result.cardsImportedOrUpdated).toBe(2)
    expect(services.listLearningCollections().find((candidate) => candidate.id === collection.id)?.name).toBe('BGB Allgemeiner Teil')
    expect(services.listLearningCards().find((candidate) => candidate.id === localCard.id)).toEqual(
      expect.objectContaining({
        title: 'Cloud gewinnt',
        frontMarkdown: 'Neu?',
        backMarkdown: 'Neu.',
        tags: ['cloud'],
        reps: 4,
        lastRating: 2
      })
    )
    expect(services.listLearningCards(collection.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Nur online', tags: ['neu'] })])
    )

    const payload = buildCloudLearningStateFromLocal({
      db: services.db,
      localUserId: user.id,
      remoteUserId: '00000000-0000-4000-8000-0000000000a1'
    })
    expect(payload.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: localCard.id,
          itemId: '10000000-0000-4000-8000-000000000001',
          title: 'Cloud gewinnt',
          tags: ['cloud']
        }),
        expect.objectContaining({
          id: '20000000-0000-4000-8000-000000000002',
          itemId: '10000000-0000-4000-8000-000000000002',
          title: 'Nur online'
        })
      ])
    )
  })
})
