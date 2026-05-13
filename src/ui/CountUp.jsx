// Анимация чисел от 0 до целевого значения
import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

export default function CountUp({ to, prefix = '', suffix = '', decimals = 0, duration = 1.4, format }) {
  const ref = useRef(null)
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, latest => {
    if (format) return format(latest)
    return prefix + Number(latest).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + suffix
  })
  const [text, setText] = useState(format ? format(0) : `${prefix}0${suffix}`)

  useEffect(() => {
    const controls = animate(mv, to, { duration, ease: [0.25, 0.1, 0.25, 1] })
    const unsub = rounded.on('change', v => setText(v))
    return () => { controls.stop(); unsub() }
  }, [to])

  return <span ref={ref}>{text}</span>
}
