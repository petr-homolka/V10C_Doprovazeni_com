import { describe, expect, it } from 'vitest'
import { historyArrowState } from './useHistoryArrows'

/**
 * Šipky v hlavičce musí být ztlumené, když nemají kam vést. Dvě vždy aktivní
 * šipky, které někdy nedělají nic, jsou horší než žádné — člověk jednou
 * klikne, nic se nestane a přestane jim věřit.
 */
describe('historyArrowState', () => {
  it('na první stránce nejde ani zpět, ani vpřed', () => {
    expect(historyArrowState(0, 0)).toEqual({ canGoBack: false, canGoForward: false })
  })

  it('po prvním přechodu jde zpět, ale ne vpřed', () => {
    expect(historyArrowState(1, 1)).toEqual({ canGoBack: true, canGoForward: false })
  })

  it('po kroku zpět jde oběma směry', () => {
    expect(historyArrowState(1, 2)).toEqual({ canGoBack: true, canGoForward: true })
  })

  it('na začátku historie jde jen vpřed', () => {
    expect(historyArrowState(0, 3)).toEqual({ canGoBack: false, canGoForward: true })
  })
})
