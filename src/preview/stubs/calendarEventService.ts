import { calendarEvents } from '../fixtures'
export const createCalendarEvent = async () => calendarEvents[0] as never
export const createRecurringCalendarEvents = async () => calendarEvents as never
export const cancelCalendarEventSeries = async () => {}
export const listCalendarEvents = async () => calendarEvents
export const rescheduleCalendarEvent = async () => {}
export const updateCalendarEvent = async () => {}
export const listCalendarEventsForSubject = async (_org: string, kind: string, id: string) =>
  calendarEvents.filter(({ event }) => (event.subjectKeys ?? []).includes(`${kind}:${id}`))
export const listCalendarEventsForStaff = async (_org: string, uid: string) =>
  calendarEvents.filter(({ event }) => event.assignedToUid === uid)
export const cancelCalendarEvent = async () => {}
export const markCalendarEventSynced = async () => {}
