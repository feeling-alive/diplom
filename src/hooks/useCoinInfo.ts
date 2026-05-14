import { useQuery } from '@tanstack/react-query'
import { getCoinId } from '../constants/coin-mapping'

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
}

interface CoinGeckoResponse {
  id: string
  symbol: string
  name: string
  description: { en: string }
  links: {
    homepage: string[]
    repos_url: { github: string[] }
    twitter_screen_name: string | null
  }
  genesis_date: string | null
  hashing_algorithm: string | null
  market_cap_rank: number | null
  market_data: {
    ath: { usd: number }
    ath_date: { usd: string }
    atl: { usd: number }
    atl_date: { usd: string }
    total_supply: number | null
    circulating_supply: number | null
    max_supply: number | null
  }
}

interface UseCoinInfoResult {
  data: CoinInfo | null
  isLoading: boolean
  error: Error | null
  isUnsupported: boolean
}

async function fetchCoinInfo(coinId: string): Promise<CoinInfo> {
  console.debug('[useCoinInfo] fetching coinId=%s', coinId)
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const json = (await res.json()) as CoinGeckoResponse

  const result: CoinInfo = {
    id: json.id,
    symbol: json.symbol,
    name: json.name,
    description: json.description?.en ?? '',
    homepage: json.links?.homepage?.[0] || null,
    github: json.links?.repos_url?.github?.[0] || null,
    twitter: json.links?.twitter_screen_name
      ? `https://twitter.com/${json.links.twitter_screen_name}`
      : null,
    genesisDate: json.genesis_date,
    hashingAlgorithm: json.hashing_algorithm,
    marketCapRank: json.market_cap_rank,
    ath: json.market_data?.ath?.usd ?? null,
    athDate: json.market_data?.ath_date?.usd ?? null,
    atl: json.market_data?.atl?.usd ?? null,
    atlDate: json.market_data?.atl_date?.usd ?? null,
    totalSupply: json.market_data?.total_supply ?? null,
    circulatingSupply: json.market_data?.circulating_supply ?? null,
    maxSupply: json.market_data?.max_supply ?? null,
  }
  console.info('[useCoinInfo] loaded %s name=%s rank=%s', coinId, result.name, result.marketCapRank)
  return result
}

export function useCoinInfo(symbol: string): UseCoinInfoResult {
  const coinId = getCoinId(symbol)
  const isUnsupported = coinId === null

  console.debug('[useCoinInfo] symbol=%s coinId=%s unsupported=%s', symbol, coinId, isUnsupported)

  const { data, isLoading, error } = useQuery<CoinInfo, Error>({
    queryKey: ['coin-info', coinId],
    queryFn: () => fetchCoinInfo(coinId!),
    enabled: coinId !== null,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  })

  return {
    data: data ?? null,
    isLoading: !isUnsupported && isLoading,
    error: error ?? null,
    isUnsupported,
  }
}
