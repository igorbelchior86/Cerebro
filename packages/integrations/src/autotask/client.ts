// ─────────────────────────────────────────────────────────────
// Autotask API Client (Read-only)
// Documentation: https://webservices14.autotask.net/help/content/0_home.htm
// ─────────────────────────────────────────────────────────────

import type { AutotaskTicket, AutotaskDevice } from '@cerebro/types';

// Autotask uses 3 custom headers — NOT Bearer token.
// Reference: https://webservices.autotask.net/help/developerhelp/Content/APIs/REST/General_Topics/REST_API_Authentication.htm
export interface AutotaskConfig {
  /** API Integration Code from Autotask Admin → Resources → API Users */
  apiIntegrationCode: string;
  /** Email address of the dedicated API user */
  username: string;
  /** Password of the API user */
  secret: string;
  /**
   * Zone base URL — Autotask is multi-datacenter. If not provided,
   * zone discovery is performed automatically using webservices2 as the
   * universal discovery endpoint.
   */
  zoneUrl?: string;
}

export interface AutotaskQueueOption {
  id: number;
  label: string;
  isActive?: boolean;
}

export interface AutotaskPicklistOption {
  id: number;
  label: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface AutotaskTicketDraftDefaults {
  ticketCategoryId: number | null;
  status: AutotaskPicklistOption | null;
  priority: AutotaskPicklistOption | null;
  issueType: AutotaskPicklistOption | null;
  subIssueType: AutotaskPicklistOption | null;
  serviceLevelAgreement: AutotaskPicklistOption | null;
  queue: AutotaskPicklistOption | null;
}

/** Discovery endpoint — acts as universal entry point for zone lookup */
const DISCOVERY_BASE = 'https://webservices2.autotask.net/atservicesrest/v1.0';

export class AutotaskClient {
  private config: AutotaskConfig;
  private zoneBase: string | null;
  private entityFieldsCache = new Map<string, Promise<any[]>>();

  constructor(config: AutotaskConfig) {
    this.config = config;
    // If a zone URL is pre-configured, use it directly; otherwise discover.
    this.zoneBase = config.zoneUrl ?? null;
  }

  private authHeaders(): Record<string, string> {
    return {
      'ApiIntegrationcode': this.config.apiIntegrationCode,
      'UserName':           this.config.username,
      'Secret':             this.config.secret,
      'Content-Type':       'application/json',
    };
  }

  /**
   * Discover the correct zone URL for this account.
   * Uses the zoneInformation endpoint on webservices2 (universal discovery node).
   * Result is cached on the instance.
   */
  async discoverZone(): Promise<string> {
    if (this.zoneBase) return this.zoneBase;

    const url = `${DISCOVERY_BASE}/zoneInformation?user=${encodeURIComponent(this.config.username)}`;
    const res = await fetch(url, { headers: this.authHeaders() });
    if (!res.ok) {
      throw new Error(`Autotask zone discovery failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json() as { url: string };
    this.zoneBase = `${data.url}/v1.0`;
    return this.zoneBase;
  }

  private async request<T>(endpoint: string, params?: Record<string, string | number>) {
    return this.requestJson<T>('GET', endpoint, params ? { params } : undefined);
  }

  private async requestJson<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    endpoint: string,
    options?: { params?: Record<string, string | number>; body?: unknown }
  ) {
    const base = await this.discoverZone();
    const url = new URL(`${base}${endpoint}`);
    if (options?.params) {
      Object.entries(options.params).forEach(([k, v]) => url.searchParams.append(k, String(v)));
    }

    const response = await fetch(url.toString(), {
      method,
      headers: this.authHeaders(),
      ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!response.ok) {
      const errorBody =
        typeof (response as any).text === 'function'
          ? await (response as any).text().catch(() => '')
          : '';
      const suffix = errorBody ? ` - ${errorBody.slice(0, 800)}` : '';
      throw new Error(`Autotask API error: ${response.status} ${response.statusText}${suffix}`);
    }

    if (response.status === 204) {
      return {} as T;
    }
    const contentType = String((response as any)?.headers?.get?.('content-type') || '').toLowerCase();
    const canReadJson = typeof (response as any)?.json === 'function';
    if (canReadJson && (contentType.includes('application/json') || !contentType)) {
      return response.json() as Promise<T>;
    }
    const textBody = typeof (response as any).text === 'function'
      ? await (response as any).text().catch(() => '')
      : '';
    if (!textBody) return {} as T;
    try {
      return JSON.parse(textBody) as T;
    } catch {
      return { raw: textBody } as T;
    }
  }

  private buildSearchParam(filterOrSearch: string, maxRecords: number): string {
    try {
      const parsed = JSON.parse(filterOrSearch) as Record<string, unknown>;
      if (Array.isArray(parsed.filter)) {
        const searchObj = {
          ...parsed,
          ...(typeof parsed.MaxRecords === 'number' ? {} : { MaxRecords: maxRecords }),
        };
        return JSON.stringify(searchObj);
      }

      return JSON.stringify({
        MaxRecords: maxRecords,
        filter: [parsed],
      });
    } catch {
      // Preserve legacy/manual callers sending raw text while still wrapping into the documented shape.
      return JSON.stringify({
        MaxRecords: maxRecords,
        filter: [{ op: 'contains', field: 'title', value: filterOrSearch }],
      });
    }
  }

  private extractCollection<T>(response: { items?: T[]; records?: T[]; item?: T } | null | undefined): T[] {
    if (response?.item) return [response.item];
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.records)) return response.records;
    return [];
  }

  private async queryEntity<T>(
    entityPath: string,
    filter: Array<Record<string, unknown>>,
    maxRecords: number = 25
  ): Promise<T[]> {
    const response = await this.requestJson<{ items?: T[]; records?: T[]; item?: T }>(
      'POST',
      `${entityPath}/query`,
      {
        body: {
          MaxRecords: maxRecords,
          filter,
        },
      }
    );
    return this.extractCollection(response);
  }

  private async getEntityFields(entityPath: string): Promise<any[]> {
    const cached = this.entityFieldsCache.get(entityPath);
    if (cached) {
      return cached;
    }

    const requestPromise = this.request<any>(`${entityPath}/entityInformation/fields`)
      .then((response) => {
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.fields)) return response.fields;
        if (Array.isArray(response?.items)) return response.items;
        return [];
      });

    this.entityFieldsCache.set(entityPath, requestPromise);
    return requestPromise;
  }

  private collectFieldDefaultCandidates(targetField: any): Set<string> {
    const candidates = new Set<string>();
    const push = (value: unknown) => {
      if (value === null || value === undefined) return;
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        push(obj.value);
        push(obj.id);
        push(obj.code);
        push(obj.picklistValue);
        return;
      }
      const normalized = String(value).trim();
      if (!normalized) return;
      candidates.add(normalized);
    };
    push(
      targetField?.defaultValue ??
      targetField?.defaultPicklistValue ??
      targetField?.defaultPickListValue ??
      targetField?.defaultValueId ??
      targetField?.defaultValueID ??
      targetField?.default
    );
    return candidates;
  }

  private pickPreferredDraftOption(
    fieldName: 'queueID' | 'status' | 'priority' | 'issueType' | 'subIssueType' | 'serviceLevelAgreementID',
    options: AutotaskPicklistOption[]
  ): AutotaskPicklistOption | null {
    if (!Array.isArray(options) || options.length === 0) return null;
    const active = options.filter((row) => row.isActive !== false);
    const pool = active.length > 0 ? active : options;
    const explicitDefault = pool.find((row) => row.isDefault);
    if (explicitDefault) return explicitDefault;

    if (fieldName === 'status') {
      return (
        pool.find((row) => row.label.trim().toLowerCase() === 'new') ||
        pool.find((row) => row.label.trim().toLowerCase().includes('new')) ||
        pool[0] ||
        null
      );
    }

    if (fieldName === 'priority') {
      return (
        pool.find((row) => /\bp3\b/i.test(row.label)) ||
        pool.find((row) => /\bmedium\b/i.test(row.label)) ||
        pool.find((row) => /\bnormal\b/i.test(row.label)) ||
        pool[0] ||
        null
      );
    }

    if (fieldName === 'serviceLevelAgreementID') {
      return pool[0] || null;
    }

    if (fieldName === 'queueID') {
      return pool[0] || null;
    }

    return null;
  }

  private resolveOptionById(options: AutotaskPicklistOption[], rawValue: unknown): AutotaskPicklistOption | null {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return null;
    return options.find((option) => option.id === numeric) || null;
  }

  private async getTicketDefaultCategoryId(): Promise<number | null> {
    const fields = await this.getEntityFields('/tickets');
    const targetField = fields.find((field: any) =>
      String(field?.name || field?.fieldName || '').toLowerCase() === 'ticketcategory'
    );
    if (!targetField) return null;

    const defaultCandidates = this.collectFieldDefaultCandidates(targetField);
    const rawValues = Array.isArray(targetField?.picklistValues)
      ? targetField.picklistValues
      : Array.isArray(targetField?.pickListValues)
        ? targetField.pickListValues
        : [];

    for (const entry of rawValues) {
      const rawId = entry?.value ?? entry?.id ?? entry?.code ?? entry?.picklistValue;
      const id = Number(rawId);
      if (!Number.isFinite(id)) continue;
      const isExplicitDefault =
        typeof entry?.isDefault === 'boolean'
          ? entry.isDefault
          : typeof entry?.isDefaultValue === 'boolean'
            ? entry.isDefaultValue
            : typeof entry?.defaultValue === 'boolean'
              ? entry.defaultValue
              : typeof entry?.default === 'boolean'
                ? entry.default
                : false;
      if (isExplicitDefault || defaultCandidates.has(String(rawId).trim())) {
        return id;
      }
    }

    return null;
  }

  /**
   * Get ticket by ID (read-only)
   */
  async getTicket(ticketId: number): Promise<AutotaskTicket> {
    const response = await this.request<{ pageDetails?: { id: number }; records?: AutotaskTicket[]; items?: AutotaskTicket[]; item?: AutotaskTicket }>(
      `/tickets/${ticketId}`
    );
    const rows = this.extractCollection(response);
    if (!rows[0]) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    return rows[0];
  }

  /**
   * Search tickets by query (read-only)
   */
  async searchTickets(filter: string, pageSize: number = 25, pageNumber: number = 0) {
    void pageNumber; // Autotask REST query pagination uses nextPageUrl/prevPageUrl, not pageNumber.
    const response = await this.request<{ pageDetails?: unknown; records?: AutotaskTicket[]; items?: AutotaskTicket[] }>(
      '/tickets/query',
      { search: this.buildSearchParam(filter, pageSize) }
    );
    return this.extractCollection(response);
  }

  async getTicketByTicketNumber(ticketNumber: string): Promise<AutotaskTicket> {
    const results = await this.searchTickets(
      JSON.stringify({ op: 'eq', field: 'ticketNumber', value: ticketNumber }),
      5,
      0
    );
    const exact = results.find(t => String((t as any)?.ticketNumber || '').trim().toUpperCase() === ticketNumber.trim().toUpperCase());
    if (!exact) {
      throw new Error(`Ticket ${ticketNumber} not found in Autotask query`);
    }
    return exact;
  }

  /**
   * Get company/account by ID (read-only)
   */
  async getCompany(companyId: number): Promise<Record<string, unknown>> {
    const response = await this.request<{ records?: Record<string, unknown>[]; items?: Record<string, unknown>[]; item?: Record<string, unknown> }>(
      `/companies/${companyId}`
    );
    const rows = this.extractCollection<Record<string, unknown>>(response);
    if (!rows[0]) {
      throw new Error(`Company ${companyId} not found`);
    }
    return rows[0];
  }

  /**
   * Get contact by ID (read-only)
   */
  async getContact(contactId: number): Promise<Record<string, unknown>> {
    const response = await this.request<{ records?: Record<string, unknown>[]; items?: Record<string, unknown>[]; item?: Record<string, unknown> }>(
      `/contacts/${contactId}`
    );
    const rows = this.extractCollection<Record<string, unknown>>(response);
    if (!rows[0]) {
      throw new Error(`Contact ${contactId} not found`);
    }
    return rows[0];
  }

  /**
   * Get resource by ID (read-only)
   */
  async getResource(resourceId: number): Promise<Record<string, unknown>> {
    const response = await this.request<{ records?: Record<string, unknown>[]; items?: Record<string, unknown>[]; item?: Record<string, unknown> }>(
      `/resources/${resourceId}`
    );
    const rows = this.extractCollection<Record<string, unknown>>(response);
    if (!rows[0]) {
      throw new Error(`Resource ${resourceId} not found`);
    }
    return rows[0];
  }

  /**
   * Get device information (read-only)
   */
  async getDevice(deviceId: number): Promise<AutotaskDevice> {
    const response = await this.request<{ pageDetails?: { id: number }; records?: AutotaskDevice[]; items?: AutotaskDevice[]; item?: AutotaskDevice }>(
      `/configurationItems/${deviceId}`
    );
    const rows = this.extractCollection(response);
    if (!rows[0]) {
      throw new Error(`Device ${deviceId} not found`);
    }
    return rows[0];
  }

  /**
   * Get all devices for a company (read-only)
   */
  async getDevicesByCompany(companyId: number, pageSize: number = 100) {
    const response = await this.request<{ pageDetails?: unknown; records?: AutotaskDevice[]; items?: AutotaskDevice[] }>(
      '/configurationItems/query',
      { pageSize, filter: `companyID eq ${companyId}` }
    );
    return this.extractCollection(response);
  }

  /**
   * Get ticket notes (read-only)
   */
  async getTicketNotes(ticketId: number) {
    const response = await this.request<{ records?: Array<{ id: number; noteType: string; noteText: string; createDate: string }>; items?: Array<{ id: number; noteType: string; noteText: string; createDate: string }> }>(
      `/tickets/${ticketId}/notes`
    );
    return this.extractCollection(response);
  }

  /**
   * Read queue picklist options from Tickets entity metadata.
   * This is more reliable than querying queue assignments because it returns the canonical queue labels.
   */
  private async getTicketFieldPicklist(fieldName: string): Promise<AutotaskPicklistOption[]> {
    const fields = await this.getEntityFields('/tickets');

    const targetField = fields.find((field: any) =>
      String(field?.name || field?.fieldName || '').toLowerCase() === fieldName.toLowerCase()
    );
    const fieldLevelDefaultCandidates = this.collectFieldDefaultCandidates(targetField);
    const rawValues = Array.isArray(targetField?.picklistValues)
      ? targetField.picklistValues
      : Array.isArray(targetField?.pickListValues)
        ? targetField.pickListValues
        : [];

    const options = rawValues
      .map((entry: any) => {
        const rawId = entry?.value ?? entry?.id ?? entry?.code ?? entry?.picklistValue;
        const id = Number(rawId);
        const label =
          String(
            entry?.label ??
            entry?.displayName ??
            entry?.text ??
            entry?.name ??
            ''
          ).trim();
        const isActive =
          typeof entry?.isActive === 'boolean'
            ? entry.isActive
            : (typeof entry?.isInactive === 'boolean' ? !entry.isInactive : undefined);
        const isDefault =
          typeof entry?.isDefault === 'boolean'
            ? entry.isDefault
            : typeof entry?.isDefaultValue === 'boolean'
              ? entry.isDefaultValue
              : typeof entry?.defaultValue === 'boolean'
                ? entry.defaultValue
                : typeof entry?.default === 'boolean'
                  ? entry.default
                  : fieldLevelDefaultCandidates.has(String(rawId).trim());
        if (!Number.isFinite(id) || !label) return null;
        return {
          id,
          label,
          ...(typeof isActive === 'boolean' ? { isActive } : {}),
          ...(typeof isDefault === 'boolean' ? { isDefault } : {}),
        };
      })
      .filter((q: AutotaskQueueOption | null): q is AutotaskQueueOption => Boolean(q));

    const deduped = new Map<number, AutotaskPicklistOption>();
    for (const option of options) {
      if (!deduped.has(option.id)) deduped.set(option.id, option);
    }
    return Array.from(deduped.values());
  }

  async getTicketQueues(): Promise<AutotaskQueueOption[]> {
    return this.getTicketFieldPicklist('queueID');
  }

  async getTicketStatusOptions(): Promise<AutotaskPicklistOption[]> {
    return this.getTicketFieldPicklist('status');
  }

  async getTicketPriorityOptions(): Promise<AutotaskPicklistOption[]> {
    return this.getTicketFieldPicklist('priority');
  }

  async getTicketIssueTypeOptions(): Promise<AutotaskPicklistOption[]> {
    return this.getTicketFieldPicklist('issueType');
  }

  async getTicketSubIssueTypeOptions(): Promise<AutotaskPicklistOption[]> {
    return this.getTicketFieldPicklist('subIssueType');
  }

  async getTicketServiceLevelAgreementOptions(): Promise<AutotaskPicklistOption[]> {
    return this.getTicketFieldPicklist('serviceLevelAgreementID');
  }

  async getTicketDraftDefaults(): Promise<AutotaskTicketDraftDefaults> {
    const [queue, status, priority, issueType, subIssueType, serviceLevelAgreement] = await Promise.all([
      this.getTicketQueues().catch(() => []),
      this.getTicketStatusOptions().catch(() => []),
      this.getTicketPriorityOptions().catch(() => []),
      this.getTicketIssueTypeOptions().catch(() => []),
      this.getTicketSubIssueTypeOptions().catch(() => []),
      this.getTicketServiceLevelAgreementOptions().catch(() => []),
    ]);

    const defaults: AutotaskTicketDraftDefaults = {
      ticketCategoryId: null,
      status: this.pickPreferredDraftOption('status', status),
      priority: this.pickPreferredDraftOption('priority', priority),
      issueType: this.pickPreferredDraftOption('issueType', issueType),
      subIssueType: this.pickPreferredDraftOption('subIssueType', subIssueType),
      serviceLevelAgreement: this.pickPreferredDraftOption('serviceLevelAgreementID', serviceLevelAgreement),
      queue: this.pickPreferredDraftOption('queueID', queue),
    };

    const ticketCategoryId = await this.getTicketDefaultCategoryId().catch(() => null);
    if (!Number.isFinite(ticketCategoryId)) return defaults;

    defaults.ticketCategoryId = Number(ticketCategoryId);

    try {
      const rows = await this.queryEntity<Record<string, unknown>>(
        '/ticketCategoryFieldDefaults',
        [{ op: 'eq', field: 'ticketCategoryID', value: Number(ticketCategoryId) }],
        5
      );
      const categoryDefaults = rows[0];
      if (!categoryDefaults) return defaults;

      const readDefault = (...keys: string[]) => {
        for (const key of keys) {
          if (categoryDefaults[key] !== undefined && categoryDefaults[key] !== null) {
            return categoryDefaults[key];
          }
        }
        return null;
      };

      defaults.status = this.resolveOptionById(status, readDefault('status', 'Status')) || defaults.status;
      defaults.priority = this.resolveOptionById(priority, readDefault('priority', 'Priority')) || defaults.priority;
      defaults.issueType = this.resolveOptionById(issueType, readDefault('issueType', 'issueTypeID', 'IssueType', 'IssueTypeID')) || defaults.issueType;
      defaults.subIssueType =
        this.resolveOptionById(subIssueType, readDefault('subIssueType', 'subIssueTypeID', 'SubIssueType', 'SubIssueTypeID')) ||
        defaults.subIssueType;
      defaults.serviceLevelAgreement =
        this.resolveOptionById(
          serviceLevelAgreement,
          readDefault(
            'serviceLevelAgreementID',
            'serviceLevelAgreementId',
            'ServiceLevelAgreementID',
            'ServiceLevelAgreementId'
          )
        ) ||
        defaults.serviceLevelAgreement;
      defaults.queue =
        this.resolveOptionById(queue, readDefault('queueID', 'queueId', 'QueueID', 'QueueId')) ||
        defaults.queue;
    } catch {
      // Keep metadata-based defaults if category defaults are unavailable for this tenant.
    }

    return defaults;
  }

  private async getTicketNoteFieldPicklist(fieldName: string): Promise<AutotaskPicklistOption[]> {
    const fields = await this.getEntityFields('/ticketNotes');
    const targetField = fields.find((field: any) =>
      String(field?.name || field?.fieldName || '').toLowerCase() === fieldName.toLowerCase()
    );
    const rawValues = Array.isArray(targetField?.picklistValues)
      ? targetField.picklistValues
      : Array.isArray(targetField?.pickListValues)
        ? targetField.pickListValues
        : [];
    return rawValues
      .map((entry: any) => {
        const rawId = entry?.value ?? entry?.id ?? entry?.code ?? entry?.picklistValue;
        const id = Number(rawId);
        const label = String(entry?.label ?? entry?.displayName ?? entry?.text ?? entry?.name ?? '').trim();
        if (!Number.isFinite(id) || !label) return null;
        return { id, label };
      })
      .filter((option: AutotaskPicklistOption | null): option is AutotaskPicklistOption => Boolean(option));
  }

  private mapPicklistLabelToId(
    options: AutotaskPicklistOption[],
    rawValue: unknown,
    fallbackMatchers: string[] = []
  ): number | undefined {
    const raw = String(rawValue ?? '').trim().toLowerCase();
    if (!raw) return undefined;
    if (/^\d+$/.test(raw)) return Number(raw);
    const exact = options.find((option) => option.label.trim().toLowerCase() === raw);
    if (exact) return exact.id;
    for (const matcher of fallbackMatchers) {
      const candidate = options.find((option) => option.label.trim().toLowerCase().includes(matcher));
      if (candidate) return candidate.id;
    }
    return undefined;
  }

  async createTicket(payload: Record<string, unknown>): Promise<AutotaskTicket> {
    const response = await this.requestJson<{
      item?: AutotaskTicket;
      items?: AutotaskTicket[];
      records?: AutotaskTicket[];
      id?: number | string;
      itemId?: number | string;
    }>(
      'POST',
      '/tickets',
      { body: payload }
    );
    const rows = this.extractCollection(response);
    if (!rows[0]) {
      const createdId = Number((response as any)?.itemId ?? (response as any)?.id);
      if (Number.isFinite(createdId) && createdId > 0) {
        return this.getTicket(createdId);
      }
      throw new Error('Autotask createTicket returned no ticket');
    }
    return rows[0];
  }

  private async resolveTicketEntityId(ticketId: number | string): Promise<number> {
    if (typeof ticketId === 'number' && Number.isFinite(ticketId)) return ticketId;
    const raw = String(ticketId ?? '').trim();
    if (!raw) throw new Error('ticketId is required');
    if (/^\d+$/.test(raw)) return Number(raw);
    const ticket = await this.getTicketByTicketNumber(raw);
    const resolved = Number((ticket as any)?.id);
    if (!Number.isFinite(resolved)) {
      throw new Error(`Autotask ticket entity ID not found for ${raw}`);
    }
    return resolved;
  }

  async updateTicket(ticketId: number | string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const resolvedTicketId = await this.resolveTicketEntityId(ticketId);
    // Autotask update contract uses PATCH /tickets with entity id in body.
    return this.requestJson<Record<string, unknown>>('PATCH', '/tickets', {
      body: {
        id: resolvedTicketId,
        ...payload,
      },
    });
  }

  async updateTicketPriority(ticketId: number | string, priority: number): Promise<Record<string, unknown>> {
    return this.updateTicket(ticketId, { priority });
  }

  async deleteTicket(ticketId: number | string): Promise<Record<string, unknown>> {
    const resolvedTicketId = await this.resolveTicketEntityId(ticketId);
    return this.requestJson<Record<string, unknown>>('DELETE', `/tickets/${encodeURIComponent(String(resolvedTicketId))}`);
  }

  async createTicketNote(ticketId: number | string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const resolvedTicketId = await this.resolveTicketEntityId(ticketId);
    const body: Record<string, unknown> = { ...payload };
    if (body.description === undefined && typeof body.noteText === 'string') {
      body.description = body.noteText;
    }
    if (body.title === undefined) {
      const source = typeof body.noteText === 'string' ? body.noteText : typeof body.description === 'string' ? body.description : '';
      const firstLine = String(source).split('\n')[0]?.trim() || '';
      body.title = (firstLine || 'Cerebro workflow update').slice(0, 250);
    }
    if (typeof body.noteType === 'string' || typeof body.publish === 'boolean' || typeof body.publish === 'string') {
      try {
        const [noteTypeOptions, publishOptions] = await Promise.all([
          this.getTicketNoteFieldPicklist('noteType'),
          this.getTicketNoteFieldPicklist('publish'),
        ]);
        if (typeof body.noteType === 'string') {
          const mappedNoteType = this.mapPicklistLabelToId(noteTypeOptions, body.noteType, [
            String(body.noteType).trim().toLowerCase(),
          ]);
          if (mappedNoteType !== undefined) body.noteType = mappedNoteType;
        }
        if (typeof body.publish === 'boolean') {
          const mappedPublish = body.publish
            ? this.mapPicklistLabelToId(publishOptions, 'all autotask users', ['all autotask users', 'all'])
            : this.mapPicklistLabelToId(publishOptions, 'internal', ['internal']);
          if (mappedPublish !== undefined) body.publish = mappedPublish;
        } else if (typeof body.publish === 'string') {
          const mappedPublish = this.mapPicklistLabelToId(publishOptions, body.publish, [
            String(body.publish).trim().toLowerCase(),
          ]);
          if (mappedPublish !== undefined) body.publish = mappedPublish;
        }
      } catch {
        // Keep original payload if metadata lookup is unavailable.
      }
    }
    return this.requestJson<Record<string, unknown>>(
      'POST',
      `/tickets/${encodeURIComponent(String(resolvedTicketId))}/notes`,
      { body }
    );
  }

  async updateTicketNote(
    ticketId: number | string,
    noteId: number,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const resolvedTicketId = await this.resolveTicketEntityId(ticketId);
    return this.requestJson<Record<string, unknown>>(
      'PATCH',
      `/tickets/${encodeURIComponent(String(resolvedTicketId))}/notes`,
      {
        body: {
          id: noteId,
          ...payload,
        },
      }
    );
  }

  async createTicketAttachment(
    ticketId: number | string,
    payload: {
      title: string;
      fileName: string;
      contentType: string;
      dataBase64: string;
    }
  ): Promise<Record<string, unknown>> {
    const resolvedTicketId = await this.resolveTicketEntityId(ticketId);
    const fileName = String(payload.fileName || '').trim();
    const title = String(payload.title || fileName || 'Attachment').trim();
    const contentType = String(payload.contentType || 'application/octet-stream').trim();
    const data = String(payload.dataBase64 || '')
      .replace(/^data:[^;]+;base64,/i, '')
      .trim();
    if (!fileName || !data) {
      throw new Error('fileName and dataBase64 are required for TicketAttachment');
    }

    return this.requestJson<Record<string, unknown>>(
      'POST',
      `/tickets/${encodeURIComponent(String(resolvedTicketId))}/attachments`,
      {
        body: {
          attachmentInfo: {
            title,
            fullPath: fileName,
            contentType,
            data,
          },
        },
      }
    );
  }

  async getTicketChecklistItems(ticketId: number | string): Promise<Record<string, unknown>[]> {
    const resolvedTicketId = await this.resolveTicketEntityId(ticketId);
    const response = await this.request<{ records?: Record<string, unknown>[]; items?: Record<string, unknown>[]; item?: Record<string, unknown> }>(
      `/tickets/${encodeURIComponent(String(resolvedTicketId))}/checklistItems`
    );
    return this.extractCollection(response);
  }

  async createTicketChecklistItem(
    ticketId: number | string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const resolvedTicketId = await this.resolveTicketEntityId(ticketId);
    return this.requestJson<Record<string, unknown>>(
      'POST',
      `/tickets/${encodeURIComponent(String(resolvedTicketId))}/checklistItems`,
      { body: payload }
    );
  }

  async updateTicketChecklistItem(
    ticketId: number | string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const resolvedTicketId = await this.resolveTicketEntityId(ticketId);
    return this.requestJson<Record<string, unknown>>(
      'PATCH',
      `/tickets/${encodeURIComponent(String(resolvedTicketId))}/checklistItems`,
      { body: payload }
    );
  }

  async deleteTicketChecklistItem(ticketId: number | string, checklistItemId: number): Promise<Record<string, unknown>> {
    const resolvedTicketId = await this.resolveTicketEntityId(ticketId);
    return this.requestJson<Record<string, unknown>>(
      'DELETE',
      `/tickets/${encodeURIComponent(String(resolvedTicketId))}/checklistItems/${encodeURIComponent(String(checklistItemId))}`
    );
  }

  async createTimeEntry(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>('POST', '/timeEntries', { body: payload });
  }

  async updateTimeEntry(timeEntryId: number, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>('PATCH', '/timeEntries', {
      body: { id: timeEntryId, ...payload },
    });
  }

  async deleteTimeEntry(timeEntryId: number): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>('DELETE', `/timeEntries/${encodeURIComponent(String(timeEntryId))}`);
  }

  async searchContacts(filter: string, pageSize: number = 25): Promise<Record<string, unknown>[]> {
    const response = await this.request<{ records?: Record<string, unknown>[]; items?: Record<string, unknown>[]; item?: Record<string, unknown> }>(
      '/contacts/query',
      { search: this.buildSearchParam(filter, pageSize) }
    );
    return this.extractCollection(response);
  }

  async createContact(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>('POST', '/contacts', { body: payload });
  }

  async updateContact(contactId: number, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>('PATCH', '/contacts', {
      body: { id: contactId, ...payload },
    });
  }

  async searchCompanies(filter: string, pageSize: number = 25): Promise<Record<string, unknown>[]> {
    const response = await this.request<{ records?: Record<string, unknown>[]; items?: Record<string, unknown>[]; item?: Record<string, unknown> }>(
      '/companies/query',
      { search: this.buildSearchParam(filter, pageSize) }
    );
    return this.extractCollection(response);
  }

  async searchResources(filter: string, pageSize: number = 25): Promise<Record<string, unknown>[]> {
    const response = await this.request<{ records?: Record<string, unknown>[]; items?: Record<string, unknown>[]; item?: Record<string, unknown> }>(
      '/resources/query',
      { search: this.buildSearchParam(filter, pageSize) }
    );
    return this.extractCollection(response);
  }

  async createCompany(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>('POST', '/companies', { body: payload });
  }

  async updateCompany(companyId: number, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.requestJson<Record<string, unknown>>('PATCH', '/companies', {
      body: { id: companyId, ...payload },
    });
  }
}
