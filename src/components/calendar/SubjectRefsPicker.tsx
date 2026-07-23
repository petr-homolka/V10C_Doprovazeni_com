import { useMemo, useState } from 'react'
import { Baby, Handshake, Users, UserRound, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { resolveFamilyDisplayName } from '@/lib/familyDisplayName'
import type { SubjectRef, SubjectRefKind } from '@/types/timelineEntry'
import type { FamilyDoc } from '@/types/family'
import type { ChildDoc } from '@/types/child'
import type { FosterPersonDoc } from '@/types/fosterPerson'

const KIND_LABELS: Record<'family' | 'child' | 'fosterPerson', string> = {
  family: 'Rodina',
  child: 'Dítě',
  fosterPerson: 'Pěstoun',
}

/**
 * Petrovo zadání 2026-07-23: čipy "vazby" napříč appkou byly ČISTĚ
 * textové — "u jakou kategorii se jedná" nebylo na první pohled poznat.
 * STEJNÉ ikony jako v `Sidebar.tsx` (Users/UserRound/Baby — Rodiny/
 * Pěstouni/Děti), navíc jemně probarvené pozadí čipu (ne jen ikona) —
 * "chytřejší" než pouhá ikona vedle textu, protože barvu rozpozná i
 * periferní zrak (skenování dlouhého seznamu vazeb), zatímco malá ikona
 * sama by na 20px výšce splynula. Barvy jsou STEJNÉ tři odstíny, co appka
 * už má (primary/success/tier-accent), ne nové vynalezené.
 *
 * `agreement` — tenhle picker sám žádnou vazbu na Dohodu nenabízí (viz
 * `options` níž), ale `SubjectRef['kind']` ho jako typ připouští (jiná
 * místa appky ho dokážou založit) — čip proto musí i tenhle případ umět
 * vykreslit, ne jen spadnout na `undefined`.
 */
const KIND_CHIP: Record<SubjectRefKind, { icon: typeof Users; label: string; className: string }> = {
  family: { icon: Users, label: 'Rodina', className: 'bg-primary-soft text-primary' },
  fosterPerson: { icon: UserRound, label: 'Pěstoun', className: 'bg-success-bg text-success' },
  child: { icon: Baby, label: 'Dítě', className: 'bg-tier-bg text-tier' },
  agreement: { icon: Handshake, label: 'Dohoda', className: 'bg-surface text-text-secondary' },
}

/**
 * Vazba kalendářní události na VÍC entit najednou — rodiny, děti,
 * pěstouni (Petrovo zadání 2026-07-23: "musí tam být i možnost vazby na
 * dítě či pěstouna — a také vazby na více rodin/dětí/pěstounů"). Znovu-
 * používá STEJNÝ `SubjectRef`/`kind` pattern jako hlasový zápis
 * (`timelineService.ts`) — ne nový vynález, appka už tohle přesně řešila.
 *
 * Přidávání JEDNÍM `Combobox` (STEJNÁ komponenta jako dřívější "Rodina"
 * výběr — PWA/mobil-bezpečná, viz její vlastní komentář) s kombinovaným
 * seznamem všech tří typů, štítek "Typ: Jméno" odliší entity od sebe.
 * Vybrané zobrazené jako odebíratelné "čipy" pod tím — žádný nový
 * primitiv, `GroupedList`/`Table` by tady byly zbytečná komplikace pro pár
 * kusů.
 */
export function SubjectRefsPicker({
  value,
  onChange,
  families,
  children,
  fosterPersons,
}: {
  value: SubjectRef[]
  onChange: (refs: SubjectRef[]) => void
  families: Array<{ docId: string; family: FamilyDoc }>
  children: Array<{ docId: string; child: ChildDoc }>
  fosterPersons: Array<{ docId: string; fosterPerson: FosterPersonDoc }>
}) {
  const [pickerValue, setPickerValue] = useState('')

  const labelFor = useMemo(() => {
    const map = new Map<string, string>()
    for (const { docId, family } of families) map.set(`family:${docId}`, resolveFamilyDisplayName(family, null) || family.address || docId)
    for (const { docId, child } of children) map.set(`child:${docId}`, `${child.firstName} ${child.lastName}`)
    for (const { docId, fosterPerson } of fosterPersons) {
      map.set(`fosterPerson:${docId}`, `${fosterPerson.firstName} ${fosterPerson.lastName}`)
    }
    return map
  }, [families, children, fosterPersons])

  const selectedKeys = useMemo(() => new Set(value.map((r) => `${r.kind}:${r.id}`)), [value])

  const options: ComboboxOption[] = useMemo(() => {
    const all: ComboboxOption[] = [
      ...families.map(({ docId, family }) => ({
        value: `family:${docId}`,
        label: `${KIND_LABELS.family}: ${resolveFamilyDisplayName(family, null) || family.address || docId}`,
      })),
      ...children.map(({ docId, child }) => ({
        value: `child:${docId}`,
        label: `${KIND_LABELS.child}: ${child.firstName} ${child.lastName}`,
      })),
      ...fosterPersons.map(({ docId, fosterPerson }) => ({
        value: `fosterPerson:${docId}`,
        label: `${KIND_LABELS.fosterPerson}: ${fosterPerson.firstName} ${fosterPerson.lastName}`,
      })),
    ]
    return all.filter((o) => !selectedKeys.has(o.value))
  }, [families, children, fosterPersons, selectedKeys])

  function handlePick(v: string) {
    if (!v) return
    const [kind, ...rest] = v.split(':')
    const id = rest.join(':')
    onChange([...value, { kind: kind as SubjectRef['kind'], id }])
    setPickerValue('')
  }

  function handleRemove(kind: string, id: string) {
    onChange(value.filter((r) => !(r.kind === kind && r.id === id)))
  }

  return (
    <div className="flex flex-col gap-2">
      <Combobox options={options} value={pickerValue} onChange={handlePick} placeholder="Přidat rodinu, dítě nebo pěstouna…" />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((ref) => {
            const chip = KIND_CHIP[ref.kind]
            const Icon = chip.icon
            const label = labelFor.get(`${ref.kind}:${ref.id}`) ?? ref.id
            return (
              <span
                key={`${ref.kind}-${ref.id}`}
                title={chip.label}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2.5 text-xs font-medium',
                  chip.className,
                )}
              >
                <Icon size={13} strokeWidth={2.25} className="shrink-0" />
                {label}
                <button
                  type="button"
                  onClick={() => handleRemove(ref.kind, ref.id)}
                  aria-label={`Odebrat ${label}`}
                  className="text-current opacity-60 hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
