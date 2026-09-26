import { useState } from 'react';
import { abbreviateAmount } from '../utils/formatting';
import { BalancePoint } from '../utils/balanceTrend';

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

const todayKey = (): string => {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
};

const getMondayKey = (key: string): string => {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const formatShortDate = (key: string): string => {
  const [, month, day] = key.split('-');
  return `${day}/${month}`;
};

/**
 * Balance trend: solid line for recorded movements and a dashed line for the
 * balance projected with future-dated records and pending recurring movements.
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

  const hasForecast = data.some((point) => point.projectedBalance !== undefined);
  const today = todayKey();
  const realData = hasForecast ? data.filter((point) => point.key <= today) : data;
  const projectedData = data.filter((point) => point.projectedBalance !== undefined);
  const hasExpectedExpenses = data.some((point) =>
    point.scheduledMovements.some((movement) => movement.kind === 'expense')
  );
  const hasExpectedIncomes = data.some((point) =>
    point.scheduledMovements.some((movement) => movement.kind === 'income')
  );
  const indexByKey = new Map(data.map((point, index) => [point.key, index]));
  const values = data.flatMap((point) =>
    point.projectedBalance === undefined
      ? [point.balance]
      : [point.balance, point.projectedBalance]
  );
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

  const realLinePoints = realData
    .map((point) => `${xFor(indexByKey.get(point.key) ?? 0)},${yFor(point.balance)}`)
    .join(' ');
  const projectedLinePoints = projectedData
    .map(
      (point) =>
        `${xFor(indexByKey.get(point.key) ?? 0)},${yFor(
          point.projectedBalance ?? point.balance
        )}`
    )
    .join(' ');
  const showDots = realData.length <= MAX_DOTS;
  const labelStep = Math.max(1, Math.ceil(data.length / MAX_X_LABELS));
  const showZeroLine = minValue < 0 && maxValue > 0;
  const lastReal = realData[realData.length - 1];
  const lastProjected = projectedData[projectedData.length - 1];
  const yTicks = [maxValue, (maxValue + minValue) / 2, minValue];
  const weeklyLabelIndexes = data.reduce<number[]>((indexes, point, index) => {
    if (index === 0 || getMondayKey(point.key) !== getMondayKey(data[index - 1].key)) {
      indexes.push(index);
    }
    return indexes;
  }, []);
  const weeklyLabelStep = Math.max(1, Math.ceil(weeklyLabelIndexes.length / MAX_X_LABELS));

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
          <span className="legend-dot" style={{ background: LINE_COLOR }} /> Saldo reale
        </span>
        {hasForecast && (
          <span className="legend-item">
            <span className="trend-legend-line" /> Saldo previsto
          </span>
        )}
        {hasExpectedExpenses && (
          <span className="legend-item">
            <span className="trend-scheduled-legend expense" /> Spesa prevista
          </span>
        )}
        {hasExpectedIncomes && (
          <span className="legend-item">
            <span className="trend-scheduled-legend income" /> Entrata prevista
          </span>
        )}
        <span className="legend-item trend-legend-muted">
          Inizio periodo: {abbreviateAmount(openingBalance)}€
        </span>
        {lastReal && (
          <span className="legend-item trend-legend-muted">
            Saldo reale: {abbreviateAmount(lastReal.balance)}€
          </span>
        )}
        {lastProjected && (
          <span className="legend-item trend-legend-muted">
            Saldo previsto: {abbreviateAmount(lastProjected.projectedBalance ?? 0)}€
          </span>
        )}
      </div>

      <div className="trend-wrap">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Grafico dell'andamento reale e previsto del saldo"
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

          {realData.length > 1 && (
            <polyline points={realLinePoints} className="trend-line" />
          )}

          {hasForecast && projectedData.length > 1 && (
            <polyline points={projectedLinePoints} className="trend-projected-line" />
          )}

          {realData.length === 1 && (
            <circle
              cx={xFor(indexByKey.get(realData[0].key) ?? 0)}
              cy={yFor(realData[0].balance)}
              r={3.5}
              className="trend-dot"
            />
          )}

          {showDots &&
            realData.map((point) => (
              <circle
                key={point.key}
                cx={xFor(indexByKey.get(point.key) ?? 0)}
                cy={yFor(point.balance)}
                r={2.5}
                className="trend-dot"
              />
            ))}

          {data.flatMap((point, index) =>
            point.scheduledMovements.map((movement, movementIndex) => (
              <circle
                key={`${point.key}-${movement.id}`}
                cx={xFor(index)}
                cy={
                  yFor(point.projectedBalance ?? point.balance) +
                  (movementIndex % 2 === 0 ? -5 : 5)
                }
                r={4}
                className={`trend-scheduled-marker ${movement.kind}`}
              />
            ))
          )}

          {hovered !== null && hoverIndex !== null && (
            <circle
              cx={xFor(hoverIndex)}
              cy={yFor(
                hovered.projectedBalance !== undefined
                  ? hovered.projectedBalance
                  : hovered.balance
              )}
              r={4.5}
              className={
                hovered.projectedBalance !== undefined
                  ? 'trend-dot-hover projected'
                  : 'trend-dot-hover'
              }
            />
          )}

          {data.map((d, i) =>
            i % labelStep === 0 || i === data.length - 1 ? (
              <text
                key={`x-${d.key}`}
                x={xFor(i)}
                y={H - 8}
                textAnchor="middle"
                className="chart-label trend-label-daily"
              >
                {d.label.slice(0, 5)}
              </text>
            ) : null
          )}

          {weeklyLabelIndexes.map((index, weeklyIndex) => {
            if (
              weeklyIndex % weeklyLabelStep !== 0 &&
              weeklyIndex !== weeklyLabelIndexes.length - 1
            ) {
              return null;
            }
            const point = data[index];
            return (
              <text
                key={`x-week-${point.key}`}
                x={xFor(index)}
                y={H - 8}
                textAnchor="middle"
                className="chart-label trend-label-weekly"
              >
                {formatShortDate(getMondayKey(point.key))}
              </text>
            );
          })}
        </svg>

        {hovered !== null && (
          <div
            className={`trend-tooltip${tooltipSide}`}
            style={{ left: `${hoveredLeft}%` }}
          >
            <div className="trend-tooltip-date">{hovered.label}</div>
            {hovered.projectedBalance === undefined ? (
              <>
                <div className="trend-tooltip-balance">
                  Saldo reale: {abbreviateAmount(hovered.balance)}€
                </div>
                <div
                  className={`trend-tooltip-delta ${hovered.delta >= 0 ? 'up' : 'down'}`}
                >
                  Variazione reale: {hovered.delta >= 0 ? '+' : '-'}
                  {abbreviateAmount(Math.abs(hovered.delta))}€
                </div>
              </>
            ) : (
              <>
                <div className="trend-tooltip-balance">
                  Saldo reale: {abbreviateAmount(hovered.balance)}€
                </div>
                <div className="trend-tooltip-balance">
                  Saldo previsto: {abbreviateAmount(hovered.projectedBalance)}€
                </div>
                <div
                  className={`trend-tooltip-delta ${
                    (hovered.projectedDelta ?? 0) >= 0 ? 'up' : 'down'
                  }`}
                >
                  Variazione prevista:{' '}
                  {(hovered.projectedDelta ?? 0) >= 0 ? '+' : '-'}
                  {abbreviateAmount(Math.abs(hovered.projectedDelta ?? 0))}€
                </div>
                {hovered.scheduledMovements.map((movement) => (
                  <div
                    key={movement.id}
                    className={`trend-tooltip-movement ${movement.kind}`}
                  >
                    {movement.kind === 'expense' ? 'Spesa' : 'Entrata'} prevista:{' '}
                    {movement.kind === 'expense' ? '−' : '+'}
                    {abbreviateAmount(movement.amount)}€ · {movement.name}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
