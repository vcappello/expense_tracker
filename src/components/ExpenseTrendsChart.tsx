import { abbreviateAmount } from '../utils/formatting';
import { CategoryExpenseTrend, ExpenseTrends } from '../utils/expenseTrends';

interface ExpenseTrendsChartProps {
  data: ExpenseTrends;
}

const W = 720;
const H = 310;
const PAD = { top: 26, right: 18, bottom: 48, left: 52 };
const PALETTE = [
  '#ef4444',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#3b82f6',
  '#84cc16',
  '#f97316',
];
const OTHER_COLOR = '#64748b';

const formatPercent = (value: number): string =>
  `${value > 0 ? '+' : ''}${Math.round(value)}%`;

const formatAverage = (value: number): string => `${abbreviateAmount(value)}€`;

const CategoryTrendRow = ({
  category,
  direction,
}: {
  category: CategoryExpenseTrend;
  direction: 'up' | 'down';
}) => (
  <li className={`expense-trend-row ${direction}`}>
    <span className="expense-trend-category">{category.typeName}</span>
    <span className="expense-trend-values">
      {formatAverage(category.previousAverage)} → {formatAverage(category.recentAverage)}
    </span>
    <strong className="expense-trend-change">
      {category.isNew
        ? 'Nuova'
        : category.percentageChange === null
          ? '—'
          : formatPercent(category.percentageChange)}
    </strong>
  </li>
);

export default function ExpenseTrendsChart({ data }: ExpenseTrendsChartProps) {
  const categoryTotals = new Map<string, number>();
  data.months.forEach((month) => {
    Object.entries(month.expensesByType).forEach(([typeId, amount]) => {
      categoryTotals.set(typeId, (categoryTotals.get(typeId) || 0) + amount);
    });
  });
  const topCategoryIds = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([typeId]) => typeId);
  const hasOther = data.months.some((month) =>
    Object.keys(month.expensesByType).some((typeId) => !topCategoryIds.includes(typeId))
  );
  const maxTotal = Math.max(
    data.monthlyAverage,
    ...data.months.map((month) => month.total),
    1
  );
  const innerWidth = W - PAD.left - PAD.right;
  const innerHeight = H - PAD.top - PAD.bottom;
  const slot = innerWidth / data.months.length;
  const barWidth = Math.min(slot * 0.58, 28);
  const yFor = (value: number) => PAD.top + innerHeight - (value / (maxTotal * 1.15)) * innerHeight;
  const growing = data.categories
    .filter((category) => category.change > 0)
    .slice(0, 3);
  const declining = data.categories
    .filter((category) => category.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 3);

  const colorFor = (typeId: string) => {
    const index = topCategoryIds.indexOf(typeId);
    return index < 0 ? OTHER_COLOR : PALETTE[index % PALETTE.length];
  };

  return (
    <div className="expense-trends">
      <section className="chart-section expense-trends-chart">
        <div className="expense-trends-heading">
          <div>
            <h2>Spese mensili</h2>
            <p>Ultimi 12 mesi · media {formatAverage(data.monthlyAverage)} al mese</p>
          </div>
        </div>
        <div className="chart-legend">
          {topCategoryIds.map((typeId) => (
            <span key={typeId} className="legend-item">
              <span
                className="legend-dot"
                style={{ background: colorFor(typeId) }}
              />
              {data.categoryNames[typeId] || 'Categoria sconosciuta'}
            </span>
          ))}
          {hasOther && (
            <span className="legend-item">
              <span className="legend-dot" style={{ background: OTHER_COLOR }} />
              Altre categorie
            </span>
          )}
          <span className="legend-item">
            <span className="expense-trend-average-key" />
            Media mensile
          </span>
        </div>
        <svg
          className="chart-svg expense-trends-svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Spese mensili per categoria negli ultimi 12 mesi e media mensile"
        >
          {[0, 0.5, 1].map((tick) => {
            const value = maxTotal * tick;
            const y = yFor(value);
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={W - PAD.right}
                  y2={y}
                  className="chart-grid"
                />
                <text
                  x={PAD.left - 7}
                  y={y + 3}
                  textAnchor="end"
                  className="chart-label"
                >
                  {abbreviateAmount(value)}
                </text>
              </g>
            );
          })}

          {data.months.map((month, index) => {
            const xCenter = PAD.left + slot * (index + 0.5);
            let stacked = 0;
            const segments = [
              ...topCategoryIds.map((typeId) => ({
                typeId,
                amount: month.expensesByType[typeId] || 0,
              })),
              {
                typeId: '__other__',
                amount: Object.entries(month.expensesByType)
                  .filter(([typeId]) => !topCategoryIds.includes(typeId))
                  .reduce((sum, [, amount]) => sum + amount, 0),
              },
            ];
            return (
              <g key={month.key}>
                {segments.map(({ typeId, amount }) => {
                  if (amount <= 0) return null;
                  const segmentHeight = (amount / (maxTotal * 1.15)) * innerHeight;
                  const y = yFor(stacked + amount);
                  stacked += amount;
                  return (
                    <rect
                      key={typeId}
                      x={xCenter - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={segmentHeight}
                      rx={2}
                      style={{
                        fill: typeId === '__other__' ? OTHER_COLOR : colorFor(typeId),
                      }}
                    >
                      <title>
                        {`${month.label} · ${
                          typeId === '__other__'
                            ? 'Altre categorie'
                            : data.categoryNames[typeId] || 'Categoria sconosciuta'
                        }: ${formatAverage(amount)}`}
                      </title>
                    </rect>
                  );
                })}
                <text
                  x={xCenter}
                  y={H - 20}
                  textAnchor="middle"
                  className="chart-label"
                >
                  {month.label}
                </text>
                <title>{`${month.label}: ${formatAverage(month.total)}`}</title>
              </g>
            );
          })}

          <line
            x1={PAD.left}
            y1={yFor(data.monthlyAverage)}
            x2={W - PAD.right}
            y2={yFor(data.monthlyAverage)}
            className="expense-trend-average-line"
          />
        </svg>
      </section>

      <div className="expense-trends-comparisons">
        <section className="expense-trend-panel">
          <h2>In crescita</h2>
          <p>Media ultimi 3 mesi rispetto ai 3 precedenti</p>
          {growing.length === 0 ? (
            <div className="expense-trend-empty">Nessuna categoria in crescita</div>
          ) : (
            <ul>
              {growing.map((category) => (
                <CategoryTrendRow
                  key={category.typeId}
                  category={category}
                  direction="up"
                />
              ))}
            </ul>
          )}
        </section>
        <section className="expense-trend-panel">
          <h2>In calo</h2>
          <p>Media ultimi 3 mesi rispetto ai 3 precedenti</p>
          {declining.length === 0 ? (
            <div className="expense-trend-empty">Nessuna categoria in calo</div>
          ) : (
            <ul>
              {declining.map((category) => (
                <CategoryTrendRow
                  key={category.typeId}
                  category={category}
                  direction="down"
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
