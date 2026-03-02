// ─────────────────────────────────────────────────────────────
// NinjaOne API Client (Read-only)
// Documentation: https://app.ninjarmm.com/apidocs
// ─────────────────────────────────────────────────────────────

import type { NinjaOneDevice } from '@cerebro/types';
import { normalizeIntegrationError, throwFromHttpResponse } from '../errors.js';

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
  timeoutMs?: number;
}

export class NinjaOneClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private timeoutMs: number;
  private accessToken: string = '';
  private tokenExpiresAt: number = 0;

  constructor(config: NinjaOneConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    // Default to US region
    this.baseUrl = (config.baseUrl || 'https://app.ninjarmm.com').replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 15000;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt > Date.now()) {
      return this.accessToken;
    }

    // Correct endpoint: /ws/oauth/token (not /oauth/token)
    try {
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
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        await throwFromHttpResponse({
          integration: 'ninjaone',
          operation: 'POST /ws/oauth/token',
          response,
        });
      }

      const data = await response.json() as { access_token: string; expires_in: number };
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (error) {
      throw normalizeIntegrationError({
        integration: 'ninjaone',
        operation: 'POST /ws/oauth/token',
        error,
      });
    }
  }

  private async request<T>(endpoint: string, params?: Record<string, string | number>) {
    const token = await this.getAccessToken();
    const url = new URL(`${this.baseUrl}/api/v2${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        await throwFromHttpResponse({
          integration: 'ninjaone',
          operation: `GET /api/v2${endpoint}`,
          response,
        });
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      throw normalizeIntegrationError({
        integration: 'ninjaone',
        operation: `GET /api/v2${endpoint}`,
        error,
      });
    }
  }

  private async requestV2<T>(endpoint: string, params?: Record<string, string | number>) {
    const token = await this.getAccessToken();
    const url = new URL(`${this.baseUrl}/v2${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        await throwFromHttpResponse({
          integration: 'ninjaone',
          operation: `GET /v2${endpoint}`,
          response,
        });
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      throw normalizeIntegrationError({
        integration: 'ninjaone',
        operation: `GET /v2${endpoint}`,
        error,
      });
    }
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
    } catch (error) {
      const normalized = normalizeIntegrationError({
        integration: 'ninjaone',
        operation: `GET /api/v2/organizations/${organizationId}/devices`,
        error,
      });
      if (normalized.statusCode !== 404) throw normalized;
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
    try {
      return await this.request<{
        id: string;
        hostname: string;
        osName: string;
        osVersion: string;
        lastActivityTime: string;
        ipAddress: string;
        properties?: Record<string, unknown>;
        [key: string]: unknown;
      }>(`/devices/${deviceId}`);
    } catch (error) {
      const normalized = normalizeIntegrationError({
        integration: 'ninjaone',
        operation: `GET /api/v2/devices/${deviceId}`,
        error,
      });
      if (normalized.statusCode !== 404) throw normalized;
      // Official beta docs use singular resource for this endpoint.
      return this.requestV2<{
        id: string;
        hostname: string;
        osName: string;
        osVersion: string;
        lastActivityTime: string;
        ipAddress: string;
        properties?: Record<string, unknown>;
        [key: string]: unknown;
      }>(`/device/${deviceId}`);
    }
  }

  async getDeviceLastLoggedOnUser(deviceId: string): Promise<{ userName: string; logonTime?: number } | null> {
    try {
      return await this.requestV2<{ userName: string; logonTime?: number }>(`/device/${deviceId}/last-logged-on-user`);
    } catch (error) {
      const normalized = normalizeIntegrationError({
        integration: 'ninjaone',
        operation: `GET /v2/device/${deviceId}/last-logged-on-user`,
        error,
      });
      if (normalized.statusCode !== 404) throw normalized;
      return null;
    }
  }

  async listLastLoggedOnUsers(parameters?: { pageSize?: number; df?: string; cursor?: string }) {
    const params: Record<string, string | number> = {};
    if (parameters?.pageSize) params.pageSize = parameters.pageSize;
    if (parameters?.df) params.df = parameters.df;
    if (parameters?.cursor) params.cursor = parameters.cursor;
    return this.requestV2<{
      cursor?: { name?: string; offset?: number; count?: number; expires?: number };
      results?: Array<{ userName: string; logonTime?: number; deviceId: number }>;
    }>('/queries/logged-on-users', params);
  }

  async getDeviceActivities(deviceId: string, parameters?: { pageSize?: number }) {
    const params: Record<string, string | number> = {};
    if (parameters?.pageSize) params.pageSize = parameters.pageSize;
    const response = await this.requestV2<
      | {
      cursor?: { name?: string; offset?: number; count?: number; expires?: number };
      results?: Array<{
        id?: string | number;
        activityType?: string;
        activityClass?: string;
        activity?: string;
        message?: string;
        createTime?: number | string;
        timestamp?: number | string;
      }>;
    }
      | Array<{
      id?: string | number;
      activityType?: string;
      activityClass?: string;
      activity?: string;
      message?: string;
      createTime?: number | string;
      timestamp?: number | string;
    }>
    >(`/device/${deviceId}/activities`, params);
    return Array.isArray(response) ? response : Array.isArray(response?.results) ? response.results : [];
  }

  async getDeviceNetworkInterfaces(deviceId: string) {
    const response = await this.requestV2<
      | {
      results?: Array<{
        adapterName?: string;
        interfaceName?: string;
        ipAddress?: string[] | string;
        macAddress?: string[] | string;
        status?: string;
        defaultGateway?: string;
      }>;
    }
      | Array<{
      adapterName?: string;
      interfaceName?: string;
      ipAddress?: string[] | string;
      macAddress?: string[] | string;
      status?: string;
      defaultGateway?: string;
    }>
    >(`/device/${deviceId}/network-interfaces`);
    return Array.isArray(response) ? response : Array.isArray(response?.results) ? response.results : [];
  }

  async querySoftware(parameters?: { pageSize?: number; df?: string; cursor?: string }) {
    const params: Record<string, string | number> = {};
    if (parameters?.pageSize) params.pageSize = parameters.pageSize;
    if (parameters?.df) params.df = parameters.df;
    if (parameters?.cursor) params.cursor = parameters.cursor;
    const response = await this.requestV2<{
      cursor?: { name?: string; offset?: number; count?: number; expires?: number };
      results?: Array<{
        name?: string;
        version?: string;
        publisher?: string;
        deviceId?: number;
        timestamp?: number;
      }>;
    }>('/queries/software', params);
    return Array.isArray(response?.results) ? response.results : [];
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
