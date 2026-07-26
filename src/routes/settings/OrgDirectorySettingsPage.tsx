import { useEffect, useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { SettingsNav } from '@/components/settings/SettingsNav'
import { SETTINGS_NAV_GROUPS } from '@/components/settings/settingsNavGroups'
import { PageHead } from '@/components/spis/PageBody'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { readOrgCard, saveOrgCard } from '@/services/orgDirectoryService'
import { isReachable } from '@/types/orgDirectory'

/**
 * /nastaveni/vizitka — kontakt pro předávání pěstounů.
 *
 * Když jiná organizace zjistí, že pěstoun, kterého chce přijmout, patří
 * k nám, uvidí přesně tyhle údaje a zavolá. Je to jediná věc, kterou
 * o organizaci vidí kdokoli zvenčí — a zároveň jediná cesta, jak se dá
 * pěstoun převzít, takže neúplná vizitka celý postup zastaví.
 *
 * Proto stránka NEMLČÍ, když je vizitka nepoužitelná: řekne to rovnou
 * nahoře. Prázdné pole vypadá jako „ještě jsem to nevyplnil", ne jako
 * „kvůli tomuhle za mnou nikdo nedosáhne".
 */
export default function OrgDirectorySettingsPage() {
  const { userDoc } = useAuth()
  const organizationId = userDoc?.organizationId
  const canEdit = userDoc?.role === 'org_admin' || userDoc?.role === 'superadmin'

  const [name, setName] = useState('')
  const [contactPersonName, setContactPersonName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) {
      setLoading(false)
      return
    }
    readOrgCard(organizationId)
      .then((card) => {
        if (card) {
          setName(card.name)
          setContactPersonName(card.contactPersonName)
          setPhone(card.phone)
          setEmail(card.email)
        }
      })
      .catch(() => setError('Vizitku se nepodařilo načíst.'))
      .finally(() => setLoading(false))
  }, [organizationId])

  async function handleSave() {
    if (!organizationId || !userDoc) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await saveOrgCard({ organizationId, name, contactPersonName, phone, email, updatedByUid: userDoc.uid })
      setNotice('Uloženo.')
    } catch {
      setError('Uložení se nezdařilo.')
    } finally {
      setSaving(false)
    }
  }

  const reachable = isReachable({
    organizationId: organizationId ?? '',
    name,
    contactPersonName,
    phone,
    email,
    updatedAt: '',
    updatedByUid: '',
  })

  if (!organizationId) {
    return (
      <AppShell secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}>
        <PageHead title="Vizitka organizace" />
        <section className="sp__card sp__card--pad">
          <p className="text-sm text-text-secondary">Tahle stránka je pro zaměstnance konkrétní organizace.</p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell secondaryPanel={<SettingsNav groups={SETTINGS_NAV_GROUPS} />}>
      <PageHead
        title="Vizitka organizace"
        description="Kontakt, který uvidí jiná organizace, když bude chtít převzít pěstouna vedeného u vás."
      >
        {notice && <p className="text-sm text-success">{notice}</p>}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </PageHead>

      {!loading && !reachable && (
        <section className="sp__card sp__card--pad border-l-2 border-l-accent">
          <p className="text-sm text-text-primary">Na tuhle organizaci se nedá dovolat.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Dokud tu nebude název a aspoň telefon nebo e-mail, uvidí druhá strana jen „pěstoun
            patří jinam, ale nemáme na ně kontakt" — a předání se zastaví. Nejde o kosmetiku.
          </p>
        </section>
      )}

      <section className="sp__card sp__card--pad">
        <h2 className="text-base text-text-primary">Kdo jsme a na koho volat</h2>
        <p className="mt-1 text-sm text-text-tertiary">
          Patří sem PRACOVNÍ kontakt na organizaci — jméno vedení, firemní telefon a e-mail.
          Nikdy nic o klientech; tyhle údaje vidí i organizace, se kterou nemáte nic společného.
        </p>

        <div className="sp__group mt-4">
          <label className="sp__grouplabel" htmlFor="org-name">
            Název organizace
          </label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit || loading}
            placeholder="Doprovázení Jih, z. ú."
          />
        </div>

        <div className="sp__group">
          <label className="sp__grouplabel" htmlFor="org-contact">
            Jméno vedení / kontaktní osoby
          </label>
          <Input
            id="org-contact"
            value={contactPersonName}
            onChange={(e) => setContactPersonName(e.target.value)}
            disabled={!canEdit || loading}
            placeholder="Jana Nováková, ředitelka"
          />
        </div>

        <div className="sp__group">
          <label className="sp__grouplabel" htmlFor="org-phone">
            Telefon
          </label>
          <Input
            id="org-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={!canEdit || loading}
            placeholder="+420 777 111 222"
          />
        </div>

        <div className="sp__group">
          <label className="sp__grouplabel" htmlFor="org-email">
            E-mail
          </label>
          <Input
            id="org-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!canEdit || loading}
            placeholder="vedeni@organizace.cz"
          />
        </div>

        {canEdit ? (
          <Button className="mt-4" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Ukládám…' : 'Uložit vizitku'}
          </Button>
        ) : (
          <p className="mt-4 text-sm text-text-tertiary">Vizitku upravuje správce organizace.</p>
        )}
      </section>
    </AppShell>
  )
}
