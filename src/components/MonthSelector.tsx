'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CustomSelect } from './ui/CustomSelect'

function getNow() {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function MonthSelector() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [now, setNow] = useState(() => getNow())
    useEffect(() => { setNow(getNow()) }, [])

    const currentYear = now.year
    const selectedMonth = searchParams.get('month') || `${currentYear}-${String(now.month).padStart(2, '0')}`

    const options = Array.from({length: 12}).map((_, i) => {
        const monthNumber = String(i + 1).padStart(2, '0');
        const value = `${currentYear}-${monthNumber}`;
        const label = new Date(currentYear, i, 1).toLocaleString('es-ES', {month: 'long'});
        const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
        
        return { value, label: capitalizedLabel }
    })

    return (
        <CustomSelect 
            value={selectedMonth}
            onChange={(val) => router.push(`/?month=${val}`)}
            options={options}
            className="w-48"
        />
    )
}
