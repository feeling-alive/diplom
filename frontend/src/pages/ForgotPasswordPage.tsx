import { useState, type CSSProperties, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiForgotPassword } from '../lib/authApi'

const inputStyle = (hasError: boolean, hasValue: boolean): CSSProperties => ({
  width: '100%',
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: hasError
    ? '1px solid var(--red)'
    : hasValue
      ? '1px solid var(--accent)'
      : '1px solid var(--border)',
  fontSize: 13,
  color: 'var(--text)',
  background: 'var(--white)',
  outline: 'none',
  fontFamily: 'var(--font)',
  transition: 'border-color 0.15s',
})

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  function validateEmail(value: string) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!value) {
      setEmailError('Введите email')
      return false
    }
    if (!re.test(value)) {
      setEmailError('Введите корректный email')
      return false
    }
    setEmailError('')
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!validateEmail(email)) return

    console.debug('[ForgotPasswordPage] submit', email)
    setSubmitting(true)
    try {
      await apiForgotPassword(email)
      setSent(true)
    } catch (err) {
      console.warn('[ForgotPasswordPage] request failed', err)
      setFormError(err instanceof Error ? err.message : 'Не удалось отправить запрос')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: 16, height: '100%', boxSizing: 'border-box' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          maxWidth: 420,
          margin: 'auto',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '24px 0',
        }}
      >
        <div
          style={{
            background: 'var(--white)',
            borderRadius: 22,
            boxShadow: 'var(--shadow-lg)',
            padding: 32,
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
            Восстановление пароля
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
            Укажите email — мы отправим ссылку для сброса пароля
          </p>

          {sent ? (
            <div
              role="status"
              style={{
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent)',
                borderRadius: 'var(--r-md)',
                padding: '14px 16px',
                fontSize: 13,
                color: 'var(--text)',
                lineHeight: 1.5,
              }}
            >
              Если аккаунт существует, письмо отправлено. Проверьте почту — ссылка действительна
              15 минут.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  htmlFor="forgot-email"
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}
                >
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) validateEmail(e.target.value)
                  }}
                  placeholder="example@mail.com"
                  style={inputStyle(Boolean(emailError), Boolean(email))}
                />
                {emailError && (
                  <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{emailError}</p>
                )}
              </div>

              {formError && (
                <div
                  role="alert"
                  style={{
                    background: 'var(--accent-bg)',
                    color: 'var(--red)',
                    border: '1px solid var(--red)',
                    borderRadius: 'var(--r-md)',
                    padding: '10px 14px',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {formError}
                </div>
              )}

              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={submitting ? undefined : { scale: 1.02 }}
                whileTap={submitting ? undefined : { scale: 0.98 }}
                style={{
                  marginTop: 8,
                  padding: '12px 0',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                  cursor: submitting ? 'default' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  fontFamily: 'var(--font)',
                }}
              >
                {submitting ? 'Отправка…' : 'Отправить ссылку'}
              </motion.button>
            </form>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--muted)' }}>
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>
              ← Вернуться к входу
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
