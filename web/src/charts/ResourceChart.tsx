import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame } from './ChartFrame.tsx';
import { ChartTooltip } from './ChartTooltip.tsx';
import {
  ACTIVE_DOT_RADIUS,
  AXIS_TICK,
  CHART_MARGIN,
  CHART_SURFACE,
  GRID_COLOR,
  LINE_WIDTH,
  formatTimeTick,
  seriesColor,
} from './chartTheme.ts';
import { hasAnyPoints, toChartRows } from './seriesData.ts';
import { formatPercent } from '../lib/format.ts';
import type { MetricSeries } from '../api/types.ts';

const RESOURCE_SERIES = [
  { key: 'cpu_percent', label: 'CPU' },
  { key: 'memory_percent', label: 'memory' },
] as const;

const LABELS: Record<string, string> = Object.fromEntries(
  RESOURCE_SERIES.map((entry) => [entry.key, entry.label]),
);

interface ResourceChartProps {
  series: MetricSeries[];
  hint?: string;
}

export function ResourceChart({ series, hint }: ResourceChartProps) {
  const rows = toChartRows(series);

  return (
    <ChartFrame
      title="CPU and memory"
      hint={hint}
      isEmpty={!hasAnyPoints(series)}
      emptyMessage="This service does not report resource usage"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={CHART_MARGIN}>
          <CartesianGrid stroke={GRID_COLOR} strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTimeTick}
            tick={AXIS_TICK}
            stroke={GRID_COLOR}
            minTickGap={40}
          />
          <YAxis
            tick={AXIS_TICK}
            stroke={GRID_COLOR}
            width={48}
            domain={[0, 100]}
            tickFormatter={(value: number) => formatPercent(value, 0)}
          />
          <Tooltip
            cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }}
            content={<ChartTooltip formatValue={(value) => formatPercent(value)} labels={LABELS} />}
          />
          <Legend
            iconType="plainline"
            iconSize={12}
            wrapperStyle={{ fontSize: 11, color: '#8b98a5', paddingTop: 4 }}
            formatter={(value: string) => LABELS[value] ?? value}
          />
          {RESOURCE_SERIES.map((entry, index) => (
            <Line
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              stroke={seriesColor(index)}
              strokeWidth={LINE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: ACTIVE_DOT_RADIUS, strokeWidth: 2, stroke: CHART_SURFACE }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
