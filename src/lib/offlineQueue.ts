import { get, set, del, keys, createStore } from 'idb-keyval'

const queueStore = createStore('offline-queue', 'transactions')

interface QueuedTransaction {
  id: string
  description: string
  amount: number
  currency: string
  type: string
  accountId: string | null
  paymentMethod: string
  installments: number
  createdAt: string
}

export async function enqueueTransaction(tx: QueuedTransaction): Promise<void> {
  const queue = await get<QueuedTransaction[]>('pending', queueStore) || []
  queue.push(tx)
  await set('pending', queue, queueStore)
}

export async function getQueue(): Promise<QueuedTransaction[]> {
  return await get<QueuedTransaction[]>('pending', queueStore) || []
}

export async function clearQueue(): Promise<void> {
  await del('pending', queueStore)
}

export async function processQueue(): Promise<{ processed: number; failed: number }> {
  const queue = await getQueue()
  if (queue.length === 0) return { processed: 0, failed: 0 }

  let processed = 0
  let failed = 0
  const remaining: QueuedTransaction[] = []

  for (const tx of queue) {
    try {
      const res = await fetch('/api/transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: tx.description,
          amount: tx.amount,
          currency: tx.currency,
          type: tx.type,
          account_id: tx.accountId,
          payment_method: tx.paymentMethod,
          is_installment: tx.installments > 0,
          installments_total: tx.installments || 1,
          installment_number: 1,
          transaction_date: tx.createdAt,
        }),
      })

      if (res.ok) {
        processed++
      } else {
        remaining.push(tx)
        failed++
      }
    } catch {
      remaining.push(tx)
      failed++
    }
  }

  if (remaining.length > 0) {
    await set('pending', remaining, queueStore)
  } else {
    await clearQueue()
  }

  return { processed, failed }
}

export async function getQueueSize(): Promise<number> {
  const queue = await getQueue()
  return queue.length
}
