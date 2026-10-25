import { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog, IAuditLog } from './audit.model';
import { logger } from '../../utils/logger';
import { Role } from '../../constants/roles';

export interface AuditActor {
  id?: Types.ObjectId | string | null;
  name: string;
  role: Role | string;
}

export interface AuditLogParams {
  req?: Request;
  actor?: AuditActor;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface AuditFilterParams {
  actorId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'tokenversion',
  'currentpassword',
  'newpassword',
  'adminpassword',
  'secret',
]);

function stripSensitive(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stripSensitive);
  }
  if (typeof value === 'object' && !(value instanceof Date) && !(value instanceof Types.ObjectId)) {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        continue;
      }
      cleaned[k] = stripSensitive(v);
    }
    return cleaned;
  }
  return value;
}

export function computeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b = (before || {}) as Record<string, unknown>;
  const a = (after || {}) as Record<string, unknown>;

  const diffBefore: Record<string, unknown> = {};
  const diffAfter: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);
  for (const key of allKeys) {
    if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
      if (key in b) diffBefore[key] = b[key];
      if (key in a) diffAfter[key] = a[key];
    }
  }

  return { before: diffBefore, after: diffAfter };
}

export class AuditService {
  async log(params: AuditLogParams): Promise<void> {
    try {
      const { req, actor, action, entity, entityId, before, after } = params;

      let actorId: Types.ObjectId | null = null;
      let actorName = 'system';
      let actorRole = 'system';
      let ip = '';
      let userAgent = '';

      if (req) {
        ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
        userAgent = req.headers['user-agent'] || '';
        const user = (req as any).user;
        if (user) {
          actorId = user._id ? new Types.ObjectId(user._id) : null;
          actorName = user.name || 'user';
          actorRole = user.role || 'user';
        }
      }

      if (actor) {
        if (actor.id) {
          actorId = typeof actor.id === 'string' ? new Types.ObjectId(actor.id) : actor.id;
        }
        actorName = actor.name;
        actorRole = actor.role;
      }

      const sanitizedBefore = stripSensitive(before) as Record<string, unknown> | null;
      const sanitizedAfter = stripSensitive(after) as Record<string, unknown> | null;

      await AuditLog.create({
        actorId,
        actorName,
        actorRole,
        action,
        entity,
        entityId: entityId || null,
        before: sanitizedBefore || null,
        after: sanitizedAfter || null,
        ip,
        userAgent,
      });
    } catch (err: any) {
      // Never crash the main request because of audit failure
      logger.error({ err: err.message, action: params.action }, 'Failed to record audit log entry');
    }
  }

  async list(filters: AuditFilterParams): Promise<{ logs: IAuditLog[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (filters.actorId && Types.ObjectId.isValid(filters.actorId)) {
      query.actorId = new Types.ObjectId(filters.actorId);
    }
    if (filters.action) {
      query.action = filters.action;
    }
    if (filters.entity) {
      query.entity = filters.entity;
    }
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) {
        query.createdAt.$gte = new Date(filters.from);
      }
      if (filters.to) {
        query.createdAt.$lte = new Date(filters.to);
      }
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    return {
      logs: logs as unknown as IAuditLog[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const auditService = new AuditService();
