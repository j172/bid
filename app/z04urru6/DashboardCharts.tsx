"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Colors validated together for categorical use (colorblind-safe pairing,
// contrast against the white chart surface) — see the dataviz skill's
// palette validator. Kept independent of the brand palette so chart
// series stay distinguishable regardless of brand color changes.
const AUCTION_COLOR = "#b45309";
const FIXED_PRICE_COLOR = "#2a78d6";
const GRID_COLOR = "#e5e7eb";
const AXIS_COLOR = "#9ca3af";

function formatShortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${month}/${day}`;
}

// recharts' Tooltip callback types are generic over ReactNode/ValueType
// (since a tooltip can appear on any chart shape) — these narrow back down
// to the plain string/number this chart actually deals with.
function tooltipLabelFormatter(label: unknown): string {
  return formatShortDate(String(label ?? ""));
}

function tooltipValueFormatter(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString() : String(value ?? "");
}

interface GmvChartProps {
  data: { date: string; auctionGmv: number; fixedPriceGmv: number }[];
}

export function GmvTrendChart({ data }: GmvChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          interval={Math.floor(data.length / 6)}
          stroke={AXIS_COLOR}
          tick={{ fontSize: 12 }}
        />
        <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 12 }} width={50} />
        <Tooltip labelFormatter={tooltipLabelFormatter} formatter={tooltipValueFormatter} />
        <Legend />
        <Line type="monotone" dataKey="auctionGmv" name="拍賣成交額" stroke={AUCTION_COLOR} strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="fixedPriceGmv"
          name="一般商品成交額"
          stroke={FIXED_PRICE_COLOR}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface UserChartProps {
  data: { date: string; count: number }[];
}

export function NewUserTrendChart({ data }: UserChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          interval={Math.floor(data.length / 6)}
          stroke={AXIS_COLOR}
          tick={{ fontSize: 12 }}
        />
        <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 12 }} width={40} allowDecimals={false} />
        <Tooltip labelFormatter={tooltipLabelFormatter} formatter={tooltipValueFormatter} />
        <Line type="monotone" dataKey="count" name="新增使用者" stroke={AUCTION_COLOR} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// A simple horizontal segmented bar rather than a pie/donut — a two-category
// proportion is read more precisely as adjacent lengths than as wedge angles.
export function GmvSplitBar({ auctionGmv, fixedPriceGmv }: { auctionGmv: number; fixedPriceGmv: number }) {
  const total = auctionGmv + fixedPriceGmv;
  const auctionPct = total > 0 ? (auctionGmv / total) * 100 : 50;
  const fixedPricePct = 100 - auctionPct;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-6 w-full overflow-hidden rounded-full border border-border">
        {auctionGmv > 0 && (
          <div style={{ width: `${auctionPct}%`, backgroundColor: AUCTION_COLOR }} title={`拍賣 ${auctionPct.toFixed(1)}%`} />
        )}
        {fixedPriceGmv > 0 && (
          <div
            style={{ width: `${fixedPricePct}%`, backgroundColor: FIXED_PRICE_COLOR }}
            title={`一般商品 ${fixedPricePct.toFixed(1)}%`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: AUCTION_COLOR }} />
          拍賣商品：{auctionGmv.toLocaleString()}（{auctionPct.toFixed(1)}%）
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FIXED_PRICE_COLOR }} />
          一般商品：{fixedPriceGmv.toLocaleString()}（{fixedPricePct.toFixed(1)}%）
        </span>
      </div>
    </div>
  );
}
