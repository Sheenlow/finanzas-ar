import { z } from 'zod'

export const CreateHouseholdSchema = z.object({
  name: z.string().min(1).max(100),
})

export const AcceptInviteSchema = z.object({
  token: z.string().min(1),
})

export const SplitSchema = z.object({
  household_id: z.string().uuid(),
  transaction_id: z.string().uuid(),
  amount: z.number().positive().max(1_000_000_000),
  currency: z.enum(['ARS', 'USD', 'USDT', 'USDC', 'BTC', 'ETH']).default('ARS'),
})

export const SettleSchema = z.object({
  to_user_id: z.string().uuid(),
  amount: z.number().positive(),
})

export const IncomeSchema = z.object({
  household_id: z.string().uuid(),
  monthly_income_ars: z.number().min(0).max(1_000_000_000),
})

export const DepositSchema = z.object({
  goalId: z.string().uuid(),
  amount: z.number().positive(),
})

export const InviteSchema = z.object({
  householdId: z.string().uuid(),
  email: z.string().email(),
})

export const RenameSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().min(1).max(100),
})

export const GenerateOneSchema = z.object({
  transactionId: z.string().uuid(),
})

export const RemoveMemberSchema = z.object({
  memberId: z.string().uuid(),
})

export const TransferAdminSchema = z.object({
  memberId: z.string().uuid(),
})
