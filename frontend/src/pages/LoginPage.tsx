import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const navigate = useNavigate()

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

  function validatePassword(value: string) {
    if (!value) {
      setPasswordError('Введите пароль')
      return false
    }
    if (value.length < 8) {
      setPasswordError('Пароль должен содержать минимум 8 символов')
      return false
    }
    setPasswordError('')
    return true
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validEmail = validateEmail(email)
    const validPassword = validatePassword(password)
    if (!validEmail || !validPassword) return

    // Mock-авторизация
    try {
      localStorage.setItem('fintrack_is_authenticated', 'true')
      localStorage.setItem(
        'fintrack_user',
        JSON.stringify({ nickname: 'Пользователь', email }),
      )
      navigate('/')
    } catch {
      // ignore
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
            Вход
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
            Войдите в свой аккаунт
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) validateEmail(e.target.value)
                }}
                placeholder="example@mail.com"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--r-md)',
                  border: emailError
                    ? '1px solid var(--red)'
                    : email
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                  fontSize: 13,
                  color: 'var(--text)',
                  background: 'var(--white)',
                  outline: 'none',
                  fontFamily: 'var(--font)',
                  transition: 'border-color 0.15s',
                }}
              />
              {emailError && (
                <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{emailError}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}
              >
                Пароль
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (passwordError) validatePassword(e.target.value)
                }}
                placeholder="Минимум 8 символов"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--r-md)',
                  border: passwordError
                    ? '1px solid var(--red)'
                    : password
                      ? '1px solid var(--accent)'
                      : '1px solid var(--border)',
                  fontSize: 13,
                  color: 'var(--text)',
                  background: 'var(--white)',
                  outline: 'none',
                  fontFamily: 'var(--font)',
                  transition: 'border-color 0.15s',
                }}
              />
              {passwordError && (
                <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{passwordError}</p>
              )}
            </div>

            {/* Submit button */}
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                marginTop: 8,
                padding: '12px 0',
                borderRadius: 'var(--r-pill)',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
              }}
            >
              Войти
            </motion.button>
          </form>

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '20px 0',
            }}
          >
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>или</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Google login */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              borderRadius: 'var(--r-pill)',
              background: 'var(--white)',
              border: '1px solid var(--border)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text)',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
            onClick={() => {
              localStorage.setItem('fintrack_is_authenticated', 'true')
              localStorage.setItem('fintrack_user', JSON.stringify({ nickname: 'Пользователь Google', email: 'google@user.com' }))
              navigate('/')
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Войти через Google
          </motion.button>

          {/* Link to register */}
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--muted)' }}>
            Нет аккаунта?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}