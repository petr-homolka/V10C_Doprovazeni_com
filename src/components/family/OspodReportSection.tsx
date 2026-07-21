import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { generateOspodReport } from '@/services/ospodReportService'
import { getOrganization } from '@/services/organizationService'
import { useAsyncSubmit } from '@/hooks/useAsyncSubmit'
import type { FosterPersonDoc } from '@/types/fosterPerson'

interface OspodReportSectionProps {
  familyDocId: string
  familyUid: string
  organizationId: string
  createdByUid: string
  childIds: string[]
  fosterPersons: Array<{ fosterPerson: FosterPersonDoc }>
}

function defaultPeriod(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setMonth(from.getMonth() - 3)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/**
 * M6 §A.1/§A.2 — report NENÍ zvláštní entita, jen vygenerovaný `document`
 * (viz `ospodReportService` komentář). Po založení naviguje rovnou na
 * editor dokumentu — KO tam obsah zkontroluje/doplní před odesláním
 * (`documentService` `draft` stav), tahle sekce sama žádný editor nemá.
 */
export function OspodReportSection({
  familyDocId,
  familyUid,
  organizationId,
  createdByUid,
  childIds,
  fosterPersons,
}: OspodReportSectionProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState(defaultPeriod)
  const [title, setTitle] = useState('Zpráva o průběhu péče pro OSPOD')
  const { loading: submitting, success, run } = useAsyncSubmit()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      let generatedDocId: string | undefined
      await run(async () => {
        const org = await getOrganization(organizationId)
        if (!org) throw new Error('org not found')
        const { docId } = await generateOspodReport({
          familyDocId,
          organizationId,
          orgCode: org.orgCode,
          createdByUid,
          title,
          periodFrom: new Date(period.from).toISOString(),
          periodTo: new Date(period.to).toISOString(),
          childIds,
          fosterPersons,
        })
        generatedDocId = docId
      })
      navigate(`/rodiny/${familyUid}/dokumenty/${generatedDocId}`)
    } catch {
      setError('Report se nepodařilo vygenerovat.')
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-normal leading-tight text-text-primary">Report pro OSPOD</h2>
        {!open && (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <FileText size={16} /> Vyplnit report
          </Button>
        )}
      </div>
      {open && (
        <form onSubmit={handleSubmit} className="mt-3 max-w-[560px] flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Název dokumentu
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Období
            <DateRangePicker from={period.from} to={period.to} onChange={setPeriod} />
          </label>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" loading={submitting} success={success}>
              Vygenerovat report
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Zrušit
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
