import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Search, Send, Users } from '@/components/ui/icons'
import { AppShell } from '@/components/shell/AppShell'
import { PageHead } from '@/components/spis/PageBody'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/ui/empty-state'
import { PersonLink } from '@/components/ui/person-link'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import { listFamiliesWithDocIds } from '@/services/familyService'
import { listStaff } from '@/services/staffService'
import { listMessages, sendStaffMessage } from '@/services/messageService'
import type { FamilyDoc } from '@/types/family'
import type { MessageDoc } from '@/types/message'
import type { UserDoc } from '@/types/user'
import { cn } from '@/lib/utils'

interface Conversation {
  docId: string
  family: FamilyDoc
}

function conversationName(family: FamilyDoc): string {
  return family.address || `Spis ${family.uid}`
}

/** Skupina po sobě jdoucích zpráv od stejného autora — SPEC.md "Message
 * bubble anatomy": jméno + čas se ukáže jen jednou nad celou skupinou. */
interface MessageGroup {
  authorRole: 'staff' | 'foster'
  authorLabel: string
  /** uid autora — jméno nad skupinou je proklik na jeho profil. */
  authorUid: string
  dayLabel: string
  items: Array<{ docId: string; message: MessageDoc }>
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })
}

function groupMessages(
  items: Array<{ docId: string; message: MessageDoc }>,
  resolveAuthorName: (uid: string, role: 'staff' | 'foster') => string,
): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const item of items) {
    const day = dayLabel(item.message.createdAt)
    const authorLabel = resolveAuthorName(item.message.createdByUid, item.message.authorRole)
    const last = groups[groups.length - 1]
    if (last && last.dayLabel === day && last.authorLabel === authorLabel && last.authorRole === item.message.authorRole) {
      last.items.push(item)
    } else {
      groups.push({
        authorRole: item.message.authorRole,
        authorLabel,
        authorUid: item.message.createdByUid,
        dayLabel: day,
        items: [item],
      })
    }
  }
  return groups
}

/**
 * Zprávy / Messenger — Cesta D, Petrova headline funkce z Woorkroom
 * reference (SPEC.md). Na rozdíl od referenčního kitu (ad-hoc DM/skupiny
 * mezi kolegy) nemáme multi-user chat backend — "konverzace" proto
 * mapujeme na existující doménový model: JEDNA konverzace = jedna rodina
 * (`families/{id}/messages`, stejná podkolekce jako `FamilyChatSection`
 * na Spisu), staff <-> pěstoun. Vlastní odesílání i "jen interní
 * poznámka" přepínač beze změny (`messageService.ts`) — jen zcela nové
 * dvou-sloupcové rozhraní (seznam konverzací + vlákno) místo vnořené
 * záložky na detailu rodiny.
 *
 * Vědomě VYNECHÁNO oproti referenci (žádná realtime/agregační vrstva v
 * appce, viz §10 "jediný listener = vlastní profil"): náhled poslední
 * zprávy a počet nepřečtených v seznamu konverzací (vyžaduje
 * denormalizovaný `lastMessageAt`/`lastMessageBody` na rodině nebo cloud
 * function — SEAM pro budoucí průchod), "psaní…" indikátor a zmínky
 * (@mention) — žádná z nich nemá v jednostranném párovém vlákně smysl
 * bez vícero účastníků.
 */
export default function MessengerPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const currentUid = userDoc?.uid

  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [staffList, setStaffList] = useState<UserDoc[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)

  const [messages, setMessages] = useState<Array<{ docId: string; message: MessageDoc }> | null>(null)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [asNote, setAsNote] = useState(false)
  const { loading, run } = useAsyncSubmit()
  const listEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!organizationId) return
    Promise.all([listFamiliesWithDocIds(organizationId), listStaff(organizationId)])
      .then(([families, staff]) => {
        setConversations(families)
        setStaffList(staff)
      })
      .catch(() => setError('Seznam konverzací se nepodařilo načíst.'))
  }, [organizationId])

  async function reloadMessages(docId: string) {
    if (!organizationId) return
    setMessagesError(null)
    try {
      setMessages(await listMessages(docId, organizationId))
    } catch {
      setMessagesError('Zprávy se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    if (!selectedDocId) return
    setMessages(null)
    reloadMessages(selectedDocId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocId])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const filtered = useMemo(() => {
    if (!conversations) return null
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => conversationName(c.family).toLowerCase().includes(q))
  }, [conversations, search])

  const selected = conversations?.find((c) => c.docId === selectedDocId) ?? null

  function resolveAuthorName(uid: string, role: 'staff' | 'foster'): string {
    if (role === 'foster') return 'Pěstoun'
    if (uid === currentUid) return 'Vy'
    return staffList.find((s) => s.uid === uid)?.displayName ?? 'Neznámý uživatel'
  }

  const groups = messages ? groupMessages(messages, resolveAuthorName) : []

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed || !selectedDocId || !organizationId || !currentUid) return
    try {
      await run(async () => {
        await sendStaffMessage({
          familyDocId: selectedDocId,
          organizationId,
          createdByUid: currentUid,
          body: trimmed,
          audience: asNote ? 'internal' : 'foster',
        })
        await reloadMessages(selectedDocId)
      })
      setBody('')
    } catch {
      setMessagesError('Zprávu se nepodařilo odeslat.')
    }
  }

  return (
    <AppShell fullBleed>
      <div className="flex min-h-0 flex-1 flex-col bg-app px-4 pb-4">
        <PageHead title="Zprávy" />

        <div className="flex min-h-0 flex-1 gap-4">
          {/* Seznam konverzací */}
          <div className="sp__card flex w-[320px] shrink-0 flex-col p-0">
            <div className="shrink-0 border-b border-border-subtle p-3">
              <div className="flex items-center gap-2 rounded-md border border-border-default px-3 py-2">
                <Search size={16} className="shrink-0 text-text-tertiary" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Hledat rodinu…"
                  className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {error ? (
                <p className="p-3 text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : filtered === null ? (
                <p className="p-3 text-sm text-text-secondary">Načítám…</p>
              ) : filtered.length === 0 ? (
                <EmptyState icon={MessageCircle} text="Žádná rodina neodpovídá hledání." />
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.docId}
                    type="button"
                    onClick={() => setSelectedDocId(c.docId)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors duration-150 hover:bg-overlay-active',
                      selectedDocId === c.docId && 'bg-primary-soft hover:bg-primary-soft',
                    )}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Users size={20} strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-primary">
                        {conversationName(c.family)}
                      </span>
                      <span className="block truncate text-xs text-text-secondary">Rodina</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Vlákno */}
          <div className="sp__card flex min-h-0 flex-1 flex-col p-0">
            {!selected ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState icon={MessageCircle} text="Vyberte rodinu vlevo a otevřete konverzaci." />
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Users size={18} strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{conversationName(selected.family)}</p>
                      <p className="truncate text-xs text-text-secondary">Chat s pěstounem</p>
                    </div>
                  </div>
                  <Link to={`/rodiny/${selected.family.uid}`} className="shrink-0 text-sm font-medium text-primary hover:underline">
                    Otevřít Spis →
                  </Link>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  {messagesError ? (
                    <p className="text-sm text-danger" role="alert">
                      {messagesError}
                    </p>
                  ) : messages === null ? (
                    <p className="text-sm text-text-secondary">Načítám…</p>
                  ) : groups.length === 0 ? (
                    <EmptyState icon={MessageCircle} text="Zatím žádné zprávy — napište pěstounovi jako první." />
                  ) : (
                    <div className="flex flex-col gap-4">
                      {groups.map((group, gi) => {
                        const isStaffGroup = group.authorRole === 'staff'
                        const showDayPill = gi === 0 || groups[gi - 1].dayLabel !== group.dayLabel
                        return (
                          <div key={gi} className="flex flex-col gap-1">
                            {showDayPill && (
                              <div className="my-1 flex justify-center">
                                <span className="sp__chip capitalize">
                                  {group.dayLabel}
                                </span>
                              </div>
                            )}
                            <div className={cn('flex flex-col', isStaffGroup ? 'items-end' : 'items-start')}>
                              <p
                                className={cn(
                                  'mb-1 flex items-center gap-1.5 text-xs text-text-tertiary',
                                  isStaffGroup && 'flex-row-reverse',
                                )}
                              >
                                {/* Jméno zaměstnance (i „Vy") je proklik na
                                 * jeho profil; „Pěstoun" profil zaměstnance
                                 * nemá, takže zůstává textem. */}
                                <PersonLink
                                  kind="staff"
                                  id={
                                    group.authorRole === 'staff' && staffList.some((s) => s.uid === group.authorUid)
                                      ? group.authorUid
                                      : null
                                  }
                                  name={group.authorLabel}
                                  className="font-semibold text-text-secondary"
                                />
                                {new Date(group.items[0].message.createdAt).toLocaleTimeString('cs-CZ', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                              <div className="flex max-w-[70%] flex-col gap-1">
                                {group.items.map(({ docId, message }) => {
                                  const isInternal = message.audience === 'internal'
                                  return (
                                    <div
                                      key={docId}
                                      className={cn(
                                        'rounded-lg px-3.5 py-2.5 text-sm',
                                        isInternal
                                          ? 'border border-dashed border-warning bg-warning-bg text-text-primary'
                                          : isStaffGroup
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-field text-text-primary',
                                      )}
                                    >
                                      <p className="whitespace-pre-wrap">{message.body}</p>
                                      {isInternal && (
                                        <span className="mt-1 inline-block rounded-full bg-warning-bg px-1.5 py-0.5 text-2xs font-medium text-warning">
                                          Jen tým
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={listEndRef} />
                    </div>
                  )}
                </div>

                <form onSubmit={handleSend} className="shrink-0 border-t border-border-subtle p-3">
                  <div className="rounded-md border border-border-default p-2 transition-colors duration-150 focus-within:border-border-strong">
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={asNote ? 'Interní poznámka pro tým…' : 'Napište pěstounovi…'}
                      rows={2}
                      className="resize-none border-0 bg-transparent px-1.5 py-1 text-sm hover:border-0 focus:shadow-none"
                    />
                    <div className="flex items-center justify-between gap-3 px-1 pt-1">
                      <Switch checked={asNote} onChange={setAsNote} label="Jen interní poznámka" />
                      <button
                        type="submit"
                        disabled={!body.trim() || loading}
                        aria-label="Odeslat"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary-hover disabled:opacity-50"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
