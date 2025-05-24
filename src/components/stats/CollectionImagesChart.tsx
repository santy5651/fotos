"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface ChartData {
  name: string;
  count: number;
}

interface CollectionImagesChartProps {
  data: ChartData[];
}

const chartConfig = {
  images: {
    label: "Images",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

export default function CollectionImagesChart({ data }: CollectionImagesChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No data to display chart.</div>;
  }
  
  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 50 /* more bottom margin for angled labels */ }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="name" 
            tickLine={false} 
            axisLine={false} 
            tickMargin={8}
            angle={-45} // Angle labels to prevent overlap
            textAnchor="end" // Anchor angled labels correctly
            height={60} // Increase height to accommodate angled labels
            interval={0} // Show all labels
            tick={{ fontSize: 12 }}
          />
          <YAxis allowDecimals={false} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <Bar dataKey="count" fill="var(--color-images)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
