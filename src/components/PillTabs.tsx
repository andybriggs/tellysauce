import * as React from "react";

type PillOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export function PillTabs<T extends string>({
  value,
  options,
  onChange,
  className = "",
}: {
  value: T;
  options: PillOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Options"
      className={[
        "inline-flex items-center rounded-full bg-white/10 p-1",
        className,
      ].join(" ")}
    >
      {options.map((opt) => {
        const active = opt.value === value;

        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={[
              "relative rounded-full px-3 py-1.5 text-sm font-bold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600",
              opt.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              active
                ? "bg-gradient-to-r from-pink-500 to-orange-400 text-white"
                : "text-white/60 hover:text-white",
            ].join(" ")}
            type="button"
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
