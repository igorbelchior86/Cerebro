// ─────────────────────────────────────────────────────────────
// Autotask Routes
// ─────────────────────────────────────────────────────────────

import { Router, type Router as ExpressRouter } from 'express';
import { AutotaskClient } from '../clients/index.js';
import { query, queryOne } from '../db/index.js';
import { pgStore } from '../services/email/pg-store.js';
import { triageOrchestrator } from '../services/triage-orchestrator.js';
import { classifyQueueError } from '../platform/errors.js';
import type { AutotaskTicket } from '@cerebro/types';

const router: ExpressRouter = Router();

interface AutotaskCreds {
  apiIntegrationCode: string;
  username: string;
  secret: string;
  zoneUrl?: string;
}

type SidebarTicketRow = {
  id: string;
  ticket_id: string;
  ticket_number?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  ticket_status_value?: string | number;
  priority?: 'P1' | 'P2' | 'P3' | 'P4';
  title?: string;
  description?: string;
  company?: string;
  requester?: string;
  org?: string;
  site?: string;
  created_at?: string;
  queue?: string;
  queue_name?: string;
  queue_id?: number;
};

const ticketFieldKeys = [
  'queue',
  'priority',
  'status',
  'issueType',
  'subIssueType',
  'serviceLevelAgreement',
] as const;

type TicketFieldKey = (typeof ticketFieldKeys)[number];

const TICKET_FIELD_OPTIONS_CACHE_TTL_MS = 30_000;
const ticketFieldOptionCache = new Map<TicketFieldKey, { expiresAt: number; data: unknown[] }>();
let ticketDraftDefaultsCache: unknown = null;
const READ_ONLY_SEARCH_CACHE_TTL_MS = 30_000;
const readOnlySearchCache = new Map<string, { expiresAt: number; data: unknown[] }>();

// Lazy client — only created when a request arrives; avoids startup crash if env vars are absent.
function getClient() {
  const code = process.env.AUTOTASK_API_INTEGRATION_CODE;
  const user = process.env.AUTOTASK_USERNAME;
  const secret = process.env.AUTOTASK_SECRET;
  if (!code || !user || !secret) return null;
  return new AutotaskClient({
    apiIntegrationCode: code,
    username: user,
    secret,
    ...(process.env.AUTOTASK_ZONE_URL ? { zoneUrl: process.env.AUTOTASK_ZONE_URL } : {}),
  });
}

async function getTenantScopedClient(): Promise<AutotaskClient | null> {
  try {
    const row = await queryOne<{ credentials: AutotaskCreds }>(
      'SELECT credentials FROM integration_credentials WHERE service = $1 LIMIT 1',
      ['autotask']
    );
    const creds = row?.credentials;
    if (creds?.apiIntegrationCode && creds?.username && creds?.secret) {
      return new AutotaskClient({
        apiIntegrationCode: creds.apiIntegrationCode,
        username: creds.username,
        secret: creds.secret,
        ...(creds.zoneUrl ? { zoneUrl: creds.zoneUrl } : {}),
      });
    }
  } catch {
    // Fall back to env-based client below.
  }
  return getClient();
}

function parseIntParam(value: unknown, fallback: number, { min, max }: { min: number; max: number }) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeSearchTerm(value: unknown): string {
  return String(value ?? '').trim().replace(/'/g, "''");
}

function classifyAutotaskReadDegradedReason(error: unknown): 'rate_limited' | 'provider_error' {
  return classifyQueueError(error).code === 'RATE_LIMIT' ? 'rate_limited' : 'provider_error';
}

async function loadCachedReadOnlyArray(
  key: TicketFieldKey,
  loader: () => Promise<unknown[]>
): Promise<{ data: unknown[]; degradedReason?: 'rate_limited' | 'provider_error' }> {
  const cached = ticketFieldOptionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data };
  }

  try {
    const data = await loader();
    ticketFieldOptionCache.set(key, {
      expiresAt: Date.now() + TICKET_FIELD_OPTIONS_CACHE_TTL_MS,
      data,
    });
    return { data };
  } catch (error) {
    const stale = cached?.data;
    return {
      data: Array.isArray(stale) ? stale : [],
      degradedReason: classifyAutotaskReadDegradedReason(error),
    };
  }
}

const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;

function toBase64Payload(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.replace(/^data:[^;]+;base64,/i, '').trim();
}

function estimateBase64DecodedSize(data: string): number {
  if (!data) return 0;
  const len = data.length;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

function stringifyStructuredSearch(filter: Array<Record<string, unknown>>, maxRecords: number): string {
  return JSON.stringify({
    MaxRecords: maxRecords,
    filter,
  });
}

function buildReadOnlySearchCacheKey(scope: 'companies' | 'contacts' | 'resources', parts: Array<string | number | null>) {
  return `${scope}:${parts.map((part) => String(part ?? '')).join(':').toLowerCase()}`;
}

function readCachedReadOnlySearch(key: string): unknown[] | null {
  const cached = readOnlySearchCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    readOnlySearchCache.delete(key);
    return null;
  }
  return cached.data;
}

function writeCachedReadOnlySearch(key: string, data: unknown[]) {
  readOnlySearchCache.set(key, {
    expiresAt: Date.now() + READ_ONLY_SEARCH_CACHE_TTL_MS,
    data,
  });
}

function mapAutotaskStatusToSidebar(statusValue: unknown): SidebarTicketRow['status'] {
  const normalized = String(statusValue ?? '').trim().toLowerCase();
  if (!normalized) return 'pending';
  if (/(complete|completed|closed|done|resolved)/.test(normalized)) return 'completed';
  if (/(fail|error)/.test(normalized)) return 'failed';
  if (/(progress|processing|assigned|working)/.test(normalized)) return 'processing';
  return 'pending';
}

function mapAutotaskPriority(priorityValue: unknown): 'P1' | 'P2' | 'P3' | 'P4' {
  const numeric = Number(priorityValue);
  if (numeric === 1) return 'P1';
  if (numeric === 2) return 'P2';
  if (numeric === 3) return 'P3';
  if (numeric === 4) return 'P4';
  return 'P3';
}

function sortTicketsByCreateDateDesc(a: AutotaskTicket, b: AutotaskTicket): number {
  const at = new Date(String((a as any)?.createDate || 0)).getTime();
  const bt = new Date(String((b as any)?.createDate || 0)).getTime();
  const delta = (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  if (delta !== 0) return delta;
  return String((b as any)?.ticketNumber || b.id || '').localeCompare(String((a as any)?.ticketNumber || a.id || ''));
}

async function getQueueCatalogMap(client: AutotaskClient): Promise<Map<number, string>> {
  const queues = await client.getTicketQueues();
  const map = new Map<number, string>();
  for (const q of queues) {
    const id = Number(q.id);
    const label = String(q.label || '').trim();
    if (Number.isFinite(id) && label) map.set(id, label);
  }
  return map;
}

function toSidebarTicketFromAutotask(ticket: AutotaskTicket, queueLabelMap: Map<number, string>): SidebarTicketRow {
  const raw = ticket as any;
  const internalId = String(raw.id ?? '').trim();
  const ticketNumber = String(raw.ticketNumber || '').trim();
  const displayId = ticketNumber || internalId;
  const queueId = Number(raw.queueID);
  const queueName = Number.isFinite(queueId) ? String(queueLabelMap.get(queueId) || '').trim() : '';
  const companyName = String(raw.companyName || raw.company || '').trim();
  const requesterName = String(raw.contactName || raw.requesterName || '').trim();

  return {
    id: internalId || displayId,
    ticket_id: displayId,
    ...(ticketNumber ? { ticket_number: ticketNumber } : {}),
    status: mapAutotaskStatusToSidebar(raw.status),
    ...(raw.status !== undefined && raw.status !== null ? { ticket_status_value: raw.status } : {}),
    priority: mapAutotaskPriority(raw.priority),
    ...(raw.title ? { title: String(raw.title) } : {}),
    ...(raw.description ? { description: String(raw.description) } : {}),
    ...(companyName ? { company: companyName, org: companyName } : {}),
    ...(requesterName ? { requester: requesterName } : {}),
    ...(raw.createDate ? { created_at: String(raw.createDate) } : {}),
    ...(Number.isFinite(queueId) ? { queue_id: queueId } : {}),
    ...(queueName ? { queue: queueName, queue_name: queueName } : {}),
  };
}

function buildAutotaskTicketSearch(options: {
  maxRecords: number;
  queueId?: number;
  createDateAfterIso?: string;
}): string {
  const filter = [
    ...(typeof options.queueId === 'number'
      ? [{ op: 'eq', field: 'queueID', value: options.queueId }]
      : []),
    ...(options.createDateAfterIso
      ? [{ op: 'gt', field: 'createDate', value: options.createDateAfterIso }]
      : []),
  ];
  return JSON.stringify({ MaxRecords: options.maxRecords, filter });
}

async function getExistingTicketCoverageMap(ticketIds: string[]) {
  if (ticketIds.length === 0) return new Map<string, { inProcessed: boolean; inSessions: boolean; inSsot: boolean }>();
  const rows = await query<{
    ticket_id: string;
    in_processed: boolean;
    in_sessions: boolean;
    in_ssot: boolean;
  }>(
    `WITH keys AS (SELECT unnest($1::text[]) AS ticket_id)
     SELECT k.ticket_id,
            EXISTS (SELECT 1 FROM tickets_processed tp WHERE tp.id = k.ticket_id) AS in_processed,
            EXISTS (SELECT 1 FROM triage_sessions ts WHERE ts.ticket_id = k.ticket_id) AS in_sessions,
            EXISTS (SELECT 1 FROM ticket_ssot s WHERE s.ticket_id = k.ticket_id) AS in_ssot
     FROM keys k`,
    [ticketIds]
  );
  return new Map(rows.map((r) => [r.ticket_id, {
    inProcessed: Boolean(r.in_processed),
    inSessions: Boolean(r.in_sessions),
    inSsot: Boolean(r.in_ssot),
  }]));
}

function resolvePicklistLabel(options: Array<{ id: number; label: string }>, rawValue: unknown): string | null {
  const numeric = Number(rawValue);
  if (Number.isFinite(numeric)) {
    const match = options.find((option) => option.id === numeric);
    if (match) return match.label;
  }
  const text = String(rawValue ?? '').trim();
  return text || null;
}

/**
 * GET /autotask/ticket/:id
 * Get ticket by ID (read-only)
 */
router.get('/ticket/:id', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const ticketId = parseInt(req.params.id, 10);
    const ticket = await client.getTicket(ticketId);
    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/tickets/search
 * Search tickets (read-only)
 */
router.get('/tickets/search', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const filter = req.query.filter as string;
    if (!filter) {
      res.status(400).json({ error: 'filter query parameter is required' });
      return;
    }
    const tickets = await client.searchTickets(filter);
    res.json({
      success: true,
      data: tickets,
      count: tickets.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/device/:id
 * Get device by ID (read-only)
 */
router.get('/device/:id', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const deviceId = parseInt(req.params.id, 10);
    const device = await client.getDevice(deviceId);
    res.json({
      success: true,
      data: device,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/company/:companyId/devices
 * Get all devices for a company (read-only)
 */
router.get('/company/:companyId/devices', async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const companyId = parseInt(req.params.companyId, 10);
    const devices = await client.getDevicesByCompany(companyId);
    res.json({
      success: true,
      data: devices,
      count: devices.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/ticket/:id/notes
 * Get ticket notes (read-only)
 */
router.get('/ticket/:id/notes', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const requestedRef = String(req.params.id || '').trim();
    if (!requestedRef) {
      res.status(400).json({ error: 'ticket reference required' });
      return;
    }

    let ticketId = Number.NaN;
    if (/^\d+$/.test(requestedRef)) {
      ticketId = Number.parseInt(requestedRef, 10);
    } else {
      const ticket = await client.getTicketByTicketNumber(requestedRef);
      ticketId = Number((ticket as any)?.id);
    }
    if (!Number.isFinite(ticketId)) {
      res.status(404).json({ error: `Ticket ${requestedRef} not found` });
      return;
    }

    const notes = await client.getTicketNotes(ticketId);
    res.json({
      success: true,
      data: notes,
      count: notes.length,
      ticket_lookup: {
        requested_ref: requestedRef,
        resolved_ticket_id: ticketId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/ticket-field-options', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const requestedField = String(req.query.field || '').trim();
    const fieldLoaders = {
      queue: () => client.getTicketQueues(),
      priority: () => client.getTicketPriorityOptions(),
      status: () => client.getTicketStatusOptions(),
      issueType: () => client.getTicketIssueTypeOptions(),
      subIssueType: () => client.getTicketSubIssueTypeOptions(),
      serviceLevelAgreement: () => client.getTicketServiceLevelAgreementOptions(),
    } as const;

    if (requestedField) {
      if (!(requestedField in fieldLoaders)) {
        res.status(400).json({ error: 'Unsupported ticket field options request' });
        return;
      }
      const loader = fieldLoaders[requestedField as TicketFieldKey];
      const result = await loadCachedReadOnlyArray(requestedField as TicketFieldKey, loader);
      res.json({
        success: true,
        data: result.data,
        count: result.data.length,
        field: requestedField,
        ...(result.degradedReason
          ? { degraded: { provider: 'Autotask', reason: result.degradedReason } }
          : {}),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const queueResult = await loadCachedReadOnlyArray('queue', fieldLoaders.queue);
    const priorityResult = await loadCachedReadOnlyArray('priority', fieldLoaders.priority);
    const statusResult = await loadCachedReadOnlyArray('status', fieldLoaders.status);
    const issueTypeResult = await loadCachedReadOnlyArray('issueType', fieldLoaders.issueType);
    const subIssueTypeResult = await loadCachedReadOnlyArray('subIssueType', fieldLoaders.subIssueType);
    const serviceLevelAgreementResult = await loadCachedReadOnlyArray(
      'serviceLevelAgreement',
      fieldLoaders.serviceLevelAgreement
    );

    const degraded = [
      queueResult,
      priorityResult,
      statusResult,
      issueTypeResult,
      subIssueTypeResult,
      serviceLevelAgreementResult,
    ].some((result) => Boolean(result.degradedReason));

    res.json({
      success: true,
      data: {
        queue: queueResult.data,
        priority: priorityResult.data,
        status: statusResult.data,
        issueType: issueTypeResult.data,
        subIssueType: subIssueTypeResult.data,
        serviceLevelAgreement: serviceLevelAgreementResult.data,
      },
      ...(degraded
        ? { degraded: { provider: 'Autotask', reason: 'read_only_provider_unavailable_or_rate_limited' } }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/ticket-draft-defaults', async (_req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    let data: unknown;
    let degradedReason: 'rate_limited' | 'provider_error' | undefined;
    try {
      data = await client.getTicketDraftDefaults();
      ticketDraftDefaultsCache = data;
    } catch (error) {
      data = ticketDraftDefaultsCache;
      degradedReason = classifyAutotaskReadDegradedReason(error);
    }
    res.json({
      success: true,
      data,
      ...(degradedReason
        ? { degraded: { provider: 'Autotask', reason: degradedReason } }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/queues
 * List real queue options from Autotask Tickets.queueID picklist
 */
router.get('/queues', async (_req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }
    const queues = await client.getTicketQueues();
    res.json({
      success: true,
      data: queues,
      count: queues.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/companies/search
 * Read-only company search for UI selectors.
 */
router.get('/companies/search', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const q = sanitizeSearchTerm(req.query.q);
    const limit = parseIntParam(req.query.limit, 25, { min: 1, max: 100 });
    const cacheKey = buildReadOnlySearchCacheKey('companies', [q, limit]);
    const cached = readCachedReadOnlySearch(cacheKey);
    if (cached) {
      res.json({
        success: true,
        data: cached,
        count: cached.length,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    let rows: Array<Record<string, unknown>> = [];
    let degradedReason: 'rate_limited' | 'provider_error' | undefined;
    try {
      const filter = q
        ? [{ op: 'contains', field: 'companyName', value: q }]
        : [{ op: 'eq', field: 'isActive', value: true }];
      rows = await client.searchCompanies(
        stringifyStructuredSearch(filter, limit),
        limit
      );
    } catch (error) {
      degradedReason = classifyAutotaskReadDegradedReason(error);
    }

    const data = rows
      .map((row) => {
        const id = Number((row as any)?.id);
        const name = String((row as any)?.companyName || '').trim();
        const isActiveRaw = (row as any)?.isActive;
        const isInactiveRaw = (row as any)?.isInactive;
        const isActive = typeof isActiveRaw === 'boolean'
          ? isActiveRaw
          : typeof isInactiveRaw === 'boolean'
            ? !isInactiveRaw
            : false;
        if (!Number.isFinite(id) || !name) return null;
        return { id, name, isActive };
      })
      .filter((item) => {
        if (!item) return false;
        const isRefreshException = item.name.toLowerCase().includes('refresh');
        return item.isActive || isRefreshException;
      })
      .map((item) => item ? ({ id: item.id, name: item.name }) : null)
      .filter((item): item is { id: number; name: string } => Boolean(item))
      .slice(0, limit);
    const fallbackData = degradedReason ? readCachedReadOnlySearch(cacheKey) : null;
    const finalData = Array.isArray(fallbackData) ? fallbackData : data;
    if (!degradedReason || Array.isArray(fallbackData)) {
      writeCachedReadOnlySearch(cacheKey, finalData);
    }

    res.json({
      success: true,
      data: finalData,
      count: finalData.length,
      ...(degradedReason
        ? { degraded: { provider: 'Autotask', reason: degradedReason } }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/contacts/search
 * Read-only contact search for UI selectors.
 */
router.get('/contacts/search', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const q = sanitizeSearchTerm(req.query.q);
    const limit = parseIntParam(req.query.limit, 25, { min: 1, max: 100 });
    const maybeCompanyId = Number.parseInt(String(req.query.companyId ?? ''), 10);
    const companyId = Number.isFinite(maybeCompanyId) ? maybeCompanyId : null;
    const cacheKey = buildReadOnlySearchCacheKey('contacts', [companyId, q, limit]);
    const cached = readCachedReadOnlySearch(cacheKey);
    if (cached) {
      res.json({
        success: true,
        data: cached,
        count: cached.length,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const filter: Array<Record<string, unknown>> = [];
    if (companyId !== null) filter.push({ op: 'eq', field: 'companyID', value: companyId });
    let rows: Array<Record<string, unknown>> = [];
    let degradedReason: 'rate_limited' | 'provider_error' | undefined;
    try {
      rows = await client.searchContacts(stringifyStructuredSearch(filter, limit), limit);
    } catch (error) {
      degradedReason = classifyAutotaskReadDegradedReason(error);
    }
    const data = rows
      .map((row) => {
        const id = Number((row as any)?.id);
        const firstName = String((row as any)?.firstName || '').trim();
        const lastName = String((row as any)?.lastName || '').trim();
        const fullName = `${firstName} ${lastName}`.trim();
        const name = fullName || String((row as any)?.displayName || '').trim();
        const rowCompanyId = Number((row as any)?.companyID);
        if (!Number.isFinite(id) || !name) return null;
        return {
          id,
          name,
          ...(Number.isFinite(rowCompanyId) ? { companyId: rowCompanyId } : {}),
          ...(typeof (row as any)?.emailAddress === 'string' ? { email: String((row as any).emailAddress).trim() } : {}),
        };
      })
      .filter((item) => {
        if (!item) return false;
        if (!q) return true;
        const needle = q.toLowerCase();
        return item.name.toLowerCase().includes(needle) || String(item.email || '').toLowerCase().includes(needle);
      })
      .filter((item): item is { id: number; name: string; companyId?: number; email?: string } => Boolean(item));
    const fallbackData = degradedReason ? readCachedReadOnlySearch(cacheKey) : null;
    const finalData = Array.isArray(fallbackData) ? fallbackData : data;
    if (!degradedReason || Array.isArray(fallbackData)) {
      writeCachedReadOnlySearch(cacheKey, finalData);
    }

    res.json({
      success: true,
      data: finalData,
      count: finalData.length,
      ...(degradedReason
        ? { degraded: { provider: 'Autotask', reason: degradedReason } }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/resources/search
 * Read-only technician/resource search for assignment UX.
 */
router.get('/resources/search', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const q = sanitizeSearchTerm(req.query.q);
    const limit = parseIntParam(req.query.limit, 25, { min: 1, max: 100 });
    const cacheKey = buildReadOnlySearchCacheKey('resources', [q, limit]);
    const cached = readCachedReadOnlySearch(cacheKey);
    if (cached) {
      res.json({
        success: true,
        data: cached,
        count: cached.length,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const providerLimit = q ? Math.max(limit, 100) : limit;
    const filter: Array<Record<string, unknown>> = [{ op: 'eq', field: 'isActive', value: true }];
    let rows: Array<Record<string, unknown>> = [];
    let degradedReason: 'rate_limited' | 'provider_error' | undefined;
    try {
      rows = await client.searchResources(stringifyStructuredSearch(filter, providerLimit), providerLimit);
    } catch (error) {
      degradedReason = classifyAutotaskReadDegradedReason(error);
    }
    const data = rows
      .map((row) => {
        const id = Number((row as any)?.id);
        const defaultRoleId = Number((row as any)?.defaultServiceDeskRoleID);
        const firstName = String((row as any)?.firstName || '').trim();
        const lastName = String((row as any)?.lastName || '').trim();
        const fullName = `${firstName} ${lastName}`.trim();
        const name = fullName || String((row as any)?.userName || '').trim();
        // Assignment flow requires a valid default service desk role for the resource.
        if (!Number.isFinite(id) || !name || !Number.isFinite(defaultRoleId)) return null;
        return {
          id,
          name,
          ...(typeof (row as any)?.email === 'string' ? { email: String((row as any).email).trim() } : {}),
        };
      })
      .filter((item) => {
        if (!item) return false;
        if (!q) return true;
        const needle = q.toLowerCase();
        return item.name.toLowerCase().includes(needle) || String(item.email || '').toLowerCase().includes(needle);
      })
      .filter((item): item is { id: number; name: string; email?: string } => Boolean(item));
    const limitedData = data.slice(0, limit);
    const fallbackData = degradedReason ? readCachedReadOnlySearch(cacheKey) : null;
    const finalData = Array.isArray(fallbackData) ? fallbackData : limitedData;
    if (!degradedReason || Array.isArray(fallbackData)) {
      writeCachedReadOnlySearch(cacheKey, finalData);
    }

    res.json({
      success: true,
      data: finalData,
      count: finalData.length,
      ...(degradedReason
        ? { degraded: { provider: 'Autotask', reason: degradedReason } }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/sidebar-tickets
 * Direct queue-backed ticket list for Global sidebar mode (bypasses Cerebro pipeline coverage limits).
 */
router.get('/sidebar-tickets', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const maxRecords = parseIntParam(req.query.limit, 75, { min: 1, max: 200 });
    const queueIdRaw = String(req.query.queueId ?? '').trim();
    const queueId = Number.parseInt(queueIdRaw, 10);
    const hasQueueId = Number.isFinite(queueId);
    if (!hasQueueId) {
      res.status(400).json({ error: 'queueId query parameter is required for direct sidebar tickets' });
      return;
    }
    // Without a recency window, Autotask query paging can return old historical rows first.
    // Default to a recent window for sidebar UX; callers may override.
    const lookbackHours = parseIntParam(req.query.lookbackHours, 24 * 30, { min: 1, max: 24 * 365 });
    const createDateAfterIso = lookbackHours > 0
      ? new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()
      : undefined;

    const search = buildAutotaskTicketSearch({
      maxRecords,
      ...(hasQueueId ? { queueId } : {}),
      ...(createDateAfterIso ? { createDateAfterIso } : {}),
    });
    const [tickets, queueLabelMap] = await Promise.all([
      client.searchTickets(search, maxRecords, 0),
      getQueueCatalogMap(client).catch(() => new Map<number, string>()),
    ]);

    const rows = tickets
      .slice()
      .sort(sortTicketsByCreateDateDesc)
      .map((ticket) => toSidebarTicketFromAutotask(ticket, queueLabelMap));

    res.json({
      success: true,
      data: rows,
      count: rows.length,
      source: 'autotask_direct',
      queueId,
      lookbackHours,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /autotask/backfill-recent
 * Seed/reconcile recent Autotask tickets into Cerebro pipeline tables for sidebar coverage.
 */
router.post('/backfill-recent', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const lookbackHours = parseIntParam(req.body?.lookbackHours, 24, { min: 1, max: 24 * 30 });
    const maxRecords = parseIntParam(req.body?.maxTickets, 100, { min: 1, max: 200 });
    const maybeQueueId = Number.parseInt(String(req.body?.queueId ?? ''), 10);
    const queueId = Number.isFinite(maybeQueueId) ? maybeQueueId : undefined;
    const runPipeline = Boolean(req.body?.runPipeline);
    const dryRun = Boolean(req.body?.dryRun);

    const createDateAfterIso = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
    const search = buildAutotaskTicketSearch({
      maxRecords,
      ...(typeof queueId === 'number' ? { queueId } : {}),
      createDateAfterIso,
    });
    const tickets = (await client.searchTickets(search, maxRecords, 0))
      .slice()
      .sort(sortTicketsByCreateDateDesc);

    const ticketKeys = tickets.map((ticket) => String((ticket as any)?.ticketNumber || (ticket as any)?.id || '').trim()).filter(Boolean);
    const coverage = await getExistingTicketCoverageMap(ticketKeys);

    const missing = tickets.filter((ticket) => {
      const key = String((ticket as any)?.ticketNumber || (ticket as any)?.id || '').trim();
      const hit = coverage.get(key);
      return !(hit?.inProcessed || hit?.inSessions || hit?.inSsot);
    });

    let seededProcessed = 0;
    let pipelineTriggered = 0;
    const pipelineErrors: Array<{ ticket_id: string; error: string }> = [];

    for (const ticket of missing) {
      const raw = ticket as any;
      const ticketKey = String(raw.ticketNumber || raw.id || '').trim();
      if (!ticketKey) continue;

      if (!dryRun) {
        await pgStore.saveProcessedTicket({
          id: ticketKey,
          title: String(raw.title || '').trim() || `Autotask Ticket ${ticketKey}`,
          description: String(raw.description || '').trim(),
          company: String(raw.companyName || raw.company || '').trim() || null,
          requester: String(raw.contactName || raw.requesterName || 'Autotask').trim() || 'Autotask',
          source: 'autotask',
          status: 'open',
          rawBody: String(raw.description || '').trim(),
          isReply: false,
          createdAt: String(raw.createDate || new Date().toISOString()),
        });
        seededProcessed += 1;
      }

      if (runPipeline && !dryRun) {
        try {
          await triageOrchestrator.runPipeline(ticketKey, undefined, 'autotask');
          pipelineTriggered += 1;
        } catch (err: any) {
          pipelineErrors.push({ ticket_id: ticketKey, error: String(err?.message || err || 'unknown error') });
        }
      }
    }

    res.json({
      success: true,
      data: {
        lookbackHours,
        maxTickets: maxRecords,
        ...(typeof queueId === 'number' ? { queueId } : {}),
        dryRun,
        runPipeline,
        scanned: tickets.length,
        missingCoverage: missing.length,
        seededProcessed,
        pipelineTriggered,
        pipelineErrorsCount: pipelineErrors.length,
        sampleMissing: missing.slice(0, 10).map((ticket) => ({
          id: (ticket as any)?.id ?? null,
          ticketNumber: (ticket as any)?.ticketNumber ?? null,
          queueID: (ticket as any)?.queueID ?? null,
          title: (ticket as any)?.title ?? null,
        })),
        ...(pipelineErrors.length > 0 ? { pipelineErrors: pipelineErrors.slice(0, 10) } : {}),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /autotask/ticket/:ticketId/context
 * Write-safe ticket context update (company/contact + optional ticket metadata) + local SSOT persistence.
 */
router.patch('/ticket/:ticketId/context', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const ticketId = String(req.params.ticketId || '').trim();
    if (!ticketId) {
      res.status(400).json({ error: 'ticketId is required' });
      return;
    }

    const maybeCompanyId = Number.parseInt(String(req.body?.companyId ?? req.body?.companyID ?? ''), 10);
    const maybeContactId = Number.parseInt(String(req.body?.contactId ?? req.body?.contactID ?? ''), 10);
    const maybePriorityId = Number.parseInt(String(req.body?.priorityId ?? req.body?.priorityID ?? req.body?.priority ?? ''), 10);
    const maybeIssueTypeId = Number.parseInt(String(req.body?.issueTypeId ?? req.body?.issueType ?? ''), 10);
    const maybeSubIssueTypeId = Number.parseInt(String(req.body?.subIssueTypeId ?? req.body?.subIssueType ?? ''), 10);
    const maybeServiceLevelAgreementId = Number.parseInt(String(req.body?.serviceLevelAgreementId ?? req.body?.serviceLevelAgreementID ?? req.body?.sla ?? ''), 10);
    const companyId = Number.isFinite(maybeCompanyId) ? maybeCompanyId : null;
    const contactId = Number.isFinite(maybeContactId) ? maybeContactId : null;
    const priorityId = Number.isFinite(maybePriorityId) ? maybePriorityId : null;
    const issueTypeId = Number.isFinite(maybeIssueTypeId) ? maybeIssueTypeId : null;
    const subIssueTypeId = Number.isFinite(maybeSubIssueTypeId) ? maybeSubIssueTypeId : null;
    const serviceLevelAgreementId = Number.isFinite(maybeServiceLevelAgreementId) ? maybeServiceLevelAgreementId : null;
    if (
      companyId === null &&
      contactId === null &&
      priorityId === null &&
      issueTypeId === null &&
      subIssueTypeId === null &&
      serviceLevelAgreementId === null
    ) {
      res.status(400).json({ error: 'At least one supported field is required' });
      return;
    }

    const patch: Record<string, unknown> = {};
    if (companyId !== null) {
      patch.companyID = companyId;
      // Company change can invalidate legacy companyLocation/contact links on the ticket.
      patch.companyLocationID = null;
      if (contactId === null) {
        patch.contactID = null;
      }
    }
    if (contactId !== null) patch.contactID = contactId;
    if (priorityId !== null) patch.priority = priorityId;
    if (issueTypeId !== null) patch.issueType = issueTypeId;
    if (subIssueTypeId !== null) patch.subIssueType = subIssueTypeId;
    if (serviceLevelAgreementId !== null) patch.serviceLevelAgreementID = serviceLevelAgreementId;
    await client.updateTicket(ticketId, patch);

    const ticket = /^\d+$/.test(ticketId)
      ? await client.getTicket(Number(ticketId))
      : await client.getTicketByTicketNumber(ticketId);

    const authoritativeCompanyId = Number((ticket as any)?.companyID);
    const authoritativeContactId = Number((ticket as any)?.contactID);
    const company = Number.isFinite(authoritativeCompanyId)
      ? await client.getCompany(authoritativeCompanyId).catch(() => null)
      : null;
    const contact = Number.isFinite(authoritativeContactId)
      ? await client.getContact(authoritativeContactId).catch(() => null)
      : null;
    const authoritativePriorityId = Number((ticket as any)?.priority);
    const authoritativeIssueTypeId = Number((ticket as any)?.issueType);
    const authoritativeSubIssueTypeId = Number((ticket as any)?.subIssueType);
    const authoritativeServiceLevelAgreementId = Number((ticket as any)?.serviceLevelAgreementID);

    const [priorityOptions, issueTypeOptions, subIssueTypeOptions, serviceLevelAgreementOptions] = await Promise.all([
      client.getTicketPriorityOptions().catch(() => []),
      client.getTicketIssueTypeOptions().catch(() => []),
      client.getTicketSubIssueTypeOptions().catch(() => []),
      client.getTicketServiceLevelAgreementOptions().catch(() => []),
    ]);

    const authoritativePriorityLabel = resolvePicklistLabel(priorityOptions, (ticket as any)?.priority);
    const authoritativeIssueTypeLabel = resolvePicklistLabel(issueTypeOptions, (ticket as any)?.issueType);
    const authoritativeSubIssueTypeLabel = resolvePicklistLabel(subIssueTypeOptions, (ticket as any)?.subIssueType);
    const authoritativeServiceLevelAgreementLabel = resolvePicklistLabel(serviceLevelAgreementOptions, (ticket as any)?.serviceLevelAgreementID);

    const ticketKey = String((ticket as any)?.ticketNumber || ticketId).trim();
    const existingSsot = await queryOne<{ payload: any }>(
      `SELECT payload FROM ticket_ssot WHERE ticket_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [ticketKey]
    );
    const latestSession = await queryOne<{ id: string }>(
      `SELECT id FROM triage_sessions WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [ticketKey]
    );

    const nextPayload = {
      ...(existingSsot?.payload || {}),
      ...(company && String((company as any)?.companyName || '').trim()
        ? { company: String((company as any)?.companyName || '').trim() }
        : {}),
      ...(contact && `${String((contact as any)?.firstName || '').trim()} ${String((contact as any)?.lastName || '').trim()}`.trim()
        ? { requester_name: `${String((contact as any)?.firstName || '').trim()} ${String((contact as any)?.lastName || '').trim()}`.trim() }
        : {}),
      autotask_authoritative: {
        ...((existingSsot?.payload?.autotask_authoritative || {}) as Record<string, unknown>),
        ticket_number: String((ticket as any)?.ticketNumber || ticketKey),
        ticket_id_numeric: Number.isFinite(Number((ticket as any)?.id)) ? Number((ticket as any)?.id) : null,
        company_id: Number.isFinite(authoritativeCompanyId) ? authoritativeCompanyId : null,
        company_name: String((company as any)?.companyName || '').trim() || null,
        contact_id: Number.isFinite(authoritativeContactId) ? authoritativeContactId : null,
        contact_name: `${String((contact as any)?.firstName || '').trim()} ${String((contact as any)?.lastName || '').trim()}`.trim() || null,
        contact_email: String((contact as any)?.emailAddress || '').trim() || null,
        priority_id: Number.isFinite(authoritativePriorityId) ? authoritativePriorityId : null,
        priority_label: authoritativePriorityLabel,
        issue_type_id: Number.isFinite(authoritativeIssueTypeId) ? authoritativeIssueTypeId : null,
        issue_type_label: authoritativeIssueTypeLabel,
        sub_issue_type_id: Number.isFinite(authoritativeSubIssueTypeId) ? authoritativeSubIssueTypeId : null,
        sub_issue_type_label: authoritativeSubIssueTypeLabel,
        service_level_agreement_id: Number.isFinite(authoritativeServiceLevelAgreementId) ? authoritativeServiceLevelAgreementId : null,
        service_level_agreement_label: authoritativeServiceLevelAgreementLabel,
      },
    };

    await query(
      `INSERT INTO ticket_ssot (ticket_id, session_id, payload, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())
       ON CONFLICT (ticket_id)
       DO UPDATE SET
         session_id = EXCLUDED.session_id,
         payload = EXCLUDED.payload,
         updated_at = NOW()`,
      [ticketKey, latestSession?.id ?? null, JSON.stringify(nextPayload)]
    );

    res.json({
      success: true,
      data: {
        ticketId: ticketKey,
        companyId: Number.isFinite(authoritativeCompanyId) ? authoritativeCompanyId : null,
        companyName: String((company as any)?.companyName || '').trim() || null,
        contactId: Number.isFinite(authoritativeContactId) ? authoritativeContactId : null,
        contactName: `${String((contact as any)?.firstName || '').trim()} ${String((contact as any)?.lastName || '').trim()}`.trim() || null,
        contactEmail: String((contact as any)?.emailAddress || '').trim() || null,
        priorityId: Number.isFinite(authoritativePriorityId) ? authoritativePriorityId : null,
        priorityLabel: authoritativePriorityLabel,
        issueTypeId: Number.isFinite(authoritativeIssueTypeId) ? authoritativeIssueTypeId : null,
        issueTypeLabel: authoritativeIssueTypeLabel,
        subIssueTypeId: Number.isFinite(authoritativeSubIssueTypeId) ? authoritativeSubIssueTypeId : null,
        subIssueTypeLabel: authoritativeSubIssueTypeLabel,
        serviceLevelAgreementId: Number.isFinite(authoritativeServiceLevelAgreementId) ? authoritativeServiceLevelAgreementId : null,
        serviceLevelAgreementLabel: authoritativeServiceLevelAgreementLabel,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /autotask/ticket/:ticketId/attachments
 * Upload regular ticket attachments to Autotask (TicketAttachments entity).
 */
router.post('/ticket/:ticketId/attachments', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient();
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const ticketId = String(req.params.ticketId || '').trim();
    if (!ticketId) {
      res.status(400).json({ error: 'ticketId is required' });
      return;
    }

    const body = (req.body || {}) as {
      files?: Array<{
        fileName?: string;
        contentType?: string;
        dataBase64?: string;
        title?: string;
      }>;
    };

    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length === 0) {
      res.status(400).json({ error: 'files[] is required' });
      return;
    }

    const results: Array<{
      fileName: string;
      uploaded: boolean;
      attachmentId?: string;
      error?: string;
    }> = [];

    for (const file of files) {
      const fileName = String(file?.fileName || '').trim();
      const contentType = String(file?.contentType || 'application/octet-stream').trim();
      const dataBase64 = toBase64Payload(file?.dataBase64);
      const estimatedSize = estimateBase64DecodedSize(dataBase64);

      if (!fileName || !dataBase64) {
        results.push({ fileName: fileName || 'unknown', uploaded: false, error: 'fileName and dataBase64 are required' });
        continue;
      }
      if (estimatedSize > MAX_ATTACHMENT_BYTES) {
        results.push({
          fileName,
          uploaded: false,
          error: `file exceeds max size (${MAX_ATTACHMENT_BYTES} bytes)`,
        });
        continue;
      }

      try {
        const created = await client.createTicketAttachment(ticketId, {
          title: String(file?.title || fileName).trim(),
          fileName,
          contentType,
          dataBase64,
        });
        results.push({
          fileName,
          uploaded: true,
          attachmentId: String((created as any)?.id || (created as any)?.item?.id || ''),
        });
      } catch (err) {
        results.push({
          fileName,
          uploaded: false,
          error: (err as Error)?.message || 'upload failed',
        });
      }
    }

    const failed = results.filter((r) => !r.uploaded);
    res.status(failed.length > 0 ? 207 : 200).json({
      success: failed.length === 0,
      data: {
        ticketId,
        uploadedCount: results.filter((r) => r.uploaded).length,
        failedCount: failed.length,
        results,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
