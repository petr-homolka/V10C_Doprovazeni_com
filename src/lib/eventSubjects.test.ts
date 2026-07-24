import { describe, expect, it } from 'vitest'
import { buildSubjectDirectory, resolveItemSubjects } from './eventSubjects'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { CalendarEventDoc } from '@/types/calendarEvent'

const family = { displayName: 'Rodina Novotných', avatarUrl: 'fam.jpg' } as unknown as FamilyDoc
const foster = { firstName: 'Jana', lastName: 'Novotná', avatarUrl: 'jana.jpg' } as unknown as FosterPersonDoc
const child = { firstName: 'Petr', lastName: 'Novotný', avatarUrl: null } as unknown as ChildDoc

const directory = buildSubjectDirectory({
  families: [{ docId: 'fam1', family }],
  fosterPersons: [{ docId: 'fost1', fosterPerson: foster }],
  children: [{ docId: 'kid1', child }],
})

function event(partial: Partial<CalendarEventDoc>): CalendarEventDoc {
  return { title: 'Schůzka', ...partial } as CalendarEventDoc
}

describe('resolveItemSubjects', () => {
  it('vrací subjekty ve stejném pořadí jako subjectRefs', () => {
    const subjects = resolveItemSubjects(directory, {
      event: event({
        subjectRefs: [
          { kind: 'child', id: 'kid1' },
          { kind: 'family', id: 'fam1' },
        ],
      }),
    })
    expect(subjects.map((s) => s.label)).toEqual(['Petr Novotný', 'Rodina Novotných'])
    expect(subjects[0].avatarUrl).toBeNull()
    expect(subjects[1].avatarUrl).toBe('fam.jpg')
  })

  it('spadne na rodinu z familyDocId, když událost nemá subjectRefs', () => {
    const subjects = resolveItemSubjects(directory, { event: event({ familyDocId: 'fam1' }) })
    expect(subjects).toEqual([{ kind: 'family', label: 'Rodina Novotných', avatarUrl: 'fam.jpg' }])
  })

  // Připomínky návštěv z Dohody žádný `event` nemají, jen `familyDocId` na
  // úrovni položky — i tam musí být vidět, koho se týkají.
  it('umí položku bez event (připomínka z Dohody)', () => {
    const subjects = resolveItemSubjects(directory, { familyDocId: 'fam1' })
    expect(subjects.map((s) => s.label)).toEqual(['Rodina Novotných'])
  })

  it('ignoruje odkazy na neexistující nebo cizí entity', () => {
    const subjects = resolveItemSubjects(directory, {
      event: event({ subjectRefs: [{ kind: 'fosterPerson', id: 'smazany' }] }),
    })
    expect(subjects).toEqual([])
  })

  // Prázdný výsledek z subjectRefs nesmí zabít fallback — jinak by událost
  // s odkazem na smazané dítě zůstala bez avataru, i když má rodinu.
  it('když z subjectRefs nic nezbude, použije se rodina', () => {
    const subjects = resolveItemSubjects(directory, {
      event: event({ subjectRefs: [{ kind: 'child', id: 'smazane' }], familyDocId: 'fam1' }),
    })
    expect(subjects.map((s) => s.label)).toEqual(['Rodina Novotných'])
  })

  it('vrací prázdné pole u položky bez jakékoli vazby', () => {
    expect(resolveItemSubjects(directory, { event: event({}) })).toEqual([])
    expect(resolveItemSubjects(directory, null)).toEqual([])
  })

  it('pěstoun se skládá z jména a příjmení', () => {
    const subjects = resolveItemSubjects(directory, {
      event: event({ subjectRefs: [{ kind: 'fosterPerson', id: 'fost1' }] }),
    })
    expect(subjects).toEqual([{ kind: 'fosterPerson', label: 'Jana Novotná', avatarUrl: 'jana.jpg' }])
  })
})
