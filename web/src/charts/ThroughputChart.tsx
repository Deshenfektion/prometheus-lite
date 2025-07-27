import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame } from './ChartFrame.tsx';
import { ChartTooltip } from './ChartTooltip.tsx';
import {
  ACTIVE_DOT_RADIUS,
  AREA_FILL_OPACITY,
  AXIS_TICK,
  CHART_MARGIN,
  CHART_SURFACE,
  GRID_COLOR,
  LINE_WIDTH,
  formatTimeTick,
  seriesColor,
} from './chartTheme.ts';
import { hasAnyPoints, toChartRows } from './seriesData.ts';
import { formatRate } from '../lib/format.ts';
import type { MetricSeries } from '../api/types.ts';

const LABELS = { throughput_rps: 'requests / second' };

interface ThroughputChartProps {
  series: MetricSeries[];
  hint?: string;
}

export function ThroughputChart({ series, hint }: ThroughputChartProps) {
  const rows = toChartRows(series);
  const color = seriesColor(0);

  return (
    <ChartFrame
      title="Throughput"
      hint={hint}
      isEmpty={!hasAnyPoints(series)}
      emptyMessage="This service does not report a request rate"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={CHART_MARGIN}>
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
            width={56}
            tickFormatter={(value: number) => formatRate(value)}
          />
          <Tooltip
            cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }}
            content={<ChartTooltip formatValue={formatRate} labels={LABELS} />}
          />
          <Area
            type="monotone"
            dataKey="throughput_rps"
            stroke={color}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={color}
            fillOpacity={AREA_FILL_OPACITY}
            dot={false}
            activeDot={{ r: ACTIVE_DOT_RADIUS, strokeWidth: 2, stroke: CHART_SURFACE }}
            connectNulls
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
