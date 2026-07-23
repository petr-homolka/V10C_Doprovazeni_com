import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/ui/empty-state'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { listMessages, sendStaffMessage } from '@/services/messageService'
import type { MessageDoc } from '@/types/message'
import type { UserDoc } from '@/types/user'
import { cn } from '@/lib/utils'

interface Props {
  familyDocId: string
  organizationId: string
  currentUid: string
  staffList: UserDoc[]
}

/**
 * Chat s pěstounem (M9) — nová záložka na `FamilyDetailPage`. Jedno vlákno
 * na rodinu, obousměrné (viz `MessageDoc` komentář) — pěstoun vidí a píše
 * ze svého `/moje` portálu (`MojeDashboardPage`), staff tady.
 *
 * "Jen interní poznámka" přepínač (HelpScout/Intercom "note vs. reply"
 * vzor) — zpráva se zapíše do STEJNÉHO vlákna, ale `audience: 'internal'`
 * ji navždy skryje před pěstounem (viz firestore.rules `messages` create).
 *
 * Žádný `onSnapshot` (§10 "jediný listener v appce = vlastní profil") —
 * stejný manuální reload-po-akci vzor jako zbytek appky, doplněný tlačítkem
 * "Obnovit" pro ruční kontrolu nových zpráv bez reloadu celé stránky.
 */
export function FamilyChatSection({ familyDocId, organizationId, currentUid, staffList }: Props) {
  const [messages, setMessages] = useState<Array<{ docId: string; message: MessageDoc }> | null>(null)
  const [body, setBody] = useState('')
  const [asNote, setAsNote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { loading, run } = useAsyncSubmit()
  const listEndRef = useRef<HTMLDivElement>(null)

  async function reload() {
    setError(null)
    try {
      setMessages(await listMessages(familyDocId, organizationId))
    } catch {
      setError('Chat se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyDocId, organizationId])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  function resolveAuthorName(uid: string): string {
    if (uid === currentUid) return 'Vy'
    return staffList.find((s) => s.uid === uid)?.displayName ?? 'Neznámý uživatel'
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    setError(null)
    try {
      await run(async () => {
        await sendStaffMessage({
          familyDocId,
          organizationId,
          createdByUid: currentUid,
          body: trimmed,
          audience: asNote ? 'internal' : 'foster',
        })
        await reload()
      })
      setBody('')
    } catch {
      setError('Zprávu se nepodařilo odeslat.')
    }
  }

  return (
    <section className="max-w-[720px]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-normal leading-tight text-text-primary">Chat s pěstounem</h2>
          <p className="mt-0.5 text-[13px] text-text-tertiary">
            Zprávy vidí i pěstoun na svém portálu — interní poznámku vidí jen tým.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={reload} type="button">
          Obnovit
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex max-h-[480px] flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-inset p-4">
        {messages === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : messages.length === 0 ? (
          <EmptyState icon={MessageCircle} text="Zatím žádné zprávy — napište pěstounovi jako první." />
        ) : (
          messages.map(({ docId, message }) => {
            const isFosterAuthor = message.authorRole === 'foster'
            const isInternal = message.audience === 'internal'
            return (
              <div key={docId} className={cn('flex flex-col', isFosterAuthor ? 'items-start' : 'items-end')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm',
                    isInternal
                      ? 'border border-dashed border-warning bg-warning-bg text-text-primary'
                      : isFosterAuthor
                        ? 'border border-border bg-surface text-text-primary'
                        : 'bg-primary text-primary-foreground',
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-text-tertiary">
                  {isFosterAuthor ? 'Pěstoun' : resolveAuthorName(message.createdByUid)}
                  {isInternal && (
                    <span className="rounded-full bg-warning-bg px-1.5 py-0.5 font-medium text-warning">Jen tým</span>
                  )}
                  {' · '}
                  {new Date(message.createdAt).toLocaleString('cs-CZ')}
                </p>
              </div>
            )
          })
        )}
        <div ref={listEndRef} />
      </div>

      <form onSubmit={handleSend} className="mt-3 flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={asNote ? 'Interní poznámka pro tým…' : 'Napište pěstounovi…'}
          rows={3}
          className="w-full resize-y rounded-sm border border-transparent bg-field px-3 py-2 text-sm text-text-primary transition-shadow duration-150 focus:border-accent focus:shadow-focus focus:outline-none"
        />
        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <Switch checked={asNote} onChange={setAsNote} label="Jen interní poznámka (tým, ne pěstoun)" />
            Jen interní poznámka (tým, ne pěstoun)
          </label>
          <Button type="submit" loading={loading} disabled={!body.trim()}>
            <Send size={16} /> Odeslat
          </Button>
        </div>
      </form>
    </section>
  )
}
