import { useEffect, useState } from 'react'

// Delays a value until it's stopped changing for `delayMs` — used on
// free-text filter inputs so every keystroke doesn't fire a new query (which,
// with no request cancellation, briefly re-renders unfiltered/partial-match
// results while the user is still typing).
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
