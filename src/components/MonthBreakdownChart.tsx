import { Account, ExpenseType } from '../types';
import { abbreviateAmount } from '../utils/formatting';

interface MonthBreakdownChartProps {
  expensesByType: { typeId: string; total: number }[];
  cashflowsByAccount: { accountId: string; total: number }[];
  expenseTypes: ExpenseType[];
  accounts: Account[];
}

const W = 600;
const H = 260;
const BASELINE = H / 2;

const PALETTE = [
  '#ef4444',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#3b82f6',
  '#84cc16',
  '#f97316',
  '#06b6d4',
  '#d946ef',
];

interface Bar {
  key: string;
  label: string;
  value: number; // positive internally
  kind: 'expense' | 'cashflow';
}

/**
 * Single-month chart: separate (not stacked) bars, one per expense category
 * and one per cashflow account, instead of the daily stacked view.
 */
export default function MonthBreakdownChart({
  expensesByType,
  cashflowsByAccount,
  expenseTypes,
  accounts,
}: MonthBreakdownChartProps) {
  const typeName = (id: string) =>
    expenseTypes.find((t) => t.id === id)?.name || 'Sconosciuto';
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name || 'Sconosciuto';

  const expenseBars: Bar[] = expensesByType
    .filter((e) => e.total !== 0)
    .map((e) => ({ key: `ex-${e.typeId}`, label: typeName(e.typeId), value: e.total, kind: 'expense' as const }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const cashflowBars: Bar[] = cashflowsByAccount
    .filter((c) => c.total !== 0)
    .map((c) => ({
      key: `cf-${c.accountId}`,
      label: accountName(c.accountId),
      value: c.total,
      kind: 'cashflow' as const,
    }));

  const expenseKeys = expenseBars.map((b) => b.key);
  const colorFor = (key: string) => PALETTE[expenseKeys.indexOf(key) % PALETTE.length];

  // Cashflow bars first (up/green), then expense bars (down/colored)
  const bars: Bar[] = [...cashflowBars, ...expenseBars];
  if (bars.length === 0) return null;

  const maxAbs = Math.max(1, ...bars.map((b) => Math.abs(b.value)));
  const slot = W / bars.length;
  const barW = Math.min(slot * 0.6, 40);
  const scale = (BASELINE - 20) / maxAbs;
  const showLabels = bars.length <= 12;

  return (
    <div className="chart-section">
      <div className="chart-legend">
        {cashflowBars.length > 0 && (
          <span className="legend-item">
            <span className="legend-dot cashflow" /> Entrate
          </span>
        )}
        {expenseBars.map((b) => (
          <span key={b.key} className="legend-item">
            <span className="legend-dot" style={{ background: colorFor(b.key) }} /> {b.label}
          </span>
        ))}
      </div>

      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Grafico riepilogo del mese per conto e categoria"
      >
        <line x1="0" y1={BASELINE} x2={W} y2={BASELINE} className="chart-baseline" />

        {bars.map((b, i) => {
          const cx = i * slot + slot / 2;
          const x = cx - barW / 2;
          const px = Math.max(Math.abs(b.value) * scale, 8);
          const isExpense = b.kind === 'expense';
          const up = !isExpense && b.value >= 0;
          const y = up ? BASELINE - px : BASELINE;

          return (
            <g key={b.key}>
              <rect
                className={isExpense ? 'chart-bar expense' : 'chart-bar cashflow'}
                x={x}
                y={y}
                width={barW}
                height={px}
                style={isExpense ? { fill: colorFor(b.key) } : undefined}
              >
                <title>{`${b.label}\n${isExpense ? 'Spese: -' : 'Entrate: '}${b.value.toFixed(2)}€`}</title>
              </rect>

              {showLabels && (
                <text
                  x={cx}
                  y={up ? BASELINE - px - 4 : BASELINE + px + 12}
                  textAnchor="middle"
                  className="chart-value"
                >
                  {`${isExpense ? '-' : b.value >= 0 ? '+' : ''}${abbreviateAmount(b.value)}`}
                </text>
              )}

              {showLabels && (
                <text x={cx} y={H - 6} textAnchor="middle" className="chart-label">
                  {b.label.length > 12 ? `${b.label.slice(0, 12)}…` : b.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
