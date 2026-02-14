import { getInitialFormState, type PostFormState, type PostFormStep } from './postForm'

const DRAFT_VERSION = 1
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

export const POST_DRAFT_SAVE_DELAY_MS = 5000

type StoredDraft = {
  version: number
  updatedAt: string
  step: PostFormStep
  form: PostFormState
}

function getDraftKey(userId: string): string {
  return `rk:post-draft:v1:${userId}`
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function parseStoredDraft(rawValue: string | null): StoredDraft | null {
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredDraft>
    if (parsed.version !== DRAFT_VERSION) return null
    if (!parsed.updatedAt || !parsed.form || (parsed.step !== 1 && parsed.step !== 2)) return null

    return {
      version: DRAFT_VERSION,
      updatedAt: parsed.updatedAt,
      step: parsed.step,
      form: {
        ...getInitialFormState(),
        ...parsed.form,
      },
    }
  } catch {
    return null
  }
}

export function hasDraftContent(form: PostFormState): boolean {
  const initial = getInitialFormState()
  return (
    form.location.trim() !== initial.location ||
    form.proposedDate.trim() !== initial.proposedDate ||
    form.capacity.trim() !== initial.capacity ||
    form.category !== initial.category ||
    form.meetupPlace.trim() !== initial.meetupPlace ||
    form.meetupTime.trim() !== initial.meetupTime ||
    form.estimatedCost.trim() !== initial.estimatedCost ||
    form.rsvpDeadline.trim() !== initial.rsvpDeadline ||
    form.prepNotes.trim() !== initial.prepNotes
  )
}

export function saveDraft(userId: string, form: PostFormState, step: PostFormStep): void {
  if (!canUseStorage()) return

  const payload: StoredDraft = {
    version: DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    step,
    form,
  }

  try {
    window.localStorage.setItem(getDraftKey(userId), JSON.stringify(payload))
  } catch {
    // Ignore storage write failures.
  }
}

export function clearDraft(userId: string): void {
  if (!canUseStorage()) return

  try {
    window.localStorage.removeItem(getDraftKey(userId))
  } catch {
    // Ignore storage clear failures.
  }
}

export function loadDraft(userId: string, nowMs = Date.now()): {
  form: PostFormState
  step: PostFormStep
} | null {
  if (!canUseStorage()) return null

  const rawValue = window.localStorage.getItem(getDraftKey(userId))
  const draft = parseStoredDraft(rawValue)
  if (!draft) return null

  const updatedAtMs = new Date(draft.updatedAt).getTime()
  if (!Number.isFinite(updatedAtMs) || nowMs - updatedAtMs > DRAFT_MAX_AGE_MS) {
    clearDraft(userId)
    return null
  }

  return {
    form: draft.form,
    step: draft.step,
  }
}
