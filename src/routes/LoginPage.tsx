import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/', { replace: true })
    } catch {
      setError('Přihlášení se nezdařilo. Zkontrolujte e-mail a heslo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <div className="w-full max-w-[380px] rounded-lg border border-border bg-surface p-6 shadow-raised">
        <h1 className="mb-1 text-lg font-normal leading-normal text-text-primary">
          Doprovázení.com
        </h1>
        <p className="mb-6 text-sm text-text-secondary">
          Přihlaste se do svého účtu.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">E-mail</span>
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-relaxed text-text-primary">Heslo</span>
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? 'Přihlašuji…' : 'Přihlásit se'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-text-secondary">
          Nová organizace?{' '}
          <Link to="/registrace" className="font-bold text-accent">
            Zaregistrujte se
          </Link>
        </p>
      </div>
    </div>
  )
}
