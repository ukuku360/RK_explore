import type { Category } from '../../../types/domain'

export const DEFAULT_CAPACITY = 10
export const MAX_CAPACITY = 200

export const STEP_COUNT = 2

export type PostFormStep = 1 | 2

export type PostFormState = {
  location: string
  category: Category
  proposedDate: string
  capacity: string
  meetupPlace: string
  meetupTime: string
  estimatedCost: string
  rsvpDeadline: string
  prepNotes: string
}

export type Step1Field = 'location' | 'proposedDate' | 'capacity'
export type Step1Errors = Partial<Record<Step1Field, string>>

export type OptionalField = 'estimatedCost' | 'rsvpDeadline'
export type OptionalErrors = Partial<Record<OptionalField, string>>

export function getInitialFormState(): PostFormState {
  return {
    location: '',
    category: 'Travel',
    proposedDate: '',
    capacity: String(DEFAULT_CAPACITY),
    meetupPlace: '',
    meetupTime: '',
    estimatedCost: '',
    rsvpDeadline: '',
    prepNotes: '',
  }
}

export function getInitialStep1TouchedState(): Record<Step1Field, boolean> {
  return {
    location: false,
    proposedDate: false,
    capacity: false,
  }
}

export function parseEstimatedCost(rawValue: string): number | null {
  const value = rawValue.trim()
  if (!value) return null

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Estimated cost must be 0 or higher.')
  }

  return parsed
}

export function parseRsvpDeadlineIso(rawValue: string): string | null {
  const value = rawValue.trim()
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Please provide a valid RSVP deadline.')
  }

  return date.toISOString()
}

function getDayStartTimestamp(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function parseDateInput(value: string): Date | null {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function validateStep1(form: PostFormState, now = new Date()): Step1Errors {
  const errors: Step1Errors = {}
  const location = form.location.trim()

  if (location.length < 2 || location.length > 60) {
    errors.location = 'Destination must be 2-60 characters.'
  }

  if (!form.proposedDate.trim()) {
    errors.proposedDate = 'Please choose a trip date.'
  } else {
    const selectedDate = parseDateInput(form.proposedDate)
    if (!selectedDate) {
      errors.proposedDate = 'Please choose a valid date.'
    } else if (selectedDate.getTime() < getDayStartTimestamp(now)) {
      errors.proposedDate = 'Trip date must be today or later.'
    }
  }

  const parsedCapacity = Number(form.capacity)
  if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > MAX_CAPACITY) {
    errors.capacity = `Capacity must be an integer between 1 and ${MAX_CAPACITY}.`
  }

  return errors
}

export function isStep1Valid(errors: Step1Errors): boolean {
  return Object.keys(errors).length === 0
}

export function validateOptionalFields(form: PostFormState): {
  errors: OptionalErrors
  values: {
    estimatedCost: number | null
    rsvpDeadline: string | null
  }
} {
  const errors: OptionalErrors = {}
  let estimatedCost: number | null = null
  let rsvpDeadline: string | null = null

  try {
    estimatedCost = parseEstimatedCost(form.estimatedCost)
  } catch (error) {
    errors.estimatedCost = error instanceof Error ? error.message : 'Please check estimated cost.'
  }

  try {
    rsvpDeadline = parseRsvpDeadlineIso(form.rsvpDeadline)
  } catch (error) {
    errors.rsvpDeadline = error instanceof Error ? error.message : 'Please check RSVP deadline.'
  }

  if (rsvpDeadline && new Date(rsvpDeadline).getTime() < Date.now()) {
    errors.rsvpDeadline = 'RSVP deadline must be in the future.'
  }

  if (rsvpDeadline && form.proposedDate) {
    const latestAllowed = new Date(`${form.proposedDate}T23:59:59`)
    if (new Date(rsvpDeadline) > latestAllowed) {
      errors.rsvpDeadline = 'RSVP deadline should be before the trip date.'
    }
  }

  return {
    errors,
    values: {
      estimatedCost,
      rsvpDeadline,
    },
  }
}

export function hasOptionalData(form: PostFormState): boolean {
  return Boolean(
    form.meetupPlace.trim() ||
      form.meetupTime.trim() ||
      form.estimatedCost.trim() ||
      form.rsvpDeadline.trim() ||
      form.prepNotes.trim() ||
      form.category !== 'Travel',
  )
}
