import { useEffect, useState, type FormEvent } from 'react'
import { Check, GraduationCap, Minus, Plus } from '@/components/ui/icons'
import { Table, TableHeaderRow, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgressBar } from '@/components/ui/progress-bar'
import { addCourse, listCourses, recordBenefitCheck, type AddCourseInput } from '@/services/courseService'
import type { BenefitCheckEntry, CourseDoc, StateBenefitsMap } from '@/types/course'
import type { FosterPersonDoc } from '@/types/fosterPerson'

export interface FosterPersonEducationSectionProps {
  fosterPersonId: string
  fosterPerson: FosterPersonDoc
  organizationId: string
  currentUid: string
}

const COURSE_TYPE_LABELS: Record<CourseDoc['type'], string> = {
  prezencne: 'Prezenčně',
  online: 'Online',
  hybrid: 'Hybridně',
}

const COURSE_COLUMNS = '110px 1.5fr 110px 90px 100px'

const BENEFIT_LABELS: Record<keyof StateBenefitsMap, string> = {
  odmenaPestouna: 'Odměna pěstouna',
  prispevekPriPP: 'Příspěvek při svěření dítěte do PP',
  prispevekPriPrevzeti: 'Příspěvek při převzetí dítěte',
  prispevekNaVozidlo: 'Příspěvek na auto',
  zaopatrovaciPrispevek: 'Zaopatřovací příspěvek',
}

const BENEFIT_KEYS = Object.keys(BENEFIT_LABELS) as Array<keyof StateBenefitsMap>

function fallbackBenefitEntry(): BenefitCheckEntry {
  return { status: 'nezjisteno', needsHelp: false, updatedAt: new Date(0).toISOString() }
}

function buildInitialBenefits(existing: StateBenefitsMap | undefined): StateBenefitsMap {
  return {
    odmenaPestouna: existing?.odmenaPestouna ?? fallbackBenefitEntry(),
    prispevekPriPP: existing?.prispevekPriPP ?? fallbackBenefitEntry(),
    prispevekPriPrevzeti: existing?.prispevekPriPrevzeti ?? fallbackBenefitEntry(),
    prispevekNaVozidlo: existing?.prispevekNaVozidlo ?? fallbackBenefitEntry(),
    zaopatrovaciPrispevek: existing?.zaopatrovaciPrispevek ?? fallbackBenefitEntry(),
  }
}

/**
 * §4.4.A (vzdělávání, 24h/18h za 12 měsíců) + §3.1/§4.4.D (stav dávek).
 * `fosterPerson` je předaný prop, ne lokálně dotahovaný dokument — po
 * uložení kontroly dávek proto držíme právě uložený stav v lokálním
 * state (`benefitDrafts`), místo abychom čekali na reload rodiče.
 */
export function FosterPersonEducationSection({
  fosterPersonId,
  fosterPerson,
  organizationId,
  currentUid,
}: FosterPersonEducationSectionProps) {
  const [courses, setCourses] = useState<Array<{ docId: string; course: CourseDoc }> | null>(null)
  const [coursesError, setCoursesError] = useState<string | null>(null)

  const [showCourseForm, setShowCourseForm] = useState(false)
  const [courseTitle, setCourseTitle] = useState('')
  const [courseType, setCourseType] = useState<CourseDoc['type']>('prezencne')
  const [courseHours, setCourseHours] = useState('')
  const [courseOccurredAt, setCourseOccurredAt] = useState('')
  const [courseCountsTowardOfficial, setCourseCountsTowardOfficial] = useState(true)
  const [courseCost, setCourseCost] = useState('')
  const [courseSubmitting, setCourseSubmitting] = useState(false)
  const [courseError, setCourseError] = useState<string | null>(null)

  const [benefitDrafts, setBenefitDrafts] = useState<StateBenefitsMap>(() =>
    buildInitialBenefits(fosterPerson.stateBenefits),
  )
  const [benefitSubmitting, setBenefitSubmitting] = useState(false)
  const [benefitError, setBenefitError] = useState<string | null>(null)
  const [benefitSavedAt, setBenefitSavedAt] = useState<string | null>(null)

  async function reloadCourses() {
    setCoursesError(null)
    try {
      const list = await listCourses(fosterPersonId)
      setCourses(list)
    } catch {
      setCoursesError('Seznam kurzů se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    reloadCourses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fosterPersonId])

  async function handleAddCourse(e: FormEvent) {
    e.preventDefault()
    setCourseSubmitting(true)
    setCourseError(null)
    try {
      const input: AddCourseInput = {
        fosterPersonId,
        organizationId,
        title: courseTitle,
        type: courseType,
        hours: Number(courseHours),
        occurredAt: new Date(courseOccurredAt).toISOString(),
        countsTowardOfficial: courseCountsTowardOfficial,
        cost: courseCost ? Number(courseCost) : null,
      }
      await addCourse(input)
      setCourseTitle('')
      setCourseType('prezencne')
      setCourseHours('')
      setCourseOccurredAt('')
      setCourseCountsTowardOfficial(true)
      setCourseCost('')
      setShowCourseForm(false)
      await reloadCourses()
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : 'Přidání kurzu se nezdařilo.')
    } finally {
      setCourseSubmitting(false)
    }
  }

  function updateBenefitStatus(key: keyof StateBenefitsMap, status: BenefitCheckEntry['status']) {
    setBenefitDrafts((prev) => ({ ...prev, [key]: { ...prev[key], status } }))
  }

  function updateBenefitNeedsHelp(key: keyof StateBenefitsMap, needsHelp: boolean) {
    setBenefitDrafts((prev) => ({ ...prev, [key]: { ...prev[key], needsHelp } }))
  }

  async function handleSaveBenefitCheck() {
    setBenefitSubmitting(true)
    setBenefitError(null)
    try {
      const updatedAt = new Date().toISOString()
      const updatedStateBenefits: StateBenefitsMap = {
        odmenaPestouna: { ...benefitDrafts.odmenaPestouna, updatedAt },
        prispevekPriPP: { ...benefitDrafts.prispevekPriPP, updatedAt },
        prispevekPriPrevzeti: { ...benefitDrafts.prispevekPriPrevzeti, updatedAt },
        prispevekNaVozidlo: { ...benefitDrafts.prispevekNaVozidlo, updatedAt },
        zaopatrovaciPrispevek: { ...benefitDrafts.zaopatrovaciPrispevek, updatedAt },
      }
      const findings: Partial<Record<keyof StateBenefitsMap, BenefitCheckEntry['status']>> = {
        odmenaPestouna: updatedStateBenefits.odmenaPestouna.status,
        prispevekPriPP: updatedStateBenefits.prispevekPriPP.status,
        prispevekPriPrevzeti: updatedStateBenefits.prispevekPriPrevzeti.status,
        prispevekNaVozidlo: updatedStateBenefits.prispevekNaVozidlo.status,
        zaopatrovaciPrispevek: updatedStateBenefits.zaopatrovaciPrispevek.status,
      }
      const needsIntervention = Object.values(updatedStateBenefits).some((b) => b.needsHelp)
      await recordBenefitCheck(fosterPersonId, organizationId, currentUid, findings, needsIntervention, undefined, updatedStateBenefits)
      setBenefitDrafts(updatedStateBenefits)
      setBenefitSavedAt(updatedAt)
    } catch (err) {
      setBenefitError(err instanceof Error ? err.message : 'Uložení kontroly dávek se nezdařilo.')
    } finally {
      setBenefitSubmitting(false)
    }
  }

  const educationWindow = fosterPerson.educationOfficial

  return (
    <section className="mt-8">
      <h2 className="text-lg font-normal leading-tight text-text-primary">
        Vzdělávání a dávky — {fosterPerson.firstName} {fosterPerson.lastName}
      </h2>

      <div className="mt-4 rounded-lg border border-border-subtle bg-surface p-4">
        {educationWindow ? (
          <>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-text-primary">
                {educationWindow.hoursCompletedInWindow} / {educationWindow.hoursRequired} h
              </span>
              <span className="text-sm text-text-secondary">
                {new Date(educationWindow.windowStart).toLocaleDateString('cs-CZ')} –{' '}
                {new Date(educationWindow.windowEnd).toLocaleDateString('cs-CZ')}
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={educationWindow.hoursCompletedInWindow} max={educationWindow.hoursRequired} />
            </div>
            {educationWindow.hoursBankedFromPrevious > 0 && (
              <p className="mt-2 text-sm text-text-secondary">
                z toho {educationWindow.hoursBankedFromPrevious} h přeneseno z předchozího okna
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-text-secondary">Vzdělávací okno zatím nezaloženo (založí se první Dohodou).</p>
        )}
        {/* NEZÁVISLÝ na educationWindow — nikdy se nenuluje, počítá se napříč všemi Dohodami/organizacemi. */}
        <p className="mt-3 text-sm text-text-secondary">
          Celkem za dobu pěstounství: {fosterPerson.educationLifetimeHours ?? 0} h
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <h3 className="text-sm font-medium text-text-primary">Kurzy</h3>
        <Button variant="secondary" size="sm" onClick={() => setShowCourseForm((v) => !v)}>
          {showCourseForm ? (
            'Zrušit'
          ) : (
            <>
              <Plus size={16} /> Přidat kurz
            </>
          )}
        </Button>
      </div>

      {showCourseForm && (
        <form
          onSubmit={handleAddCourse}
          className="mt-3 flex max-w-[560px] flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Název</span>
              <Input required value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Typ</span>
              <Select
                value={courseType}
                onChange={(e) => setCourseType(e.target.value as CourseDoc['type'])}
              >
                <option value="prezencne">Prezenčně</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybridně</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Hodiny</span>
              <Input
                required
                type="number"
                min="0"
                step="0.5"
                value={courseHours}
                onChange={(e) => setCourseHours(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Datum</span>
              <DatePicker value={courseOccurredAt} onChange={setCourseOccurredAt} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium leading-relaxed text-text-primary">Cena (Kč, volitelné)</span>
              <Input type="number" min="0" value={courseCost} onChange={(e) => setCourseCost(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                checked={courseCountsTowardOfficial}
                onChange={(e) => setCourseCountsTowardOfficial(e.target.checked)}
                className="size-4 rounded-sm border border-border-medium bg-inset"
              />
              <span className="text-sm text-text-primary">Počítá se do limitu</span>
            </label>
          </div>
          {courseError && (
            <p className="text-sm text-danger" role="alert">
              {courseError}
            </p>
          )}
          <Button type="submit" disabled={courseSubmitting} className="w-fit">
            {courseSubmitting ? 'Přidávám…' : 'Přidat'}
          </Button>
        </form>
      )}

      <div className="mt-4 max-w-[928px]">
        {coursesError ? (
          <p className="text-sm text-danger" role="alert">
            {coursesError}
          </p>
        ) : courses === null ? (
          <p className="text-sm text-text-secondary">Načítám…</p>
        ) : courses.length === 0 ? (
          <EmptyState icon={GraduationCap} text="Zatím žádné kurzy." />
        ) : (
          <Table>
            <TableHeaderRow columns={COURSE_COLUMNS} labels={['Datum', 'Název', 'Typ', 'Hodiny', 'Do limitu']} />
            {courses.map(({ docId, course }) => (
              <TableRow key={docId} columns={COURSE_COLUMNS}>
                <span className="text-sm text-text-secondary">
                  {new Date(course.occurredAt).toLocaleDateString('cs-CZ')}
                </span>
                <span className="truncate text-sm text-text-primary">{course.title}</span>
                <span className="text-sm text-text-secondary">{COURSE_TYPE_LABELS[course.type]}</span>
                <span className="text-sm text-text-secondary">{course.hours}</span>
                <span className="text-sm text-text-secondary">
                  {course.countsTowardOfficial ? (
                    <Check className="size-4 text-text-primary" aria-label="ano" />
                  ) : (
                    <Minus className="size-4 text-text-tertiary" aria-label="ne" />
                  )}
                </span>
              </TableRow>
            ))}
          </Table>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-text-primary">Stav dávek</h3>
        <div className="mt-3 flex max-w-[560px] flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
          {BENEFIT_KEYS.map((key) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-text-primary">{BENEFIT_LABELS[key]}</span>
              <div className="flex items-center gap-3">
                <Select
                  className="w-44"
                  value={benefitDrafts[key].status}
                  onChange={(e) => updateBenefitStatus(key, e.target.value as BenefitCheckEntry['status'])}
                >
                  <option value="chodi">Chodí</option>
                  <option value="nechodi">Nechodí</option>
                  <option value="nezjisteno">Nezjištěno</option>
                </Select>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={benefitDrafts[key].needsHelp}
                    onChange={(e) => updateBenefitNeedsHelp(key, e.target.checked)}
                    className="size-4 rounded-sm border border-border-medium bg-inset"
                  />
                  <span className="text-sm text-text-secondary">Potřebuje pomoc</span>
                </label>
              </div>
            </div>
          ))}
          {benefitError && (
            <p className="text-sm text-danger" role="alert">
              {benefitError}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveBenefitCheck} disabled={benefitSubmitting} className="w-fit">
              {benefitSubmitting ? 'Ukládám…' : 'Uložit kontrolu dávek'}
            </Button>
            {benefitSavedAt && (
              <span className="text-sm text-text-secondary">
                Uloženo {new Date(benefitSavedAt).toLocaleString('cs-CZ')}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
