import { tasks } from '../fixtures'
export const createTask = async () => tasks[0] as never
export const createRecurringTasks = async () => tasks as never
export const cancelTaskSeries = async () => {}
export const listTasksForOrg = async () => tasks
export const updateTask = async () => {}
export const listTasksForSubject = async (_org: string, kind: string, id: string) =>
  tasks.filter(({ task }) => (task.subjectKeys ?? []).includes(`${kind}:${id}`))
export const listTasksForStaff = async (_org: string, uid: string) =>
  tasks.filter(({ task }) => task.assignedToUid === uid)
export const setTaskStatus = async () => {}
