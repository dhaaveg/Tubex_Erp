'use client';

import { useState, useEffect, useCallback } from 'react';

export interface LovItem {
  id: string;
  category: string;
  code: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
  is_system_default: boolean;
}

export function useLov(category: string, fallbackValues: readonly string[] = []) {
  const [items, setItems] = useState<LovItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLov = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/lov?category=${encodeURIComponent(category)}`);
      if (!res.ok) {
        throw new Error(`Failed to load ${category} options`);
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setItems(data);
        setError(null);
      } else {
        // Fallback to static values if no active items returned
        setItems(
          fallbackValues.map((val, idx) => ({
            id: `static-${idx}`,
            category,
            code: val.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
            label: val,
            value: val,
            sort_order: (idx + 1) * 10,
            is_active: true,
            is_system_default: true,
          }))
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Error fetching LOV');
      // Keep fallback values on network error
      setItems(
        fallbackValues.map((val, idx) => ({
          id: `static-${idx}`,
          category,
          code: val.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          label: val,
          value: val,
          sort_order: (idx + 1) * 10,
          is_active: true,
          is_system_default: true,
        }))
      );
    } finally {
      setIsLoading(false);
    }
  }, [category, fallbackValues]);

  useEffect(() => {
    fetchLov();
  }, [fetchLov]);

  const options: string[] =
    items.length > 0
      ? items.map((i) => i.value)
      : Array.from(fallbackValues);

  return { items, options, isLoading, error, reload: fetchLov };
}
