import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, Pencil, Plus, Repeat2 } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Drawer } from '@/components/ui/drawer'
import { EmptyState } from '@/components/ui/empty-state'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import {
  createChildHandover,
  listChildHandoversForChild,
  updateChildHandover,
} from '@/services/assistedContactService'
import { createNoteTimelineEntry } from '@/services/timelineService'
import type { ChildHandoverDoc } from '@/types/childHandover'
import { HeartHandshake } from '@/components/ui/icons'

const TO_WHOM_LABELS: Record<ChildHandoverDoc['toWhom'], string> = {
  biologicka_rodina: 'Biologická rodina',
  jina_nahradni_rodina: 'Jiná náhradní rodina',
}

interface Props {
  familyDocId: string
  childId: string
  childName: string
  organizationId: string
  currentUid: string
}

function splitIso(iso: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

const EMPTY = {
  date: '',
  time: '',
  place: '',
  fromPersonName: '',
  toPersonName: '',
  toPersonRelation: '',
  toWhom: 'biologicka_rodina' as ChildHandoverDoc['toWhom'],
  reason: '',
  transportCost: '',
  accommodationNights: '',
  accommodationCost: '',
}

/**
 * Předání dítěte (UX zpětná vazba 2026-07-21) — na PROFILU DÍTĚTE (předání
 * je vždy o konkrétním dítěti). Zakládání/editace v pravém drawer, ne
 * inline rozbalení; seznam je čitelný "kdo → komu (vztah)" s datem/místem
 * a důvodem. Důvody se dají recyklovat (chip s dřív použitým důvodem —
 * "pravidelné předání dle rozsudku č. …" stačí napsat jednou). Při
 * založení se zapíše i poznámka do rodinné časové osy.
 */
export function ChildHandoversSection({ familyDocId, childId, childName, organizationId, currentUid }: Props) {
  const [handovers, setHandovers] = useState<Array<{ docId: string; handover: ChildHandoverDoc }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const { loading: submitting, success, run } = useAsyncSubmit()

  async function reload() {
    setError(null)
    try {
      setHandovers(await listChildHandoversForChild(familyDocId, organizationId, childId))
    } catch {
      setError('Předání se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyDocId, childId, organizationId])

  const reasonPresets = useMemo(() => {
    const seen = new Set<string>()
    for (const { handover } of handovers ?? []) {
      const r = handover.reason?.trim()
      if (r) seen.add(r)
    }
    return [...seen]
  }, [handovers])

  function openNew() {
    setEditingId(null)
    setForm(EMPTY)
    setDrawerOpen(true)
  }

  function openEdit(docId: string, h: ChildHandoverDoc) {
    const { date, time } = splitIso(h.handoverDate)
    setEditingId(docId)
    setForm({
      date,
      time,
      place: h.place ?? '',
      fromPersonName: h.fromPersonName ?? '',
      toPersonName: h.toPersonName ?? '',
      toPersonRelation: h.toPersonRelation ?? '',
      toWhom: h.toWhom,
      reason: h.reason ?? '',
      transportCost: h.transportCost != null ? String(h.transportCost) : '',
      accommodationNights: h.accommodationNights != null ? String(h.accommodationNights) : '',
      accommodationCost: h.accommodationCost != null ? String(h.accommodationCost) : '',
    })
    setDrawerOpen(true)
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.date || !form.reason.trim()) {
      setError('Vyplňte datum a důvod.')
      return
    }
    const handoverDate = new Date(`${form.date}T${form.time || '00:00'}`).toISOString()
    const payload = {
      place: form.place.trim() || undefined,
      fromPersonName: form.fromPersonName.trim() || undefined,
      toPersonName: form.toPersonName.trim() || undefined,
      toPersonRelation: form.toPersonRelation.trim() || undefined,
      toWhom: form.toWhom,
      reason: form.reason.trim(),
      handoverDate,
      transportCost: form.transportCost ? Number(form.transportCost) : undefined,
      accommodationNights: form.accommodationNights ? Number(form.accommodationNights) : undefined,
      accommodationCost: form.accommodationCost ? Number(form.accommodationCost) : undefined,
    }
    try {
      await run(async () => {
        if (editingId) {
          await updateChildHandover(familyDocId, editingId, payload)
        } else {
          await createChildHandover(familyDocId, { organizationId, childRef: childId, createdBy: currentUid, ...payload })
          // Rodinná časová osa dostane jen stručnou stopu (§ profil dítěte
          // drží plný záznam), aby to vedení/KO viděli v kontextu rodiny.
          const when = new Date(handoverDate).toLocaleString('cs-CZ')
          const to = [payload.toPersonName, payload.toPersonRelation && `(${payload.toPersonRelation})`]
            .filter(Boolean)
            .join(' ')
          await createNoteTimelineEntry({
            familyDocId,
            organizationId,
            createdByUid: currentUid,
            subjectRefs: [{ kind: 'child', id: childId }],
            sharingLevel: 'internal',
            body: `Předání dítěte ${childName} — ${when}${to ? ` → ${to}` : ''}. Důvod: ${payload.reason}`,
          })
        }
        await reload()
      })
      setDrawerOpen(false)
    } catch {
      setError('Uložení předání se nezdařilo.')
    }
  }

  return (
    <div className="max-w-[720px]">
      <div className="flex items-end justify-end gap-4">
        <Button variant="secondary" size="sm" onClick={openNew}>
          <Plus size={16} /> Zaznamenat předání
        </Button>
      </div>

      {error && !drawerOpen && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4">
        {handovers === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : handovers.length === 0 ? (
          <EmptyState icon={HeartHandshake} text="Zatím žádné předání dítěte." />
        ) : (
          <div className="flex flex-col gap-2">
            {handovers.map(({ docId, handover }) => (
              <button
                key={docId}
                type="button"
                onClick={() => openEdit(docId, handover)}
                className="group flex items-start justify-between gap-3 sp__sub text-left transition-colors duration-150 hover:bg-overlay-hover"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm text-text-secondary">
                    <span className="text-text-primary">
                      {new Date(handover.handoverDate).toLocaleString('cs-CZ', {
                        day: 'numeric',
                        month: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {handover.place && <span>· {handover.place}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-text-primary">
                    <span>{handover.fromPersonName || 'Pěstoun'}</span>
                    <ArrowRight size={14} className="text-text-tertiary" />
                    <span>{handover.toPersonName || TO_WHOM_LABELS[handover.toWhom]}</span>
                    {handover.toPersonRelation && (
                      <span className="text-text-secondary">({handover.toPersonRelation})</span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-text-secondary">{handover.reason}</p>
                </div>
                <Pencil
                  size={14}
                  className="mt-1 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {drawerOpen && (
        <Drawer onClose={() => setDrawerOpen(false)}>
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-base font-medium text-text-primary">
                {editingId ? 'Upravit předání' : 'Nové předání'} — {childName}
              </h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDrawerOpen(false)} disabled={submitting}>
                Zavřít
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Datum</span>
                  <DatePicker value={form.date} onChange={(v) => set('date', v)} />
                </label>
                <label className="flex w-32 flex-col gap-1.5">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Čas</span>
                  <Input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Místo</span>
                <Input value={form.place} onChange={(e) => set('place', e.target.value)} placeholder="Kde předání proběhlo" />
              </label>

              <div className="flex items-end gap-2">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Předává</span>
                  <Input value={form.fromPersonName} onChange={(e) => set('fromPersonName', e.target.value)} placeholder="Jméno a příjmení" />
                </label>
                <ArrowRight size={16} className="mb-2.5 shrink-0 text-text-tertiary" />
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Přebírá</span>
                  <Input value={form.toPersonName} onChange={(e) => set('toPersonName', e.target.value)} placeholder="Jméno a příjmení" />
                </label>
              </div>

              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Vztah k dítěti</span>
                  <Input value={form.toPersonRelation} onChange={(e) => set('toPersonRelation', e.target.value)} placeholder="matka, teta, …" />
                </label>
                <label className="flex flex-1 flex-col gap-1.5">
                  <span className="text-sm font-medium leading-relaxed text-text-primary">Komu (kategorie)</span>
                  <Select value={form.toWhom} onChange={(e) => set('toWhom', e.target.value as ChildHandoverDoc['toWhom'])}>
                    <option value="biologicka_rodina">Biologická rodina</option>
                    <option value="jina_nahradni_rodina">Jiná náhradní rodina</option>
                  </Select>
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium leading-relaxed text-text-primary">Důvod</span>
                <Input
                  required
                  value={form.reason}
                  onChange={(e) => set('reason', e.target.value)}
                  placeholder="Např. pravidelné předání dle rozsudku č. …"
                />
              </label>
              {reasonPresets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {reasonPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => set('reason', preset)}
                      className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-overlay-active hover:text-text-primary"
                      title="Použít dřívější důvod"
                    >
                      <Repeat2 size={12} /> {preset.length > 40 ? `${preset.slice(0, 40)}…` : preset}
                    </button>
                  ))}
                </div>
              )}

              <div className="sp__sub">
                <p className="text-xs font-medium text-text-secondary">Náklady (PPPD — volitelné)</p>
                <div className="mt-2 flex gap-3">
                  <label className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
                    Doprava (Kč)
                    <Input type="number" value={form.transportCost} onChange={(e) => set('transportCost', e.target.value)} />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
                    Nocí (max 5)
                    <Input type="number" max={5} value={form.accommodationNights} onChange={(e) => set('accommodationNights', e.target.value)} />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
                    Ubytování (Kč)
                    <Input type="number" value={form.accommodationCost} onChange={(e) => set('accommodationCost', e.target.value)} />
                  </label>
                </div>
              </div>

              {error && (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-border px-5 py-4">
              <Button type="submit" loading={submitting} success={success}>
                {editingId ? 'Uložit změny' : 'Zaznamenat předání'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)} disabled={submitting}>
                Zrušit
              </Button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  )
}
