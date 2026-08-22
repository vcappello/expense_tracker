import { ExpenseType } from '../types';
import { abbreviateAmount } from '../utils/formatting';

export interface DailyTotal {
  key: string; // YYYY-MM-DD (sortable)
  label: string; // DD/MM/YYYY (display)
  cashflow: number; // signed
  expensesByType: Record<string, number>; // expenseTypeId -> positive amount
}

interface MovementsChartProps {
  data: DailyTotal[];
  expenseTypes: ExpenseType[];
}

const W = 600;
const H = 240;
const BASELINE = H / 2;
const MIN_BAR = 12; // minimum bar height so small values stay visible

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

/**
 * Diverging bar chart of daily movements:
 * cashflows (green) above the baseline, expenses (stacked by category) below it.
 * Built with SVG to avoid external dependencies.
 */
export default function MovementsChart({ data, expenseTypes }: MovementsChartProps) {
  if (data.length === 0) return null;

  const typeNames: Record<string, string> = {};
  expenseTypes.forEach((t) => {
    typeNames[t.id] = t.name;
  });

  // Distinct categories present in the data, sorted by name for a stable order
  const typeIds = [...new Set(data.flatMap((d) => Object.keys(d.expensesByType)))].sort(
    (a, b) => (typeNames[a] || a).localeCompare(typeNames[b] || b)
  );
  const colorFor = (id: string) => PALETTE[typeIds.indexOf(id) % PALETTE.length];

  const maxExpense = Math.max(
    1,
    ...data.map((d) => Object.values(d.expensesByType).reduce((s, v) => s + v, 0))
  );
  const maxCashflow = Math.max(1, ...data.map((d) => Math.abs(d.cashflow)));
  const maxAbs = Math.max(maxExpense, maxCashflow);
  const slot = W / data.length;
  const barW = Math.min(slot * 0.5, 22);
  const scale = (BASELINE - 10) / maxAbs;

  return (
    <div className="chart-section">
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot cashflow" /> Entrate
        </span>
        {typeIds.map((id) => (
          <span key={id} className="legend-item">
            <span className="legend-dot" style={{ background: colorFor(id) }} />{' '}
            {typeNames[id] || id}
          </span>
        ))}
      </div>

      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Grafico movimenti per data"
      >
        <line x1="0" y1={BASELINE} x2={W} y2={BASELINE} className="chart-baseline" />

        {data.map((d, i) => {
          const cx = i * slot + slot / 2;
          const x = cx - barW / 2;
          const ch =
            d.cashflow !== 0 ? Math.max(Math.abs(d.cashflow) * scale, MIN_BAR) : 0;
          const totalExpense = Object.values(d.expensesByType).reduce((s, v) => s + v, 0);
          const totalExpensePx = totalExpense * scale;
          let offsetY = BASELINE;

          return (
            <g key={d.key}>
              {d.cashflow !== 0 && (
                <rect
                  className="chart-bar cashflow"
                  x={x}
                  y={d.cashflow >= 0 ? BASELINE - ch : BASELINE}
                  width={barW}
                  height={ch}
                >
                  <title>{`${d.label}\nEntrate: ${d.cashflow >= 0 ? '+' : ''}${d.cashflow.toFixed(2)}€`}</title>
                </rect>
              )}

              {typeIds.map((id) => {
                const amt = d.expensesByType[id] || 0;
                if (amt === 0) return null;
                const h = Math.max(amt * scale, MIN_BAR);
                const segment = (
                  <rect
                    key={id}
                    className="chart-bar expense"
                    x={x}
                    y={offsetY}
                    width={barW}
                    height={h}
                    style={{ fill: colorFor(id) }}
                  >
                    <title>{`${d.label}\n${typeNames[id] || id}: -${amt.toFixed(2)}€`}</title>
                  </rect>
                );
                offsetY += h;
                return segment;
              })}

              {data.length <= 15 && d.cashflow !== 0 && (
                <text
                  x={cx}
                  y={d.cashflow >= 0 ? BASELINE - ch - 4 : BASELINE + ch + 12}
                  textAnchor="middle"
                  className="chart-value"
                >
                  {`${d.cashflow >= 0 ? '+' : ''}${abbreviateAmount(d.cashflow)}`}
                </text>
              )}

              {data.length <= 15 && totalExpense > 0 && (
                <text
                  x={cx}
                  y={BASELINE + totalExpensePx + 12}
                  textAnchor="middle"
                  className="chart-value"
                >
                  {abbreviateAmount(-totalExpense)}
                </text>
              )}

              {data.length <= 15 && (
                <text x={cx} y={H - 6} textAnchor="middle" className="chart-label">
                  {d.label.slice(0, 5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

