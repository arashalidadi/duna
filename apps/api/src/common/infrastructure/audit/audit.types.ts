export interface AuditContext {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorEmail: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditQueryOptions {
  action?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

export interface AuditResult {
  items: AuditLogRecord[];
  total: number;
}

export interface AuditLogRecord {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: Date;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
