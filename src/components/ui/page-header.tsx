import type { ReactNode } from 'react'
import { PageHead } from '@/components/spis/PageBody'

/**
 * HLAVIČKA STRÁNKY — JEN PŘEPOSÍLÁ na `PageHead`.
 *
 * Tahle komponenta je z dřívější cesty (titulek volně na ploše). Od
 * 2026-07-25 má platforma JEDNU hlavičku — kartu s názvem a akcemi, tutéž
 * na profilu rodiny i na seznamech (`components/spis/PageBody.tsx`). Kdyby
 * tu zůstala druhá definice, byly by dva vzhledy a „globální změna" by
 * znamenala hledat, kde je která — přesně to, čemu se chceme vyhnout.
 *
 * Soubor nezmizel jen proto, aby se nemuselo přepsat deset volajících;
 * nové stránky mají importovat `PageHead` přímo.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
  /** @deprecated bez efektu, zůstává kvůli starším volajícím. */
  variant?: 'default' | 'settings'
}) {
  return <PageHead title={title} description={description} actions={actions} />
}
