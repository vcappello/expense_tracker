import { useState } from 'react';
import { abbreviateAmount } from '../utils/formatting';

export interface BalancePoint {
  key: string; // YYYY-MM-DD (sortable)
  label: string; // DD/MM/YYYY (display)
  balance: number; // cumulative balance at the end of the day
  delta: number; // day variation (cashflows − expenses)
}

interface BalanceTrendChartProps {
  data: BalancePoint[];
  openingBalance: number;
}

const W = 600;
const H = 240;
const PAD_L = 52; // room for the Y axis labels
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 24; // room for the X axis labels
const LINE_COLOR = '#3b82f6';
const MAX_X_LABELS = 6;
const MAX_DOTS = 31; // draw a visible dot per day only for short periods

/**
 * Balance trend: line chart of the daily cumulative balance.
 * X axis = one point per day of the period, Y axis = the account balance at the
 * end of that day, so the trend of the balance is visible at a glance.
 * Built with SVG to avoid external dependencies (like the other charts).
 */
export default function BalanceTrendChart({
  data,
  openingBalance,
}: BalanceTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const slot = innerW / data.length;

  const values = data.map((d) => d.balance);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const span = maxValue - minValue;
  // Padding around the values so the line never touches the chart edges;
  // for a perfectly flat line (span = 0) keep a small range.
  const padding = span > 0 ? span * 0.12 : Math.max(1, Math.abs(maxValue) * 0.1);
  const lo = minValue - padding;
  const hi = maxValue + padding;

  const xFor = (i: number) => PAD_L + slot / 2 + i * slot;
  const yFor = (v: number) => PAD_T + innerH - ((v - lo) / (hi - lo)) * innerH;

  const linePoints = data.map((d, i) => `${xFor(i)},${yFor(d.balance)}`).join(' ');
  const showDots = data.length <= MAX_DOTS;
  const labelStep = Math.max(1, Math.ceil(data.length / MAX_X_LABELS));
  const showZeroLine = minValue < 0 && maxValue > 0;
  const last = data[data.length - 1];
  const yTicks = [maxValue, (maxValue + minValue) / 2, minValue];

  /**
   * Nearest day under the pointer: the whole chart is the hit area, so the
   * tooltip works on touch too (drag along the line).
   */
  const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const index = Math.floor((x - PAD_L) / slot);
    setHoverIndex(Math.min(Math.max(index, 0), data.length - 1));
  };

  const hovered = hoverIndex === null ? null : data[hoverIndex];
  const hoveredLeft = hoverIndex === null ? 0 : (xFor(hoverIndex) / W) * 100;
  const tooltipSide =
    hoveredLeft < 18 ? ' left' : hoveredLeft > 82 ? ' right' : '';

  return (
    <div className="chart-section">
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: LINE_COLOR }} /> Saldo
        </span>
        <span className="legend-item trend-legend-muted">
          Inizio periodo: {abbreviateAmount(openingBalance)}€
        </span>
        <span className="legend-item trend-legend-muted">
          Ultimo saldo: {abbreviateAmount(last.balance)}€
        </span>
      </div>

      <div className="trend-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Grafico dell'andamento del saldo"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {yTicks.map((value, i) => (
            <g key={`y-${i}`}>
              <line
                x1={PAD_L}
                y1={yFor(value)}
                x2={W - PAD_R}
                y2={yFor(value)}
                className="chart-grid"
              />
              <text
                x={PAD_L - 6}
                y={yFor(value) + 3}
                textAnchor="end"
                className="chart-label"
              >
                {abbreviateAmount(value)}
              </text>
            </g>
          ))}

          {showZeroLine && (
            <line
              x1={PAD_L}
              y1={yFor(0)}
              x2={W - PAD_R}
              y2={yFor(0)}
              className="chart-baseline"
            />
          )}

          <polyline points={linePoints} className="trend-line" />

          {data.length === 1 && (
            <circle
              cx={xFor(0)}
              cy={yFor(data[0].balance)}
              r={3.5}
              className="trend-dot"
            />
          )}

          {showDots &&
            data.map((d, i) => (
              <circle
                key={d.key}
                cx={xFor(i)}
                cy={yFor(d.balance)}
                r={2.5}
                className="trend-dot"
              />
            ))}

          {hovered !== null && hoverIndex !== null && (
            <circle
              cx={xFor(hoverIndex)}
              cy={yFor(hovered.balance)}
              r={4.5}
              className="trend-dot-hover"
            />
          )}

          {data.map((d, i) =>
            i % labelStep === 0 || i === data.length - 1 ? (
              <text
                key={`x-${d.key}`}
                x={xFor(i)}
                y={H - 8}
                textAnchor="middle"
                className="chart-label"
              >
                {d.label.slice(0, 5)}
              </text>
            ) : null
          )}
        </svg>

        {hovered !== null && (
          <div
            className={`trend-tooltip${tooltipSide}`}
            style={{ left: `${hoveredLeft}%` }}
          >
            <div className="trend-tooltip-date">{hovered.label}</div>
            <div className="trend-tooltip-balance">
              Saldo: {abbreviateAmount(hovered.balance)}€
            </div>
            <div
              className={`trend-tooltip-delta ${hovered.delta >= 0 ? 'up' : 'down'}`}
            >
              {hovered.delta >= 0 ? '+' : '-'}
              {abbreviateAmount(Math.abs(hovered.delta))}€
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
