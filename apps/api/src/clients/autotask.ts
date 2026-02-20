// ─────────────────────────────────────────────────────────────
// Autotask API Client (Read-only)
// Documentation: https://webservices14.autotask.net/help/content/0_home.htm
// ─────────────────────────────────────────────────────────────

import type { AutotaskTicket, AutotaskDevice } from '@playbook-brain/types';

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

/** Discovery endpoint — acts as universal entry point for zone lookup */
const DISCOVERY_BASE = 'https://webservices2.autotask.net/atservicesrest/v1.0';

export class AutotaskClient {
  private config: AutotaskConfig;
  private zoneBase: string | null;

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
    const base = await this.discoverZone();
    const url = new URL(`${base}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, String(v)));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.authHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Autotask API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get ticket by ID (read-only)
   */
  async getTicket(ticketId: number): Promise<AutotaskTicket> {
    const response = await this.request<{ pageDetails: { id: number }; records: AutotaskTicket[] }>(
      `/tickets/${ticketId}`
    );
    if (!response.records[0]) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    return response.records[0];
  }

  /**
   * Search tickets by query (read-only)
   */
  async searchTickets(filter: string, pageSize: number = 25, pageNumber: number = 0) {
    const response = await this.request<{ pageDetails: unknown; records: AutotaskTicket[] }>(
      '/tickets/query',
      { pageSize, pageNumber, search: filter }
    );
    return response.records;
  }

  /**
   * Get device information (read-only)
   */
  async getDevice(deviceId: number): Promise<AutotaskDevice> {
    const response = await this.request<{ pageDetails: { id: number }; records: AutotaskDevice[] }>(
      `/configurationItems/${deviceId}`
    );
    if (!response.records[0]) {
      throw new Error(`Device ${deviceId} not found`);
    }
    return response.records[0];
  }

  /**
   * Get all devices for a company (read-only)
   */
  async getDevicesByCompany(companyId: number, pageSize: number = 100) {
    const response = await this.request<{ pageDetails: unknown; records: AutotaskDevice[] }>(
      '/configurationItems/query',
      { pageSize, filter: `companyID eq ${companyId}` }
    );
    return response.records;
  }

  /**
   * Get ticket notes (read-only)
   */
  async getTicketNotes(ticketId: number) {
    const response = await this.request<{ records: Array<{ id: number; noteType: string; noteText: string; createDate: string }> }>(
      `/tickets/${ticketId}/notes`
    );
    return response.records;
  }
}
