/**
 * Mapping of asset symbol → CoinGecko coin id.
 * Used by useCoinInfo to query https://api.coingecko.com/api/v3/coins/{coinId}.
 * Only crypto assets are present here; stocks / forex / indices intentionally absent
 * (useCoinInfo treats them as "unsupported" and returns isUnsupported=true).
 */
export const SYMBOL_TO_COIN_ID: Record<string, string> = {
  'BTC-USDT': 'bitcoin',
  'ETH-USDT': 'ethereum',
  'SOL-USDT': 'solana',
  'XRP-USDT': 'ripple',
  'ADA-USDT': 'cardano',
  'DOGE-USDT': 'dogecoin',
  'DOT-USDT': 'polkadot',
  'AVAX-USDT': 'avalanche-2',
  'LINK-USDT': 'chainlink',
  'POL-USDT': 'polygon-ecosystem-token',
  'UNI-USDT': 'uniswap',
  'ATOM-USDT': 'cosmos',
  'LTC-USDT': 'litecoin',
  'APT-USDT': 'aptos',
  'ARB-USDT': 'arbitrum',
  'NEAR-USDT': 'near',
  'STX-USDT': 'blockstack',
  'S-USDT': 'sonic-3',
  'INJ-USDT': 'injective-protocol',
  'AAVE-USDT': 'aave',
}

export function getCoinId(symbol: string): string | null {
  return SYMBOL_TO_COIN_ID[symbol] ?? null
}
