"use client";

import { useRegion } from "@/hooks/useRegion";
import { DEFAULT_REGION, SUPPORTED_REGIONS, regionLabel } from "@/lib/region";

export default function RegionPicker() {
  const { region, setRegion } = useRegion();

  // Include the resolved region even if it is outside the supported list, so a
  // viewer in, say, NL still sees where they are rather than a silent GB.
  const options = region && !SUPPORTED_REGIONS.includes(region)
    ? [region, ...SUPPORTED_REGIONS]
    : SUPPORTED_REGIONS;

  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">Region</span>
      <select
        value={region ?? DEFAULT_REGION}
        onChange={(e) => setRegion(e.target.value)}
        aria-label="Region"
        className="text-xs font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition cursor-pointer appearance-none"
      >
        {options.map((code) => (
          <option key={code} value={code} className="text-slate-900">
            🌍 {regionLabel(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
