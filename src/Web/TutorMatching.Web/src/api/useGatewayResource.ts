import { useCallback, useEffect, useState } from 'react';

export function useGatewayResource<T>(loader: () => Promise<T>, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loader());
      setError(undefined);
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => { void reload(); }, [reload]);

  return { data, loading, error, reload, setData };
}
