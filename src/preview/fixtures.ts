/**
 * Vzorová data pro designový náhled (`src/preview/`). VÝHRADNĚ pro
 * náhledový build — do produkčního bundlu se nedostanou, protože je nic
 * z `src/main.tsx` neimportuje.
 *
 * Jména jsou zjevně vymyšlená, ale realisticky DLOUHÁ a nestejně dlouhá —
 * design se láme na okrajových případech (dlouhé příjmení, chybějící
 * telefon, prázdný stav), ne na hezky vyváženém vzorku.
 */
import type { FamilyDoc } from '@/types/family'
import type { FosterPersonDoc } from '@/types/fosterPerson'
import type { ChildDoc } from '@/types/child'
import type { UserDoc } from '@/types/user'
import type { AgreementDoc } from '@/types/agreement'
import type { CalendarEventDoc } from '@/types/calendarEvent'
import type { TaskDoc } from '@/types/task'
import type { TimelineEntryDoc } from '@/types/timelineEntry'

const ORG = 'demo-org'
const now = new Date('2026-07-24T10:00:00.000Z')

function iso(dayOffset: number, hour = 9, minute = 0): string {
  const d = new Date(now)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function avatar(seed: string): string {
  // Deterministický šedý placeholder jako data: URI — náhled musí fungovat
  // i bez sítě (a bez cizích služeb).
  const hue = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="hsl(${hue} 45% 78%)"/><circle cx="48" cy="36" r="16" fill="hsl(${hue} 40% 62%)"/><ellipse cx="48" cy="84" rx="26" ry="22" fill="hsl(${hue} 40% 62%)"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const staff: UserDoc[] = [
  { uid: 'u-eva', role: 'klicova_osoba', displayName: 'Eva Dvořáková', email: 'eva.dvorakova@doprovazeni.cz', organizationId: ORG, createdAt: iso(-400), avatarUrl: avatar('eva'), fte: 1 },
  { uid: 'u-marek', role: 'klicova_osoba', displayName: 'Marek Šťastný', email: 'marek.stastny@doprovazeni.cz', organizationId: ORG, createdAt: iso(-380), avatarUrl: avatar('marek'), fte: 0.5 },
  { uid: 'u-hana', role: 'org_admin', displayName: 'Hana Procházková-Nováková', email: 'hana@doprovazeni.cz', organizationId: ORG, createdAt: iso(-500), avatarUrl: avatar('hana'), fte: 1 },
  { uid: 'u-tomas', role: 'asistent_ko', displayName: 'Tomáš Král', email: 'tomas.kral@doprovazeni.cz', organizationId: ORG, createdAt: iso(-120), fte: 1 },
  { uid: 'u-lektor', role: 'spolupracovnik', displayName: 'Ing. Jiří Lektor', email: 'jiri@externi.cz', organizationId: ORG, createdAt: iso(-60), avatarUrl: avatar('jiri') },
]

export const currentUser = staff[2]

interface FamilyFixture {
  docId: string
  family: FamilyDoc
}

export const families: FamilyFixture[] = [
  { docId: 'f1', family: { uid: '9900010000015', orgAccessList: [ORG], fosterPersonRefs: ['fp1', 'fp2'], displayName: 'Rodina Novotných', address: 'Dlouhá 1247/12, Brno-střed', avatarUrl: avatar('f1'), createdAt: iso(-300), lastTouchAt: iso(-2) } as FamilyDoc },
  { docId: 'f2', family: { uid: '9900010000023', orgAccessList: [ORG], fosterPersonRefs: ['fp3'], displayName: 'Rodina Svobodova', address: 'Krátká 3, Praha 6', avatarUrl: avatar('f2'), createdAt: iso(-250), lastTouchAt: iso(-31) } as FamilyDoc },
  { docId: 'f3', family: { uid: '9900010000031', orgAccessList: [ORG], fosterPersonRefs: ['fp4'], address: 'Nad Vodovodem 1834/7a, Praha 10 — Strašnice', createdAt: iso(-90), lastTouchAt: iso(-75) } as FamilyDoc },
  { docId: 'f4', family: { uid: '9900010000049', orgAccessList: [ORG], fosterPersonRefs: ['fp5'], displayName: 'Rodina Vondráčkových-Bartošových', address: 'Palackého náměstí 12, Kroměříž', avatarUrl: avatar('f4'), createdAt: iso(-600), lastTouchAt: iso(-9) } as FamilyDoc },
]

export const fosterPersons: Array<{ docId: string; fosterPerson: FosterPersonDoc }> = [
  { docId: 'fp1', fosterPerson: { uid: '1000010000018', orgAccessList: [ORG], familyId: 'f1', firstName: 'Jana', lastName: 'Novotná', phone: '+420 777 123 456', email: 'jana.novotna@email.cz', birthDate: '1979-04-12', avatarUrl: avatar('fp1'), createdAt: iso(-300) } as FosterPersonDoc },
  { docId: 'fp2', fosterPerson: { uid: '1000010000026', orgAccessList: [ORG], familyId: 'f1', firstName: 'Petr', lastName: 'Novotný', phone: '+420 606 987 654', birthDate: '1976-11-02', createdAt: iso(-300) } as FosterPersonDoc },
  { docId: 'fp3', fosterPerson: { uid: '1000010000034', orgAccessList: [ORG], familyId: 'f2', firstName: 'Michaela', lastName: 'Svobodova', phone: '+420 733 111 222', email: 'm.svobodova@seznam.cz', birthDate: '1985-06-30', avatarUrl: avatar('fp3'), createdAt: iso(-250) } as FosterPersonDoc },
  { docId: 'fp4', fosterPerson: { uid: '1000010000042', orgAccessList: [ORG], familyId: 'f3', firstName: 'Zdeňka', lastName: 'Bartoňová-Křížová', birthDate: '1968-01-19', createdAt: iso(-90) } as FosterPersonDoc },
  { docId: 'fp5', fosterPerson: { uid: '1000010000059', orgAccessList: [ORG], familyId: 'f4', firstName: 'Ludmila', lastName: 'Vondráčková', phone: '+420 601 555 000', email: 'ludmila.v@gmail.com', birthDate: '1961-09-08', avatarUrl: avatar('fp5'), createdAt: iso(-600) } as FosterPersonDoc },
]

export const children: Array<{ docId: string; child: ChildDoc }> = [
  { docId: 'c1', child: { uid: '2000010000014', familyId: 'f1', organizationId: ORG, firstName: 'Adélka', lastName: 'Novotná', birthNumber: '155612/1234', avatarUrl: avatar('c1'), createdAt: iso(-300) } as ChildDoc },
  { docId: 'c2', child: { uid: '2000010000022', familyId: 'f1', organizationId: ORG, firstName: 'Dominik', lastName: 'Novotný', birthNumber: '120415/5678', avatarUrl: avatar('c2'), createdAt: iso(-300) } as ChildDoc },
  { docId: 'c3', child: { uid: '2000010000030', familyId: 'f2', organizationId: ORG, firstName: 'Nikola', lastName: 'Svobodova', birthNumber: '186203/9012', createdAt: iso(-250) } as ChildDoc },
  { docId: 'c4', child: { uid: '2000010000048', familyId: 'f4', organizationId: ORG, firstName: 'Šimon', lastName: 'Vondráček', birthNumber: '090922/3456', avatarUrl: avatar('c4'), createdAt: iso(-600) } as ChildDoc },
  { docId: 'c5', child: { uid: '2000010000055', familyId: 'f4', organizationId: ORG, firstName: 'Kristýna Anna', lastName: 'Vondráčková', birthNumber: '135718/7890', avatarUrl: avatar('c5'), createdAt: iso(-600) } as ChildDoc },
]

export const agreementsByFamilyId: Record<string, AgreementDoc> = {
  f1: { uid: '9000010000010', organizationId: ORG, familyId: 'f1', status: 'active', validFrom: iso(-300), assignedTo: 'u-eva', visitIntervalDays: 60, lastVisitAt: iso(-58), careType: 'zprostredkovana', createdAt: iso(-300) } as AgreementDoc,
  f2: { uid: '9000010000028', organizationId: ORG, familyId: 'f2', status: 'active', validFrom: iso(-250), assignedTo: 'u-marek', visitIntervalDays: 60, lastVisitAt: iso(-95), careType: 'nezprostredkovana', createdAt: iso(-250) } as AgreementDoc,
  f4: { uid: '9000010000036', organizationId: ORG, familyId: 'f4', status: 'active', validFrom: iso(-600), assignedTo: 'u-eva', visitIntervalDays: 90, lastVisitAt: iso(-20), careType: 'zprostredkovana', createdAt: iso(-600) } as AgreementDoc,
}

export const calendarEvents: Array<{ docId: string; event: CalendarEventDoc }> = [
  { docId: 'e1', event: { organizationId: ORG, createdByUid: 'u-eva', assignedToUid: 'u-eva', title: 'Návštěva v rodině', kind: 'navsteva-rodiny', status: 'planovano', start: iso(0, 10), end: iso(0, 12), familyDocId: 'f1', familyUid: '9900010000015', subjectRefs: [{ kind: 'family', id: 'f1' }, { kind: 'child', id: 'c1' }], subjectKeys: ['family:f1', 'child:c1'], createdAt: iso(-5), updatedAt: iso(-5) } as CalendarEventDoc },
  { docId: 'e2', event: { organizationId: ORG, createdByUid: 'u-hana', assignedToUid: 'u-marek', title: 'Supervize týmu', kind: 'supervize', status: 'planovano', start: iso(0, 14), end: iso(0, 16), subjectRefs: [], subjectKeys: [], createdAt: iso(-10), updatedAt: iso(-10) } as CalendarEventDoc },
  { docId: 'e3', event: { organizationId: ORG, createdByUid: 'u-eva', assignedToUid: 'u-eva', title: 'Doprovod k lékaři — Šimon', kind: 'schuzka', status: 'planovano', start: iso(1, 8, 30), end: iso(1, 10), familyDocId: 'f4', familyUid: '9900010000049', subjectRefs: [{ kind: 'child', id: 'c4' }], subjectKeys: ['child:c4', 'family:f4'], createdAt: iso(-3), updatedAt: iso(-3) } as CalendarEventDoc },
  { docId: 'e4', event: { organizationId: ORG, createdByUid: 'u-tomas', assignedToUid: 'u-tomas', title: 'Případová konference OSPOD Brno-střed', kind: 'jine', status: 'planovano', start: iso(2, 9), end: iso(2, 11, 30), familyDocId: 'f1', familyUid: '9900010000015', subjectRefs: [{ kind: 'family', id: 'f1' }, { kind: 'fosterPerson', id: 'fp1' }, { kind: 'fosterPerson', id: 'fp2' }, { kind: 'child', id: 'c1' }, { kind: 'child', id: 'c2' }], subjectKeys: ['family:f1'], createdAt: iso(-1), updatedAt: iso(-1) } as CalendarEventDoc },
  { docId: 'e5', event: { organizationId: ORG, createdByUid: 'u-eva', assignedToUid: 'u-eva', title: 'Vzdělávání pěstounů — blok 2', kind: 'jine', status: 'planovano', start: iso(-4, 9), end: iso(-4, 15), subjectRefs: [{ kind: 'fosterPerson', id: 'fp3' }], subjectKeys: ['fosterPerson:fp3'], createdAt: iso(-20), updatedAt: iso(-20) } as CalendarEventDoc },
]

export const tasks: Array<{ docId: string; task: TaskDoc }> = [
  { docId: 't1', task: { organizationId: ORG, createdByUid: 'u-hana', assignedToUid: 'u-eva', title: 'Doplnit zprávu pro OSPOD za 2. kvartál', dueDate: iso(-3).slice(0, 10), status: 'otevreny', subjectRefs: [{ kind: 'family', id: 'f1' }], subjectKeys: ['family:f1'], createdAt: iso(-15), updatedAt: iso(-15) } as TaskDoc },
  { docId: 't2', task: { organizationId: ORG, createdByUid: 'u-eva', assignedToUid: 'u-eva', title: 'Zajistit doučování matematiky', notes: 'Domluvit s lektorem termín, Adélka má čtvrtky volné.', dueDate: iso(6).slice(0, 10), status: 'otevreny', subjectRefs: [{ kind: 'child', id: 'c1' }], subjectKeys: ['child:c1'], createdAt: iso(-4), updatedAt: iso(-4) } as TaskDoc },
  { docId: 't3', task: { organizationId: ORG, createdByUid: 'u-marek', assignedToUid: 'u-tomas', title: 'Objednat respitní pobyt na prázdniny', status: 'otevreny', subjectRefs: [{ kind: 'family', id: 'f4' }], subjectKeys: ['family:f4'], createdAt: iso(-8), updatedAt: iso(-8) } as TaskDoc },
  { docId: 't4', task: { organizationId: ORG, createdByUid: 'u-eva', assignedToUid: 'u-eva', title: 'Podepsat aktualizaci Dohody', status: 'hotovo', completedAt: iso(-2), subjectRefs: [{ kind: 'family', id: 'f1' }], subjectKeys: ['family:f1'], createdAt: iso(-30), updatedAt: iso(-2) } as TaskDoc },
]

export const timelineEntries: Array<{ docId: string; entry: TimelineEntryDoc }> = [
  { docId: 'tl1', entry: { organizationId: ORG, familyId: 'f1', createdByUid: 'u-eva', type: 'visit', occurredAt: iso(-2, 10), body: 'Návštěva proběhla v klidné atmosféře. Adélka ukazovala vysvědčení, zlepšila se v matematice o stupeň. Domluvili jsme doučování na čtvrtky.', subjectRefs: [{ kind: 'child', id: 'c1' }], sharingLevel: 'partner', createdAt: iso(-2) } as unknown as TimelineEntryDoc },
  { docId: 'tl2', entry: { organizationId: ORG, familyId: 'f1', createdByUid: 'u-tomas', type: 'voice_entry', occurredAt: iso(-9, 15, 20), body: 'Telefonát s paní Novotnou — Dominik měl konflikt ve škole, řeší třídní učitelka. Zavolám v pátek.', subjectRefs: [{ kind: 'child', id: 'c2' }, { kind: 'fosterPerson', id: 'fp1' }], sharingLevel: 'internal', createdAt: iso(-9) } as unknown as TimelineEntryDoc },
  { docId: 'tl3', entry: { organizationId: ORG, familyId: 'f1', createdByUid: 'u-hana', type: 'note', occurredAt: iso(-25, 8), body: 'Připomínka: v září vyprší lékařská zpráva.', subjectRefs: [], sharingLevel: 'internal', createdAt: iso(-25) } as unknown as TimelineEntryDoc },
]

export const starredFamilyIds = ['f1']

export const organization = {
  orgCode: '0001',
  name: 'Doprovázení Morava, o.p.s.',
  koCapacityThreshold: 25,
}

export const enumOptions = [
  { key: 'navsteva-rodiny', label: 'Návštěva rodiny', createdByUid: 'u-hana', createdAt: iso(-40) },
  { key: 'pripadova-konference', label: 'Případová konference', createdByUid: 'u-hana', createdAt: iso(-40) },
]

/** Doplňkové rodiny, ať seznam vypadá jako seznam, ne jako ukázka čtyř karet
 * — hustota a rytmus se na čtyřech řádcích posoudit nedají. */
const FILLER_NAMES = [
  ['Rodina Horákových', 'Bezručova 8, Olomouc'],
  ['Rodina Šimkova', 'Na Vyhlídce 214, Zlín'],
  ['Rodina Marešových', 'U Stadionu 41, Pardubice'],
  ['Rodina Beránkových-Dostálových', 'Nábřeží kapitána Jaroše 1002/4, Praha 7'],
  ['Rodina Kolářova', 'Slunečná 19, Liberec'],
  ['Rodina Urbanových', 'Tylova 55, Plzeň'],
  ['Rodina Fialových', 'Zahradní 7, Hradec Králové'],
  ['Rodina Sedláčkových', 'Komenského 320, Jihlava'],
]

for (const [index, [displayName, address]] of FILLER_NAMES.entries()) {
  const docId = `f${5 + index}`
  const uid = `99000100000${57 + index * 8}`
  families.push({
    docId,
    family: {
      uid,
      orgAccessList: [ORG],
      fosterPersonRefs: [],
      displayName,
      address,
      // Každá druhá bez fotky — chybějící avatar je běžný stav.
      ...(index % 2 === 0 ? { avatarUrl: avatar(docId) } : {}),
      createdAt: iso(-200 + index * 5),
      lastTouchAt: iso(-index * 11),
    } as FamilyDoc,
  })
  agreementsByFamilyId[docId] = {
    uid: `90000100000${20 + index}`,
    organizationId: ORG,
    familyId: docId,
    status: 'active',
    validFrom: iso(-200 + index * 5),
    assignedTo: index % 3 === 0 ? 'u-marek' : 'u-eva',
    visitIntervalDays: 60,
    lastVisitAt: iso(-index * 11),
    careType: 'zprostredkovana',
    createdAt: iso(-200 + index * 5),
  } as AgreementDoc
}
