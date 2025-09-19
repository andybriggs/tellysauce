interface TitleHeaderProps {
  title: string;
  /** Optional area to the right of the title (e.g., Save button) */
  actionSlot?: React.ReactNode;
}

export default function TitleHeader({ title, actionSlot }: TitleHeaderProps) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
        {title}
      </h1>
      {actionSlot ? <div>{actionSlot}</div> : null}
    </div>
  );
}
