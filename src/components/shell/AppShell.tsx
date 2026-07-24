import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ActiveVisitBanner } from './ActiveVisitBanner'
import type { BreadcrumbItem } from '@/components/ui/breadcrumb'

/**
 * `sidePanel` renders as a sibling of the sidebar/main column, not nested
 * inside `main` — that's what gives it full viewport height (spanning
 * past the TopBar row) instead of starting below the header.
 */
export function AppShell({
  children,
  breadcrumb,
  secondaryPanel,
  fullBleed,
  sidePanel,
}: {
  children: ReactNode
  breadcrumb?: BreadcrumbItem[]
  secondaryPanel?: ReactNode
  fullBleed?: boolean
  sidePanel?: ReactNode
}) {
  return (
    <div className="flex h-screen bg-app">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar breadcrumb={breadcrumb} />
        <ActiveVisitBanner />
        {secondaryPanel ? (
          <div className="flex min-h-0 flex-1">
            <nav className="w-56 shrink-0 overflow-y-auto border-r border-border-default bg-surface-soft p-4">
              {secondaryPanel}
            </nav>
            <div className="min-w-0 flex-1 overflow-y-auto bg-surface-soft p-6">{children}</div>
          </div>
        ) : fullBleed ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1440px] px-8 pb-8 pt-6">{children}</div>
          </div>
        )}
      </main>
      {sidePanel}
    </div>
  )
}
