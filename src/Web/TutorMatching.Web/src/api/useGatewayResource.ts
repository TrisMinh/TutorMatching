import {useCallback, useEffect, useRef, useState} from 'react';

export function useGatewayResource<T>(loader: () => Promise<T>, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const result = await loader();
      if (request !== generation.current) return;
      setData(result); setError(undefined);
    } catch (reason) {if (request === generation.current) setError(reason);}
    finally {if (request === generation.current) setLoading(false);}
  }, [loader]);
  useEffect(() => {void reload();return () => {generation.current++;};}, [reload]);
  return {data, loading, error, reload, setData};
}
