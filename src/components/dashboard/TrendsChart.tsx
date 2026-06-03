'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'

interface MonthlyData {
  month: string
  ingresos: number
  gastos: number
}

interface Props {
  data: MonthlyData[]
}

export function TrendsChart({ data }: Props) {
  if (data.length === 0) return null

  return (
    <section className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-8">
      <h2 className="text-lg font-semibold mb-6">Tendencias</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="month"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
              tickFormatter={(val: string) => {
                const [year, month] = val.split('-')
                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
                return months[parseInt(month) - 1]
              }}
            />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
              tickFormatter={(val: number) =>
                val >= 1000000
                  ? `$${(val / 1000000).toFixed(1)}M`
                  : val >= 1000
                    ? `$${(val / 1000).toFixed(0)}k`
                    : `$${val}`
              }
            />
            <Tooltip
              cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
              contentStyle={{
                backgroundColor: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                fontSize: '12px',
                color: 'var(--color-foreground)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
              formatter={(value: any, name: any) => [
                new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value),
                name === 'ingresos' ? 'Ingresos' : 'Gastos',
              ]}
            />
            <Bar dataKey="ingresos" fill="#22c55e" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos" fill="#f472b6" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
