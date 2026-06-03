export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          updated_at: string
          full_name: string | null
          preferred_currency: 'ARS' | 'USD'
          created_at: string
        }
        Insert: {
          id: string
          updated_at?: string
          full_name?: string | null
          preferred_currency?: 'ARS' | 'USD'
          created_at?: string
        }
        Update: {
          id?: string
          updated_at?: string
          full_name?: string | null
          preferred_currency?: 'ARS' | 'USD'
          created_at?: string
        }
      }
      households: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      household_members: {
        Row: {
          id: string
          household_id: string
          user_id: string
          role: 'admin' | 'member'
          split_percentage: number
          joined_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id: string
          role?: 'admin' | 'member'
          split_percentage?: number
          joined_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          user_id?: string
          role?: 'admin' | 'member'
          split_percentage?: number
          joined_at?: string
        }
      }
      invitations: {
        Row: {
          id: string
          household_id: string
          invited_email: string
          token: string
          status: 'pending' | 'accepted' | 'expired'
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          invited_email: string
          token: string
          status?: 'pending' | 'accepted' | 'expired'
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          invited_email?: string
          token?: string
          status?: 'pending' | 'accepted' | 'expired'
          created_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'cash' | 'bank' | 'crypto'
          currency: 'ARS' | 'USD' | 'USDT' | 'USDC' | 'BTC' | 'ETH'
          balance: number
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'cash' | 'bank' | 'crypto'
          currency: 'ARS' | 'USD' | 'USDT' | 'USDC' | 'BTC' | 'ETH'
          balance?: number
          color?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'cash' | 'bank' | 'crypto'
          currency?: 'ARS' | 'USD' | 'USDT' | 'USDC' | 'BTC' | 'ETH'
          balance?: number
          color?: string
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string | null
          name: string
          type: 'income' | 'expense' | 'transfer'
          icon: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name?: string
          type?: 'income' | 'expense' | 'transfer'
          icon?: string
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          type?: 'income' | 'expense' | 'transfer'
          icon?: string
          color?: string
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          destination_account_id: string | null
          category_id: string | null
          amount: number
          currency: 'ARS' | 'USD' | 'USDT' | 'USDC' | 'BTC' | 'ETH'
          type: 'income' | 'expense' | 'transfer' | 'subscription' | 'service'
          description: string | null
          transaction_date: string
          exchange_rate: number
          created_at: string
          payment_method: 'cash' | 'card' | 'transfer'
          is_installment: boolean
          installments_total: number
          installment_number: number
          parent_transaction_id: string | null
          subscription_frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual' | null
          household_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          destination_account_id?: string | null
          category_id?: string | null
          amount: number
          currency: 'ARS' | 'USD' | 'USDT' | 'USDC' | 'BTC' | 'ETH'
          type: 'income' | 'expense' | 'transfer' | 'subscription' | 'service'
          description?: string | null
          transaction_date?: string
          exchange_rate?: number
          created_at?: string
          payment_method?: 'cash' | 'card' | 'transfer'
          is_installment?: boolean
          installments_total?: number
          installment_number?: number
          parent_transaction_id?: string | null
          subscription_frequency?: 'monthly' | 'quarterly' | 'biannual' | 'annual' | null
          household_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          destination_account_id?: string | null
          category_id?: string | null
          amount?: number
          currency?: 'ARS' | 'USD' | 'USDT' | 'USDC' | 'BTC' | 'ETH'
          type?: 'income' | 'expense' | 'transfer' | 'subscription' | 'service'
          description?: string | null
          transaction_date?: string
          exchange_rate?: number
          created_at?: string
          payment_method?: 'cash' | 'card' | 'transfer'
          is_installment?: boolean
          installments_total?: number
          installment_number?: number
          parent_transaction_id?: string | null
          subscription_frequency?: 'monthly' | 'quarterly' | 'biannual' | 'annual' | null
          household_id?: string | null
        }
      }
      savings_goals: {
        Row: {
          id: string
          user_id: string
          household_id: string | null
          name: string
          target_amount: number
          current_amount: number
          currency: 'ARS' | 'USD'
          target_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          household_id?: string | null
          name: string
          target_amount: number
          current_amount?: number
          currency?: 'ARS' | 'USD'
          target_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          household_id?: string | null
          name?: string
          target_amount?: number
          current_amount?: number
          currency?: 'ARS' | 'USD'
          target_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      goal_deposits: {
        Row: {
          id: string
          goal_id: string
          user_id: string
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          goal_id: string
          user_id: string
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          goal_id?: string
          user_id?: string
          amount?: number
          created_at?: string
        }
      }
      household_incomes: {
        Row: {
          id: string
          household_id: string
          user_id: string
          monthly_income_ars: number
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id: string
          monthly_income_ars?: number
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          user_id?: string
          monthly_income_ars?: number
          updated_at?: string
        }
      }
      household_share_records: {
        Row: {
          id: string
          transaction_id: string
          household_id: string
          paying_user_id: string
          owed_user_id: string
          share_amount: number
          split_percentage: number
          is_settled: boolean
          settled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          household_id: string
          paying_user_id: string
          owed_user_id: string
          share_amount: number
          split_percentage: number
          is_settled?: boolean
          settled_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          household_id?: string
          paying_user_id?: string
          owed_user_id?: string
          share_amount?: number
          split_percentage?: number
          is_settled?: boolean
          settled_at?: string | null
          created_at?: string
        }
      }
      household_balances: {
        Row: {
          id: string
          household_id: string
          from_user_id: string
          to_user_id: string
          open_amount: number
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          from_user_id: string
          to_user_id: string
          open_amount?: number
          updated_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          from_user_id?: string
          to_user_id?: string
          open_amount?: number
          updated_at?: string
        }
      }
      household_settlements: {
        Row: {
          id: string
          household_id: string
          from_user_id: string
          to_user_id: string
          amount: number
          settled_at: string
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          from_user_id: string
          to_user_id: string
          amount: number
          settled_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          household_id?: string
          from_user_id?: string
          to_user_id?: string
          amount?: number
          settled_at?: string
          created_at?: string
        }
      }
    }
  }
}
