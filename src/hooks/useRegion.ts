"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DEFAULT_REGION, detectRegion, storeRegion } from "@/lib/region";

export type RegionContextValue = {
  /** null until the client has read localStorage — consumers must not fetch yet. */
  region: string | null;
  setRegion: (code: string) => void;
};

// Default mirrors BadgeContext's no-op convention so components rendered
// outside the provider (in isolation, in tests) still work — they just get
// the default region and cannot change it.
export const RegionContext = createContext<RegionContextValue>({
  region: DEFAULT_REGION,
  setRegion: () => {},
});

export function useRegion(): RegionContextValue {
  return useContext(RegionContext);
}

/**
 * Backing state for RegionProvider. Starts null so the server render and the
 * first client render agree; the real value lands on mount.
 */
export function useRegionState(): RegionContextValue {
  const [region, setRegionState] = useState<string | null>(null);

  useEffect(() => {
    setRegionState(detectRegion());
  }, []);

  const setRegion = useCallback((code: string) => {
    setRegionState(code);
    storeRegion(code);
  }, []);

  return { region, setRegion };
}
