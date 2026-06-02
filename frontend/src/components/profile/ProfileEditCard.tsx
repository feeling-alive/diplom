// Left card of the profile module: edit username (with live uniqueness check),
// plus read-only email and registration date. Controlled by ProfilePage so a
// single useProfile() instance owns the state. Light design system, no MUI.

import { useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Check, Loader2, Lock, Save, X } from 'lucide-react'
import type { UsernameCheck } from '../../hooks/useProfile'

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const fieldStyle = (highlight?: boolean): CSSProperties => ({
  width: '100%',
  padding: '10px 14px',
  borderRadius: 'var(--r-md)',
  border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
  fontSize: 13,
  color: 'var(--text)',
  background: 'var(--white)',
  outline: 'none',
  fontFamily: 'var(--font)',
})

const labelStyle: CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6,
}

const disabledFieldStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 14px', borderRadius: 'var(--r-md)',
  border: '1px solid var(--border)', background: 'var(--bg)',
  fontSize: 13, color: 'var(--muted)',
}

export interface ProfileEditCardProps {
  currentUsername: string
  email: string
  createdAt: string
  usernameCheck: UsernameCheck
  onUsernameInput: (value: string) => void
  onSave: (username: string) => Promise<void>
}

export function ProfileEditCard({
  currentUsername,
  email,
  createdAt,
  usernameCheck,
  onUsernameInput,
  onSave,
}: ProfileEditCardProps) {
  const [value, setValue] = useState(currentUsername)
  const [saving, setSaving] = useState(false)

  const changed = value !== currentUsername
  const formatValid = USERNAME_RE.test(value)
  const canSave = changed && formatValid && usernameCheck.available === true && !saving

  function handleInput(next: string) {
    setValue(next)
    onUsernameInput(next)
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave(value)
    } finally {
      setSaving(false)
    }
  }

  // Right-hand adornment for the username field.
  function adornment() {
    if (!changed) return null
    if (usernameCheck.checking) return <Loader2 size={16} className="spin" color="var(--muted)" />
    if (!formatValid) return <X size={16} color="var(--red)" />
    if (usernameCheck.available === true) return <Check size={16} color="var(--green)" />
    if (usernameCheck.available === false) return <X size={16} color="var(--red)" />
    return null
  }

  return (
    <div
      style={{
        background: 'var(--white)', borderRadius: 22,
        boxShadow: 'var(--shadow-lg)', padding: 28,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Профиль</h2>

      {/* Username */}
      <div>
        <label htmlFor="profile-username" style={labelStyle}>Имя пользователя</label>
        <div style={{ position: 'relative' }}>
          <input
            id="profile-username"
            type="text"
            value={value}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="3-20 символов, латиница/цифры/_"
            style={{ ...fieldStyle(changed && formatValid), paddingRight: 40 }}
          />
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
            {adornment()}
          </span>
        </div>
        {changed && !formatValid && (
          <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
            3-20 символов: латиница, цифры, подчёркивание
          </p>
        )}
        {changed && formatValid && usernameCheck.available === false && (
          <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Имя уже занято</p>
        )}
      </div>

      {/* Email (read-only) */}
      <div>
        <span style={labelStyle}>Email</span>
        <div style={disabledFieldStyle}>
          <Lock size={14} />
          {email}
        </div>
      </div>

      {/* Registration date (read-only) */}
      <div>
        <span style={labelStyle}>Дата регистрации</span>
        <div style={disabledFieldStyle}>
          <Calendar size={14} />
          {formatDate(createdAt)}
        </div>
      </div>

      {/* Save */}
      <motion.button
        onClick={handleSave}
        disabled={!canSave}
        whileHover={canSave ? { scale: 1.02 } : undefined}
        whileTap={canSave ? { scale: 0.98 } : undefined}
        style={{
          marginTop: 4, padding: '11px 0', borderRadius: 'var(--r-pill)',
          background: canSave ? 'var(--accent)' : 'var(--soft)',
          color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)',
          border: 'none', cursor: canSave ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
        Сохранить
      </motion.button>
    </div>
  )
}
