import { enumOptions } from '../fixtures'
export const listEnumOptions = async () => enumOptions as never
export const addEnumOption = async (_org: string, _kind: string, label: string) =>
  ({ key: label.toLowerCase().replace(/\s+/g, '-'), label }) as never
