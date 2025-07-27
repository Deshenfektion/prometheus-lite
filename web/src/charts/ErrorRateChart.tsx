import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
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
  STATUS_COLORS,
  formatTimeTick,
} from './chartTheme.ts';
import { hasAnyPoints, toChartRows } from './seriesData.ts';
import { formatRatioAsPercent } from '../lib/format.ts';
import { DEFAULT_THRESHOLDS } from '../lib/status.ts';
import type { MetricSeries } from '../api/types.ts';

const LABELS = { error_rate: 'failed probes' };

interface ErrorRateChartProps {
  series: MetricSeries[];
  hint?: string;
}

export function ErrorRateChart({ series, hint }: ErrorRateChartProps) {
  const rows = toChartRows(series);

  return (
    <ChartFrame title="Error rate" hint={hint} isEmpty={!hasAnyPoints(series)}>
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
            domain={[0, 'auto']}
            tickFormatter={(value: number) => formatRatioAsPercent(value, 0)}
          />
          <ReferenceLine
            y={DEFAULT_THRESHOLDS.errorRateWarning}
            stroke={STATUS_COLORS.warning}
            strokeWidth={1}
            label={{
              value: 'warning',
              position: 'insideTopRight',
              fill: STATUS_COLORS.warning,
              fontSize: 10,
            }}
          />
          <Tooltip
            cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }}
            content={
              <ChartTooltip formatValue={(value) => formatRatioAsPercent(value)} labels={LABELS} />
            }
          />
          <Area
            type="monotone"
            dataKey="error_rate"
            stroke={STATUS_COLORS.critical}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={STATUS_COLORS.critical}
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
