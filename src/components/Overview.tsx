interface OverviewProps {
  text?: string | null;
}

export default function Overview({ text }: OverviewProps) {
  if (!text) return null;
  return (
    <p className="max-w-prose text-base leading-relaxed text-slate-200/95">
      {text}
    </p>
  );
}
