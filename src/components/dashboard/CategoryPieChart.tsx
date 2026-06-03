'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface CategoryData {
  name: string
  value: number
  color: string
  percentage: string
}

interface Props {
  data: CategoryData[]
}

export function CategoryPieChart({ data }: Props) {
  if (data.length === 0) return null

  return (
    <section className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-8">
      <h2 className="text-lg font-semibold mb-6">Gastos por categoría</h2>
      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="w-56 h-56 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
                formatter={(value: any, name: any, entry: any) => [
                  `${entry.payload.percentage}% — ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value)}`,
                  entry.payload.name,
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5 w-full">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground truncate">{item.name}</span>
              <span className="text-foreground font-medium ml-auto tabular-nums">
                {item.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
