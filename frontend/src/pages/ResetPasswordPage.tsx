import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiResetPassword } from '../lib/authApi'

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

/** Карточка ошибки с кнопкой возврата на /forgot-password. */
function TokenError({ message }: { message: string }) {
  return (
    <>
      <div
        role="alert"
        style={{
          background: 'var(--accent-bg)',
          color: 'var(--red)',
          border: '1px solid var(--red)',
          borderRadius: 'var(--r-md)',
          padding: '14px 16px',
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.5,
        }}
      >
        {message}
      </div>
      <Link to="/forgot-password" style={{ textDecoration: 'none' }}>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            marginTop: 16,
            padding: '12px 0',
            borderRadius: 'var(--r-pill)',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            textAlign: 'center',
            fontFamily: 'var(--font)',
          }}
        >
          Запросить новую ссылку
        </motion.div>
      </Link>
    </>
  )
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // После успешной смены — автоматический редирект на логин через 3 секунды.
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => {
      console.debug('[ResetPasswordPage] redirecting to /login')
      navigate('/login')
    }, 3000)
    return () => clearTimeout(timer)
  }, [success, navigate])

  function validatePassword(value: string) {
    if (!value) {
      setPasswordError('Введите новый пароль')
      return false
    }
    if (value.length < 8) {
      setPasswordError('Пароль должен содержать минимум 8 символов')
      return false
    }
    if (!/\d/.test(value)) {
      setPasswordError('Пароль должен содержать хотя бы одну цифру')
      return false
    }
    setPasswordError('')
    return true
  }

  function validateConfirm(value: string, base: string = password) {
    if (value !== base) {
      setConfirmError('Пароли не совпадают')
      return false
    }
    setConfirmError('')
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError('')
    const validPassword = validatePassword(password)
    const validConfirm = validateConfirm(confirm)
    if (!validPassword || !validConfirm) return

    console.debug('[ResetPasswordPage] submit token present=', Boolean(token))
    setSubmitting(true)
    try {
      await apiResetPassword(token, password)
      setSuccess(true)
    } catch (err) {
      console.warn('[ResetPasswordPage] reset failed', err)
      setFormError(err instanceof Error ? err.message : 'Не удалось сменить пароль')
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
            Новый пароль
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
            Придумайте новый пароль для вашего аккаунта
          </p>

          {!token ? (
            <TokenError message="Ссылка недействительна: отсутствует токен сброса. Запросите новую ссылку." />
          ) : success ? (
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
              Пароль успешно изменён. Сейчас вы будете перенаправлены на страницу входа…{' '}
              <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Войти сейчас
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  htmlFor="reset-password"
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}
                >
                  Новый пароль
                </label>
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError) validatePassword(e.target.value)
                    if (confirmError && confirm) validateConfirm(confirm, e.target.value)
                  }}
                  placeholder="Минимум 8 символов, хотя бы одна цифра"
                  style={inputStyle(Boolean(passwordError), Boolean(password))}
                />
                {passwordError && (
                  <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{passwordError}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="reset-confirm"
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}
                >
                  Повторите пароль
                </label>
                <input
                  id="reset-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value)
                    if (confirmError) validateConfirm(e.target.value)
                  }}
                  placeholder="Ещё раз новый пароль"
                  style={inputStyle(Boolean(confirmError), Boolean(confirm))}
                />
                {confirmError && (
                  <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{confirmError}</p>
                )}
              </div>

              {formError && <TokenError message={formError} />}

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
                {submitting ? 'Сохранение…' : 'Сменить пароль'}
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
