import { Badge } from '@/components/ui/badge'

const statusConfig: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  success: { label: 'Success', variant: 'success' },
  failure: { label: 'Failed', variant: 'destructive' },
  timeout: { label: 'Timeout', variant: 'warning' },
  running: { label: 'Running', variant: 'secondary' },
  skipped: { label: 'Skipped', variant: 'secondary' },
}

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, variant: 'secondary' as const }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
