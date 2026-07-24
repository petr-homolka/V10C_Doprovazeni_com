/** Sdílené pro všechny náhledové stuby: nic se neukládá, vše se jen tváří. */
export function noop(): Promise<void> {
  return Promise.resolve()
}
export function notSupported(name: string): never {
  throw new Error(`Náhled designu: ${name} se v náhledu nespouští.`)
}
