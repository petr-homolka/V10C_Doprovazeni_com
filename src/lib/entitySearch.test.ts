import { describe, expect, it } from 'vitest'
import { searchEntities } from './entitySearch'
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { UserDoc } from '@/types/user'

const data = {
  families: [
    { docId: 'famDoc1', family: { uid: '9900010000015', displayName: 'Rodina Novotných', address: 'Dlouhá 12, Brno' } as FamilyDoc },
    { docId: 'famDoc2', family: { uid: '9900010000023', displayName: 'Rodina Svobodova', address: 'Krátká 3, Praha' } as FamilyDoc },
  ],
  fosterPersons: [
    {
      docId: 'fostDoc1',
      fosterPerson: {
        uid: '1000010000018',
        familyId: 'famDoc1',
        firstName: 'Jana',
        lastName: 'Novotná',
        phone: '+420 777 123 456',
        email: 'jana@example.com',
      } as FosterPersonDoc,
    },
  ],
  children: [
    {
      docId: 'kidDoc1',
      child: { uid: '2000010000014', familyId: 'famDoc1', firstName: 'Petr', lastName: 'Novotný', birthNumber: '150612/1234' } as ChildDoc,
    },
  ],
  staff: [{ uid: 'staff1', displayName: 'Eva Dvořáková', email: 'eva@org.cz' } as UserDoc],
}

describe('searchEntities', () => {
  it('prázdný dotaz nevrací nic', () => {
    expect(searchEntities('', data)).toEqual([])
    expect(searchEntities('   ', data)).toEqual([])
  })

  it('najde napříč všemi druhy entit', () => {
    const kinds = searchEntities('nov', data).map((r) => r.kind)
    expect(kinds).toContain('family')
    expect(kinds).toContain('fosterPerson')
    expect(kinds).toContain('child')
  })

  // "Novotna" bez diakritiky musí najít "Novotná" — jinak by hledání
  // selhalo pokaždé, když se píše na klávesnici bez háčků.
  it('ignoruje diakritiku v dotazu i v datech', () => {
    expect(searchEntities('novotna', data).some((r) => r.name === 'Jana Novotná')).toBe(true)
    expect(searchEntities('Dvořáková', data).some((r) => r.kind === 'staff')).toBe(true)
    expect(searchEntities('dvorakova', data).some((r) => r.kind === 'staff')).toBe(true)
  })

  // Telefon uložený s mezerami a +420 se musí najít i při zadání holých cifer.
  it('hledá v telefonu bez ohledu na formátování', () => {
    const found = searchEntities('777123', data)
    expect(found.map((r) => r.name)).toContain('Jana Novotná')
  })

  it('hledá v e-mailu, adrese a rodném čísle', () => {
    expect(searchEntities('eva@org', data).map((r) => r.kind)).toEqual(['staff'])
    expect(searchEntities('Dlouhá', data).map((r) => r.kind)).toEqual(['family'])
    expect(searchEntities('150612', data).map((r) => r.kind)).toEqual(['child'])
  })

  it('u pěstouna a dítěte dodá UID rodiny, aby šel složit odkaz na profil', () => {
    const foster = searchEntities('Jana', data)[0]
    expect(foster.familyUid).toBe('9900010000015')
    const child = searchEntities('Petr Novotný', data)[0]
    expect(child.familyUid).toBe('9900010000015')
  })

  it('výsledky začínající dotazem jsou první', () => {
    const names = searchEntities('nov', data).map((r) => r.name)
    // "Novotná"/"Novotný" začínají na "nov", "Rodina Novotných" ne.
    expect(names.indexOf('Rodina Novotných')).toBeGreaterThan(0)
  })

  it('respektuje limit', () => {
    expect(searchEntities('nov', data, 1)).toHaveLength(1)
  })

  it('nic nenajde u dotazu, co nikde není', () => {
    expect(searchEntities('zzzz', data)).toEqual([])
  })
})
