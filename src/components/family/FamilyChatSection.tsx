import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MessageCircle, Send } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/ui/empty-state'
import { PersonLink } from '@/components/ui/person-link'
import { Textarea } from '@/components/ui/textarea'
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

  /** uid autora jen pro známé zaměstnance — jinak odkaz vede do prázdna. */
  function authorLinkId(uid: string): string | null {
    return staffList.some((s) => s.uid === uid) ? uid : null
  }

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
    <div className="max-w-[720px]">
      <div className="flex items-end justify-end gap-4">
        <Button variant="secondary" size="sm" onClick={reload} type="button">
          Obnovit
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex max-h-[480px] flex-col gap-2 overflow-y-auto border-t border-border-subtle pt-4">
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
                <p className="mt-1 flex items-center gap-1.5 text-xs text-text-tertiary">
                  {isFosterAuthor ? (
                    'Pěstoun'
                  ) : (
                    <PersonLink
                      kind="staff"
                      id={authorLinkId(message.createdByUid)}
                      name={resolveAuthorName(message.createdByUid)}
                      muted
                    />
                  )}
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
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={asNote ? 'Interní poznámka pro tým…' : 'Napište pěstounovi…'}
          rows={3}
        />
        <div className="flex items-center justify-end gap-4">
          <Switch checked={asNote} onChange={setAsNote} label="Jen interní poznámka (tým, ne pěstoun)" />
          <Button type="submit" loading={loading} disabled={!body.trim()}>
            <Send size={16} /> Odeslat
          </Button>
        </div>
      </form>
    </div>
  )
}
