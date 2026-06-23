import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'

// Избранные активы пользователя (символы) через бэкенд /favorites (модель Favorite,
// auth-cookie). Используется WatchlistPanel (показывает только избранное) и
// звёздочкой на странице актива.

async function fetchFavorites(): Promise<string[]> {
  const res = await fetch('/favorites')
  if (!res.ok) throw new Error(`favorites ${res.status}`)
  const json = (await res.json()) as { symbols: string[] }
  console.debug('[useFavorites] count=%d', json.symbols.length)
  return json.symbols
}

export function useFavorites() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery<string[]>({
    queryKey: ['favorites'],
    queryFn: fetchFavorites,
    enabled: !!user,
    staleTime: 60_000,
  })

  const symbols = query.data ?? []
  const favoriteSet = new Set(symbols)

  const toggle = useMutation({
    mutationFn: async (symbol: string): Promise<string[]> => {
      const isFav = favoriteSet.has(symbol.toUpperCase())
      console.debug('[useFavorites] toggle %s -> %s', symbol, isFav ? 'remove' : 'add')
      const res = isFav
        ? await fetch(`/favorites/${encodeURIComponent(symbol)}`, { method: 'DELETE' })
        : await fetch('/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol }),
          })
      if (!res.ok) throw new Error(`favorites toggle ${res.status}`)
      const json = (await res.json()) as { symbols: string[] }
      return json.symbols
    },
    onSuccess: (next) => {
      qc.setQueryData(['favorites'], next)
    },
  })

  return {
    symbols,
    isFavorite: (symbol: string) => favoriteSet.has(symbol.toUpperCase()),
    toggle: toggle.mutate,
    isLoading: query.isLoading,
    isLoggedIn: !!user,
  }
}
