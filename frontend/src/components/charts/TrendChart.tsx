"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors, fonts } from "@/lib/design-tokens";

export function TrendChart({
  data,
}: {
  data: { week: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={colors.border} vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: colors.textSecondary, fontFamily: fonts.body }}
          tickLine={false}
          axisLine={{ stroke: colors.border }}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: colors.textSecondary, fontFamily: fonts.body }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          formatter={(v) => [`${v}%`, "Conversion"]}
          contentStyle={{
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
            fontFamily: fonts.body,
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={colors.orange}
          strokeWidth={2.5}
          dot={{ r: 3, fill: colors.orange, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
