// ─────────────────────────────────────────────────────────────
// NinjaOne API Client (Read-only)
// Documentation: https://app.ninjarmm.com/apidocs
// ─────────────────────────────────────────────────────────────

import type { NinjaOneDevice } from '@playbook-brain/types';

interface NinjaOneConfig {
  clientId: string;
  clientSecret: string;
  /**
   * Region base URL. Defaults to US.
   * US: https://app.ninjarmm.com
   * EU: https://eu.ninjarmm.com
   * OC: https://oc.ninjarmm.com
   */
  baseUrl?: string;
}

export class NinjaOneClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private accessToken: string = '';
  private tokenExpiresAt: number = 0;

  constructor(config: NinjaOneConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    // Default to US region
    this.baseUrl = (config.baseUrl || 'https://app.ninjarmm.com').replace(/\/$/, '');
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt > Date.now()) {
      return this.accessToken;
    }

    // Correct endpoint: /ws/oauth/token (not /oauth/token)
    const response = await fetch(`${this.baseUrl}/ws/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'monitoring management control',
      }).toString(),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`NinjaOne auth error ${response.status}: ${body}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  private async request<T>(endpoint: string, params?: Record<string, string | number>) {
    const token = await this.getAccessToken();
    const url = new URL(`${this.baseUrl}/api/v2${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`NinjaOne API error: ${response.status}`);
    }

    const data = await response.json();
    return data as T;
  }

  async getDevice(deviceId: string): Promise<NinjaOneDevice> {
    const response = await this.request<NinjaOneDevice>(`/devices/${deviceId}`);
    return response;
  }

  async listDevices(parameters?: { limit?: number; after?: string }) {
    const params: Record<string, string | number> = {};
    if (parameters?.limit) params['pageSize'] = parameters.limit;
    if (parameters?.after) params['after'] = parameters.after;
    const response = await this.request<NinjaOneDevice[] | { data: NinjaOneDevice[]; pageDetails?: unknown }>(
      '/devices',
      params
    );
    return Array.isArray(response) ? response : ((response as { data?: NinjaOneDevice[] }).data ?? []);
  }

  async listDevicesByOrganization(organizationId: string, parameters?: { limit?: number }) {
    // Try org-scoped endpoint first; fall back to filtering all devices by org
    try {
      const params: Record<string, string | number> = {};
      if (parameters?.limit) params['pageSize'] = parameters.limit;
      const response = await this.request<NinjaOneDevice[] | { data: NinjaOneDevice[] }>(
        `/organizations/${organizationId}/devices`,
        params
      );
      const arr = Array.isArray(response) ? response : (response as { data?: NinjaOneDevice[] }).data ?? [];
      if (arr.length > 0) return arr;
    } catch {
      // fall through to global devices endpoint
    }

    // Fallback: list all devices and filter client-side
    const all = await this.listDevices({ limit: 500 });
    const orgIdNum = Number(organizationId);
    return all.filter((d) => Number(d.organizationId) === orgIdNum);
  }

  async getDeviceChecks(deviceId: string) {
    const response = await this.request<{
      data: Array<{
        id: string;
        name: string;
        status: string;
        lastCheck: string;
      }>;
    }>(`/devices/${deviceId}/checks`);
    return response.data;
  }

  async getDeviceDetails(deviceId: string) {
    const response = await this.request<{
      id: string;
      hostname: string;
      osName: string;
      osVersion: string;
      lastActivityTime: string;
      ipAddress: string;
      properties?: Record<string, unknown>;
      [key: string]: unknown;
    }>(`/devices/${deviceId}`);
    return response;
  }

  async listOrganizations() {
    const response = await this.request<Array<{ id: number; name: string; description?: string; [key: string]: unknown }>>('/organizations');
    return Array.isArray(response) ? response : [];
  }

  async getOrganization(orgId: string | number) {
    return this.request<{ id: number; name: string; [key: string]: unknown }>(`/organizations/${orgId}`);
  }

  async listAlerts(orgId?: string) {
    const params: Record<string, string | number> = {};
    if (orgId) params.sourceOrganizationId = orgId;
    const response = await this.request<Array<{
      uid: string;
      severity: string;
      message: string;
      deviceId?: number;
      deviceName?: string;
      sourceOrganizationId?: number;
      [key: string]: unknown;
    }>>('/alerts', params);
    return Array.isArray(response) ? response : [];
  }
}
