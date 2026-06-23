import { useQuery } from '@tanstack/react-query'
import { getCoinId } from '../constants/coin-mapping'
import { USE_MOCK } from '../lib/env'

// Phase 3 миграция: useCoinInfo ходит в бэкенд /api/quotes/coin/{id} через vite-proxy
// (см. .ai-factory/plans/widgets-redis-cleanup.md, Task 3.2). Бэкенд применяет
// Redis-кеш (30 мин) и нормализует CoinGecko-payload к плоской форме, см.
// backend/app/services/coingecko.py::_normalize.

export interface CoinInfo {
  id: string
  symbol: string
  name: string
  description: string
  homepage: string | null
  github: string | null
  twitter: string | null
  genesisDate: string | null
  hashingAlgorithm: string | null
  marketCapRank: number | null
  ath: number | null
  athDate: string | null
  atl: number | null
  atlDate: string | null
  totalSupply: number | null
  circulatingSupply: number | null
  maxSupply: number | null
  // Поля, не использующиеся в UI сейчас, но присутствующие в payload — оставлены
  // на фронте пустыми, чтобы не терять потенциальные источники.
  currentPriceUsd?: number
  marketCapUsd?: number
  totalVolumeUsd?: number
  priceChangePercentage24h?: number
  image?: { large?: string; small?: string }
}

interface BackendCoinPayload {
  id: string
  symbol: string
  name: string
  description: string
  homepage: string | null
  github: string | null
  twitter: string | null
  genesis_date: string | null
  hashing_algorithm: string | null
  market_cap_rank: number | null
  ath: number | null
  ath_date: string | null
  atl: number | null
  atl_date: string | null
  total_supply: number | null
  circulating_supply: number | null
  max_supply: number | null
  current_price_usd: number
  market_cap_usd: number
  total_volume_usd: number
  price_change_percentage_24h: number
  image: { large: string | null; small: string | null }
  source: 'coingecko' | 'cache' | 'mock'
}

function _fromBackend(p: BackendCoinPayload): CoinInfo {
  return {
    id: p.id,
    symbol: p.symbol,
    name: p.name,
    description: p.description,
    homepage: p.homepage,
    github: p.github,
    twitter: p.twitter,
    genesisDate: p.genesis_date,
    hashingAlgorithm: p.hashing_algorithm,
    marketCapRank: p.market_cap_rank,
    ath: p.ath,
    athDate: p.ath_date,
    atl: p.atl,
    atlDate: p.atl_date,
    totalSupply: p.total_supply,
    circulatingSupply: p.circulating_supply,
    maxSupply: p.max_supply,
    currentPriceUsd: p.current_price_usd,
    marketCapUsd: p.market_cap_usd,
    totalVolumeUsd: p.total_volume_usd,
    priceChangePercentage24h: p.price_change_percentage_24h,
    image: { large: p.image.large ?? undefined, small: p.image.small ?? undefined },
  }
}

const MOCK_INFO: Record<string, Omit<CoinInfo, 'id'>> = {
  bitcoin: {
    symbol: 'btc',
    name: 'Bitcoin',
    description: 'Bitcoin — децентрализованная цифровая валюта.',
    homepage: 'https://bitcoin.org',
    github: 'https://github.com/bitcoin/bitcoin',
    twitter: 'https://twitter.com/bitcoin',
    genesisDate: '2009-01-03',
    hashingAlgorithm: 'SHA-256',
    marketCapRank: 1,
    ath: 73750,
    athDate: '2024-03-13T11:10:00.000Z',
    atl: 67.81,
    atlDate: '2013-07-06T00:00:00.000Z',
    totalSupply: 21000000,
    circulatingSupply: 19720000,
    maxSupply: 21000000,
  },
  ethereum: {
    symbol: 'eth',
    name: 'Ethereum',
    description: 'Ethereum — открытая блокчейн-платформа со смарт-контрактами.',
    homepage: 'https://www.ethereum.org',
    github: 'https://github.com/ethereum/go-ethereum',
    twitter: 'https://twitter.com/ethereum',
    genesisDate: '2015-07-30',
    hashingAlgorithm: 'Ethash',
    marketCapRank: 2,
    ath: 4878.26,
    athDate: '2021-11-10T14:24:00.000Z',
    atl: 0.43,
    atlDate: '2015-10-22T00:00:00.000Z',
    totalSupply: null,
    circulatingSupply: 120200000,
    maxSupply: null,
  },
}

interface UseCoinInfoResult {
  data: CoinInfo | null
  isLoading: boolean
  error: Error | null
  isUnsupported: boolean
}

async function fetchCoinInfo(coinId: string, useMock: boolean): Promise<CoinInfo> {
  if (useMock) {
    const mock = MOCK_INFO[coinId]
    if (!mock) throw new Error(`no mock for ${coinId}`)
    console.debug('[useCoinInfo] %s mock=true', coinId)
    return { id: coinId, ...mock }
  }
  const res = await fetch(`/api/quotes/coin/${encodeURIComponent(coinId)}`)
  if (!res.ok) throw new Error(`quotes/coin ${res.status}`)
  const json = (await res.json()) as BackendCoinPayload
  const result = _fromBackend(json)
  console.info('[useCoinInfo] loaded %s name=%s rank=%s source=%s', coinId, result.name, result.marketCapRank, json.source)
  return result
}

export function useCoinInfo(symbol: string, useMock = USE_MOCK): UseCoinInfoResult {
  const coinId = getCoinId(symbol)
  const isUnsupported = coinId === null

  console.debug('[useCoinInfo] symbol=%s coinId=%s unsupported=%s useMock=%s', symbol, coinId, isUnsupported, useMock)

  const { data, isLoading, error } = useQuery<CoinInfo, Error>({
    queryKey: ['coin-info', coinId, useMock],
    queryFn: () => fetchCoinInfo(coinId!, useMock),
    enabled: coinId !== null,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // [perf] возврат на страницу/виджет не должен заново дёргать CoinGecko: кэш
    // живёт 30мин (staleTime), refetchOnMount=false убирает лишний фетч при ремаунте.
    refetchOnMount: false,
    retry: 1,
  })

  return {
    data: data ?? null,
    isLoading: !isUnsupported && isLoading,
    error: error ?? null,
    isUnsupported,
  }
}
