import { createAdminClient } from '@/lib/supabase/admin'

interface AuditLogParams {
  userId: string
  action: 'create' | 'update' | 'delete'
  entityType: 'transaction' | 'account' | 'goal' | 'household'
  entityId: string
  details?: Record<string, unknown>
  ipAddress?: string
}

export const auditService = {
  async log(params: AuditLogParams) {
    if (typeof window !== 'undefined') return
    try {
      const admin = createAdminClient()
      await admin.from('audit_logs').insert({
        user_id: params.userId,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        details: params.details || {},
        ip_address: params.ipAddress || 'unknown',
      }).throwOnError()
    } catch (err) {
      console.error('Audit log failed:', err)
    }
  }
}
