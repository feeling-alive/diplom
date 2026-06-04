// Shared subscription card used by both ProfilePage (right column) and the
// standalone SubscriptionPage. Light design system + framer-motion, no MUI, no
// emoji, prices in ₽. Renders three states: empty (status === null), free (with
// a Free/Premium segmented toggle) and premium (achievement style).

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Crown, Loader2, Lock, X } from 'lucide-react'
import type { SubscriptionStatus } from '../../lib/profileApi'

const PREMIUM_PRICE = '990₽'
const PREMIUM_OLD_PRICE = '1499₽'
const PREMIUM_TOTAL_DAYS = 30

const RU_MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

function formatRuDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`
}

function daysLeft(iso: string | null): number {
  if (!iso) return 0
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

interface FeatureRow {
  label: string
  on: boolean
}

function freeFeatures(perDay: number): FeatureRow[] {
  return [
    { label: 'Мониторинг рынков', on: true },
    { label: 'Базовые графики', on: true },
    { label: `${perDay} запросов к ИИ в день`, on: true },
    { label: '2 дашборда', on: true },
  ]
}

const PREMIUM_FEATURES: FeatureRow[] = [
  { label: 'Безлимитный ИИ', on: true },
  { label: 'Значок Premium в профиле', on: true },
  { label: 'До 5 кастомных дашбордов (у Free — только 2)', on: true },
  { label: 'Безлимитные запросы к ИИ', on: true },
]

// Features that exist only in Premium — shown as locked in the Free tab
const PREMIUM_ONLY_LABELS = [
  'Безлимитный ИИ',
  'Значок Premium в профиле',
  'До 5 дашбордов',
]

function FeatureList({ items }: { items: FeatureRow[] }) {
  return (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '4px 0 0' }}>
      {items.map((f) => (
        <li
          key={f.label}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12,
            color: f.on ? 'var(--text)' : 'var(--soft)',
          }}
        >
          {f.on ? (
            <Check size={14} color="var(--green)" />
          ) : (
            <X size={14} color="var(--soft)" />
          )}
          {f.label}
        </li>
      ))}
    </ul>
  )
}

function LockedFeatureList({ items }: { items: string[] }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px',
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap', letterSpacing: 0.5 }}>
          ТОЛЬКО В PREMIUM
        </span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0 }}>
        {items.map((label) => (
          <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5, fontSize: 12, color: 'var(--text)' }}>
            <Lock size={12} color="var(--muted)" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          height: 6, borderRadius: 'var(--r-pill)',
          background: 'var(--border)', overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ height: '100%', background: 'var(--accent)', borderRadius: 'var(--r-pill)' }}
        />
      </div>
    </div>
  )
}

export interface SubscriptionCardProps {
  status: SubscriptionStatus | null
  onUpgrade: () => void
  onCancel: () => void
  busy?: boolean
}

export function SubscriptionCard({ status, onUpgrade, onCancel, busy = false }: SubscriptionCardProps) {
  const [tab, setTab] = useState<'free' | 'premium'>('premium')

  if (!status) {
    return (
      <div style={{ fontSize: 13, color: 'var(--muted)', padding: 8 }}>
        Нет данных о подписке
      </div>
    )
  }

  // --- Premium (achievement) ---
  if (status.plan === 'premium') {
    const left = daysLeft(status.expires_at)
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #FFD25A, #F5A623)',
              boxShadow: '0 0 0 6px rgba(245, 166, 35, 0.15), 0 8px 24px -6px rgba(245, 166, 35, 0.6)',
              color: '#fff',
            }}
          >
            <Crown size={26} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>Premium активен</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Действует до {formatRuDate(status.expires_at)}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
            Осталось {left} из {PREMIUM_TOTAL_DAYS} дней
          </div>
          <ProgressBar value={left} max={PREMIUM_TOTAL_DAYS} />
        </div>

        <FeatureList items={PREMIUM_FEATURES} />

        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            alignSelf: 'center', marginTop: 4,
            fontSize: 12, color: 'var(--muted)',
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: busy ? 'default' : 'pointer',
            fontFamily: 'var(--font)',
          }}
        >
          {busy && <Loader2 size={13} className="spin" />}
          Отменить подписку
        </button>
      </motion.div>
    )
  }

  // --- Free (segmented toggle) ---
  const perDay = status.features.ai_requests_per_day
  const usedToday = status.features.ai_requests_used_today

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Segmented control */}
      <div
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
          background: 'var(--bg)', borderRadius: 'var(--r-pill)', padding: 4,
        }}
      >
        {(['free', 'premium'] as const).map((id) => {
          const active = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '7px 0', borderRadius: 'var(--r-pill)',
                fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
                color: active ? '#fff' : 'var(--muted)',
                background: active ? 'var(--accent)' : 'transparent',
                transition: 'background 0.2s, color 0.2s',
                cursor: 'pointer',
              }}
            >
              {id === 'free' ? 'Free' : 'Premium'}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'free' ? (
          <motion.div
            key="free"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <FeatureList items={freeFeatures(perDay)} />
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                Использовано {usedToday} из {perDay} сегодня
              </div>
              <ProgressBar value={usedToday} max={perDay} />
            </div>
            <LockedFeatureList items={PREMIUM_ONLY_LABELS} />
            <div
              style={{
                textAlign: 'center', padding: '10px 0', borderRadius: 'var(--r-pill)',
                background: 'var(--bg)', color: 'var(--green)',
                border: '1px solid var(--green)', fontSize: 13, fontWeight: 600,
              }}
            >
              Текущий план
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="premium"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <FeatureList items={PREMIUM_FEATURES} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>
                {PREMIUM_PRICE}
              </span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>/ месяц</span>
              <span
                style={{
                  fontSize: 13, color: 'var(--soft)',
                  textDecoration: 'line-through', marginLeft: 'auto',
                }}
              >
                {PREMIUM_OLD_PRICE}
              </span>
            </div>
            <motion.button
              className="sub-shimmer"
              onClick={onUpgrade}
              disabled={busy}
              whileHover={busy ? undefined : { scale: 1.02 }}
              whileTap={busy ? undefined : { scale: 0.98 }}
              style={{
                padding: '12px 0', borderRadius: 'var(--r-pill)',
                fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)',
                border: 'none', cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {busy && <Loader2 size={15} className="spin" />}
              Перейти на Premium
            </motion.button>
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>
              Демо-режим: активация бесплатна
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
