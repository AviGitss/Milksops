"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";

/* Validated categorical slots (light mode) from the reference palette */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
export const STATUS = {
  good: "#1baf7a",
  warning: "#eda100",
  critical: "#e34948",
  neutral: "#7b5fc4",
};

const axis = {
  stroke: "#b9b2cf",
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: "#e6e0f5" },
};

const tooltipStyle = {
  contentStyle: {
    border: "1px solid #e6e0f5",
    borderRadius: 10,
    fontSize: 12,
    boxShadow: "0 6px 20px rgba(45,27,105,.10)",
  },
  labelStyle: { color: "#6b6486", fontSize: 11, marginBottom: 4 },
};

/** Run chart of individual checkweigher readings against spec limits. */
export function FillRunChart({
  data,
  target,
  lsl,
  usl,
}: {
  data: { t: string; w: number }[];
  target: number;
  lsl: number;
  usl: number;
}) {
  const pad = Math.max(usl - target, target - lsl) * 2.2;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="#f0ecfa" vertical={false} />
        <ReferenceArea
          y1={lsl}
          y2={usl}
          fill="#1baf7a"
          fillOpacity={0.06}
          ifOverflow="extendDomain"
        />
        <XAxis dataKey="t" {...axis} minTickGap={40} />
        <YAxis
          {...axis}
          domain={[target - pad, target + pad]}
          tickFormatter={(v) => Number(v).toFixed(0)}
          width={48}
          unit="g"
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: unknown) => [`${Number(v as number).toFixed(2)} g`, "Net weight"]}
        />
        <ReferenceLine
          y={usl}
          stroke={STATUS.critical}
          strokeDasharray="5 4"
          label={{ value: "USL", position: "right", fontSize: 10, fill: STATUS.critical }}
        />
        <ReferenceLine
          y={lsl}
          stroke={STATUS.critical}
          strokeDasharray="5 4"
          label={{ value: "LSL", position: "right", fontSize: 10, fill: STATUS.critical }}
        />
        <ReferenceLine y={target} stroke="#7b5fc4" strokeDasharray="2 4" />
        <Line
          type="monotone"
          dataKey="w"
          stroke={SERIES[0]}
          strokeWidth={2}
          dot={{ r: 2.5, strokeWidth: 0, fill: SERIES[0] }}
          activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Bias per filler head — status-coloured, so the offending head is obvious. */
export function HeadBiasChart({
  data,
  tol,
}: {
  data: { head: string; bias: number }[];
  tol: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="#f0ecfa" vertical={false} />
        <XAxis dataKey="head" {...axis} />
        <YAxis {...axis} width={48} unit="g" />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: unknown) => [`${Number(v as number).toFixed(2)} g`, "Mean deviation"]}
        />
        <ReferenceLine y={0} stroke="#b9b2cf" />
        <ReferenceLine y={-tol} stroke={STATUS.critical} strokeDasharray="4 4" />
        <ReferenceLine y={tol} stroke={STATUS.critical} strokeDasharray="4 4" />
        <Bar dataKey="bias" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                Math.abs(d.bias) > tol
                  ? STATUS.critical
                  : Math.abs(d.bias) > tol * 0.6
                    ? STATUS.warning
                    : SERIES[0]
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Generic single-series horizontal-ish bar. */
export function SimpleBar({
  data,
  xKey,
  yKey,
  unit,
  color = SERIES[0],
  height = 260,
  label,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  unit?: string;
  color?: string;
  height?: number;
  label: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="#f0ecfa" vertical={false} />
        <XAxis dataKey={xKey} {...axis} interval={0} angle={0} />
        <YAxis {...axis} width={52} unit={unit} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: unknown) => [Number(v as number).toLocaleString("en-IN"), label]}
        />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Carton flow: used / damaged / unaccounted per day. */
export function CartonChart({
  data,
}: {
  data: { day: string; used: number; damaged: number; unaccounted: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="#f0ecfa" vertical={false} />
        <XAxis dataKey="day" {...axis} minTickGap={20} />
        <YAxis {...axis} width={60} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: unknown, n: unknown) => [
            Number(v as number).toLocaleString("en-IN"),
            String(n),
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
        <Bar dataKey="used" name="Used" stackId="a" fill={SERIES[0]} isAnimationActive={false} />
        <Bar
          dataKey="damaged"
          name="Damaged"
          stackId="a"
          fill={SERIES[1]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="unaccounted"
          name="Unaccounted"
          stackId="a"
          fill={SERIES[3]}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Fat % trend against the legal spec band for one SKU. */
export function SpecTrendChart({
  data,
  min,
  max,
  target,
  unitLabel,
}: {
  data: { t: string; v: number }[];
  min: number;
  max: number;
  target: number;
  unitLabel: string;
}) {
  const span = Math.max(max - target, target - min, 0.4);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid stroke="#f0ecfa" vertical={false} />
        <ReferenceArea y1={min} y2={max} fill="#1baf7a" fillOpacity={0.07} />
        <XAxis dataKey="t" {...axis} minTickGap={40} />
        <YAxis
          {...axis}
          width={48}
          domain={[min - span * 1.6, max + span * 1.6]}
          tickFormatter={(v) => Number(v).toFixed(1)}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: unknown) => [`${Number(v as number).toFixed(2)} %`, unitLabel]}
        />
        <ReferenceLine
          y={min}
          stroke={STATUS.critical}
          strokeDasharray="5 4"
          label={{ value: "spec min", position: "right", fontSize: 10, fill: STATUS.critical }}
        />
        <Line
          type="monotone"
          dataKey="v"
          stroke={SERIES[0]}
          strokeWidth={2}
          dot={{ r: 2.5, strokeWidth: 0, fill: SERIES[0] }}
          activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
