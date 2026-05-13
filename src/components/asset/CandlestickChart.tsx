import { useEffect, useRef, useState } from 'react'
import { createChart, CrosshairMode, CandlestickSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { useOHLCV } from '../../hooks/useOHLCV'
import type { Timeframe } from '../../types/market.types'

interface Props {
  symbol: string
}

const TIMEFRAMES: Timeframe[] = ['1H', '4H', '1D', '1W']

export default function CandlestickChart({ symbol }: Props) {
  const [tf, setTf] = useState<Timeframe>('1D')
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const { data } = useOHLCV(symbol, tf, true)

  // create chart once per symbol
  useEffect(() => {
    if (!containerRef.current) return

    console.debug('[CandlestickChart] creating chart for', symbol)

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 360,
      layout: {
        background: { color: 'transparent' },
        textColor: '#888',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#ECEAE3' },
        horzLines: { color: '#ECEAE3' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#ECEAE3' },
      timeScale: { borderColor: '#ECEAE3', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    })

    chartRef.current = chart

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#E8264A',
      borderUpColor: '#22C55E',
      borderDownColor: '#E8264A',
      wickUpColor: '#22C55E',
      wickDownColor: '#E8264A',
    })
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      console.debug('[CandlestickChart] destroying chart for', symbol)
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [symbol])

  // update data when timeframe or data changes
  useEffect(() => {
    if (!seriesRef.current || !data.length) return

    console.debug('[CandlestickChart] setData, bars=', data.length, 'tf=', tf)

    const candles = data
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(p => ({
        time: Math.floor(p.timestamp / 1000) as Time,
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
      }))

    seriesRef.current.setData(candles)
    chartRef.current?.timeScale().fitContent()
  }, [data, tf])

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      {/* Timeframe selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {TIMEFRAMES.map(t => (
          <button
            key={t}
            onClick={() => {
              console.debug('[CandlestickChart] timeframe ->', t)
              setTf(t)
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: tf === t ? 'var(--ink)' : 'transparent',
              color: tf === t ? '#fff' : 'var(--muted)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  )
}
