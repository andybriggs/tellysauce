"use client";

import type { ReactNode } from "react";
import { RegionContext, useRegionState } from "@/hooks/useRegion";

export default function RegionProvider({ children }: { children: ReactNode }) {
  const value = useRegionState();
  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}
