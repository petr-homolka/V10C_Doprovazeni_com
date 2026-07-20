import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { generateOspodReport } from '@/services/ospodReportService'
import { getOrganization } from '@/services/organizationService'
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
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
      navigate(`/rodiny/${familyUid}/dokumenty/${docId}`)
    } catch {
      setError('Report se nepodařilo vygenerovat.')
      setSubmitting(false)
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
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
          <label className="flex flex-col gap-1 text-sm text-text-secondary">
            Název dokumentu
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Období od
              <Input
                type="date"
                value={period.from}
                onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
                required
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-text-secondary">
              Období do
              <Input
                type="date"
                value={period.to}
                onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
                required
              />
            </label>
          </div>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Generuji…' : 'Vygenerovat report'}
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
