import { cn } from "@/lib/cn";
import { firstWeekdayOfMonth, monthDays, monthTitle, todayISO, weekdayHeaders } from "@/lib/money";

export function DueDayPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (day: number) => void;
}) {
  const month = todayISO().slice(0, 7);
  const days = monthDays(month);
  const pad = firstWeekdayOfMonth(month);
  const cells: (string | null)[] = [...Array(pad).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const selected = Math.min(31, Math.max(1, value || 10));

  return (
    <div>
      <p className="text-sm text-muted">
        {monthTitle(month)} · dia escolhido: <span className="font-medium text-fg tabular">{selected}</span>
      </p>
      <p className="mt-1 text-xs text-muted">Toque no dia do mês em que o aluno prefere pagar. Vale para todos os meses.</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {weekdayHeaders().map((w, i) => (
          <span key={`${w}-${i}`} className="py-1">
            {w}
          </span>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <span key={`e-${i}`} />;
          const day = Number(iso.slice(8));
          const on = day === selected;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(day)}
              className={cn(
                "min-h-11 rounded-sm text-sm tabular",
                on ? "bg-accent font-semibold text-accent-fg" : "bg-bg text-fg hover:bg-surface-2",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
