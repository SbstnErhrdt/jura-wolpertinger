# List Pagination And Loading Design

## Context

The app currently renders important management lists from full in-memory arrays. The local Electron path loads all exams from SQLite through `listExams()` and all cards from `listLearningCards()`. The cloud learning path also loads all cards for a collection before filtering and sorting in the renderer. This will become slow and visually confusing as users accumulate many exams or flashcards.

The first implementation should focus on the lists most likely to grow large:

- The exam library in `DashboardView.vue`.
- The flashcards inside one collection in `FlashcardsCollectionDetailView.vue`.

The review queue is out of scope because it already behaves like a bounded learning feed. The collection overview can remain summary-based in this iteration.

## Goals

- Paginate exam and flashcard management lists consistently across local SQLite, browser-development fallback, and cloud Supabase learning mode.
- Move list filtering, sorting, and count calculation behind the API boundary so the renderer does not need complete result sets for normal browsing.
- Show clear list metadata such as `1-25 von 348 Klausuren` and `26-50 von 312 Karteikarten`.
- Add loading, empty, and error states that distinguish "still loading" from "loaded but empty".
- Keep existing create, edit, rename, move, trash, and restore workflows working after pagination.

## Non-Goals

- No infinite scroll.
- No full-text search engine dependency.
- No pagination for review batches in this iteration.
- No pagination for the collection overview unless the implementation naturally exposes the shared component there without expanding API scope.
- No visual redesign of cards, rows, sidebars, or navigation beyond list controls and loading states.

## API Shape

Introduce a shared paginated response shape:

```ts
export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}
```

Introduce list inputs with clamped page sizes:

```ts
export type ListExamsInput = {
  page?: number
  pageSize?: number
  folderId?: string | null
  status?: 'active' | 'archived' | 'all'
  search?: string
  sort?: 'updated' | 'title' | 'score'
}

export type ListLearningCardsInput = {
  collectionId?: string | null
  page?: number
  pageSize?: number
  search?: string
  sort?: 'updated' | 'title' | 'due' | 'rating'
}
```

Default page size is 25. Valid page sizes are 10, 25, 50, and 100. Inputs outside the supported range are clamped to safe values.

For backwards compatibility during migration, existing `listExams()` and `listLearningCards()` can continue to return arrays only if required by existing callers. The preferred implementation is to replace the renderer callers in scope with `listExamsPage(input)` and `listLearningCardsPage(input)` so high-volume screens never request full arrays.

## Local SQLite Behavior

SQLite queries must calculate `total` with the same filters used for `items`.

Exam pagination uses `LIMIT` and `OFFSET` over `exams`, with filters for current user, folder, active/archived status, and optional search over title and tags JSON. Sorting defaults to `updated_at DESC`.

Flashcard pagination uses `LIMIT` and `OFFSET` over `learning_cards`, with filters for current user, optional collection, non-archived cards, and optional search over title, front markdown, back markdown, and tags. Sorting defaults to `updated_at DESC`.

Indexes should support the common paths:

- Exams by `user_id`, `status`, `folder_id`, and `updated_at`.
- Learning cards by `user_id`, `collection_id`, `is_archived`, and `updated_at`.
- Existing tag and schedule indexes should be reused.

## Cloud Supabase Behavior

Cloud learning cards must paginate before loading related schedules and tags. The item or prompt query should use `.range(from, to)` and an exact count, then fetch schedules and tags only for the returned page.

Cloud collection summaries remain unchanged in this iteration. Export/import can still load complete deck data because those are explicit bulk operations, not normal browsing.

The cloud exam library is not currently implemented as a separate Supabase list path. The API should still expose the same paginated contract so future cloud exam storage can conform to it.

## Renderer Behavior

The exam library keeps folder selection in the UI but moves folder/status filtering into the page request. Selecting a folder resets to page 1. Trash counts and dashboard metrics should not depend on only the current page; they need either existing summary data or a lightweight aggregate query.

The flashcard collection detail page uses `collection.cardCount` for total-card copy in the header instead of `cards.length`. Search and sort changes reset to page 1. Saving or editing a card reloads the current page. If a mutation leaves the current page empty and `page > 1`, the view requests the previous page.

Both lists show pagination controls below the list. A compact top summary is acceptable when it helps users understand the current range.

## Loading, Empty, And Error States

Use a layered list-state model:

```ts
type ListLoadState = 'idle' | 'loading-initial' | 'refreshing' | 'loaded' | 'error'
```

Initial load shows skeleton tiles that mimic the real list structure:

- Exam list skeletons look like exam rows.
- Flashcard skeletons look like flashcard cards with performance boxes.

Refreshes caused by pagination, search, sort, or mutations keep the current items visible with a subtle disabled state and a compact spinner in the toolbar or pagination area. This avoids visual flashes.

Empty-state copy appears only after loading finishes and `total === 0`. Search-empty copy should be different from truly-empty copy:

- No data: invite the user to create the first exam or card.
- No search results: tell the user no entries match the current filter.

Error states show an `action-notice error` style message with an "Erneut versuchen" button. This is especially important for Supabase network failures.

## UI Components

Add a reusable `AppPagination.vue` component:

- Props: `page`, `pageSize`, `total`, optional `label`.
- Emits: `update:page`, `update:pageSize`.
- Shows range text, page count, previous/next buttons, and a page-size select.
- Disables controls while the parent is refreshing.

Add skeleton components or scoped skeleton markup:

- Prefer `ExamListSkeleton.vue` and `FlashcardListSkeleton.vue` if the markup would otherwise duplicate across tests or views.
- Use shared CSS classes for skeleton shimmer, dimensions, and dark-theme colors.

## Accessibility

- List regions should set `aria-busy="true"` during initial load and refresh.
- Skeleton tiles should be hidden from screen readers.
- The spinner must have visually hidden text such as `Lade Einträge`.
- Pagination controls need descriptive labels and disabled states.
- Range text should update as normal text; no live region is required unless testing shows the state change is otherwise unclear.

## Testing

Add tests for the API contracts and renderer wiring:

- SQLite services return page items, total, page, page size, and page count for exams.
- SQLite services apply folder/status/search filters before pagination.
- SQLite services return paginated cards with search and sort.
- Browser-development API implements the same paginated contract for the scoped screens.
- Cloud learning API uses ranged queries for card listing and fetches related schedules/tags only for the returned page.
- Renderer tests verify that initial loading renders skeletons instead of empty states.
- Renderer tests verify that list summaries and pagination controls are present.

Existing tests that call the array-returning methods can remain in place if those methods remain as compatibility wrappers.

## Rollout

Implement in small vertical slices:

1. Shared pagination types and local SQLite exam pagination.
2. Dashboard UI pagination, list metadata, and loading states.
3. Local SQLite flashcard pagination.
4. Flashcard collection UI pagination, list metadata, and loading states.
5. Cloud learning card pagination.
6. Browser-development fallback parity.

Each slice must include targeted tests before implementation.
