import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
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
  STATUS_COLORS,
  formatTimeTick,
  seriesColor,
} from './chartTheme.ts';
import { hasAnyPoints, toChartRows } from './seriesData.ts';
import { durationAxisFormatter, formatMilliseconds } from '../lib/format.ts';
import type { AnnotatedSeries } from '../api/types.ts';

const LATENCY_SERIES = [
  { key: 'latency_avg_ms', label: 'average' },
  { key: 'latency_p95_ms', label: 'p95' },
  { key: 'latency_p99_ms', label: 'p99' },
] as const;

const LABELS: Record<string, string> = Object.fromEntries(
  LATENCY_SERIES.map((entry) => [entry.key, entry.label]),
);

const ANOMALY_SOURCE = 'latency_p95_ms';
const MAX_MARKERS = 40;

interface LatencyChartProps {
  series: AnnotatedSeries[];
  hint?: string;
}

export function LatencyChart({ series, hint }: LatencyChartProps) {
  const rows = toChartRows(series);
  const peak = Math.max(0, ...series.flatMap((entry) => entry.points.map((point) => point.value)));
  const tickFormatter = durationAxisFormatter(peak);

  const anomalies = (
    series.find((entry) => entry.metric === ANOMALY_SOURCE)?.anomalies ?? []
  ).slice(-MAX_MARKERS);

  return (
    <ChartFrame
      title="Latency"
      hint={
        anomalies.length === 0
          ? hint
          : `${hint ?? ''}${hint === undefined ? '' : ' · '}${anomalies.length} p95 outlier${
              anomalies.length === 1 ? '' : 's'
            } marked`
      }
      isEmpty={!hasAnyPoints(series)}
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
          <YAxis tick={AXIS_TICK} stroke={GRID_COLOR} width={56} tickFormatter={tickFormatter} />
          <Tooltip
            cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }}
            content={<ChartTooltip formatValue={formatMilliseconds} labels={LABELS} />}
          />
          <Legend
            iconType="plainline"
            iconSize={12}
            wrapperStyle={{ fontSize: 11, color: '#8b98a5', paddingTop: 4 }}
            formatter={(value: string) => LABELS[value] ?? value}
          />
          {anomalies.map((anomaly) => (
            <ReferenceDot
              key={anomaly.recordedAt}
              x={new Date(anomaly.recordedAt).getTime()}
              y={anomaly.value}
              r={5}
              fill={STATUS_COLORS.warning}
              stroke={CHART_SURFACE}
              strokeWidth={2}
              ifOverflow="extendDomain"
            />
          ))}
          {LATENCY_SERIES.map((entry, index) => (
            <Line
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              stroke={seriesColor(index)}
              strokeWidth={LINE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: ACTIVE_DOT_RADIUS, strokeWidth: 2, stroke: '#121820' }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
