"use client";
import { useState, useEffect } from "react";
import ResultsTable from "@/components/title/ResultsTable";
import type { TitleSource } from "@/types/title";
import { useRegion } from "@/hooks/useRegion";
import { DEFAULT_REGION, PRIORITY_REGIONS } from "@/lib/region";

interface WhereToWatchProps {
  allSources: Record<string, TitleSource[]>;
}

export default function WhereToWatch({ allSources }: WhereToWatchProps) {
  const { region: resolvedRegion, setRegion } = useRegion();
  const region = resolvedRegion ?? DEFAULT_REGION;
  const [countryNames, setCountryNames] = useState<Intl.DisplayNames | null>(null);

  useEffect(() => {
    setCountryNames(new Intl.DisplayNames(["en"], { type: "region" }));
  }, []);

  const availableRegions = Object.keys(allSources).sort((a, b) => {
    const pa = PRIORITY_REGIONS.indexOf(a);
    const pb = PRIORITY_REGIONS.indexOf(b);
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return a.localeCompare(b);
  });

  const TYPE_ORDER = ["free", "ads", "sub", "rent", "buy"];
  const sources = (allSources[region] ?? []).slice().sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a.type);
    const bi = TYPE_ORDER.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Always include the user's saved region in the dropdown even if it has no
  // providers for this title, so they can see it's unavailable and switch to another.
  const dropdownRegions = availableRegions.includes(region)
    ? availableRegions
    : [region, ...availableRegions];

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-3">Where to watch</h2>
      <div className="mb-3">
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded bg-slate-700 px-2 py-1 text-sm text-white"
        >
          {dropdownRegions.map((code) => (
            <option key={code} value={code}>
              {countryNames?.of(code) ?? code}
            </option>
          ))}
        </select>
      </div>
      {sources.length ? (
        <ResultsTable data={sources} />
      ) : (
        <p className="text-slate-300">
          No sources found for {countryNames?.of(region) ?? region}.
        </p>
      )}
    </div>
  );
}
