// ─────────────────────────────────────────────────────────────
// IT Glue API Client (Read-only)
// Documentation: https://api.itglue.com/developer
// ─────────────────────────────────────────────────────────────

import type { ITGlueDocument } from '@playbook-brain/types';

export interface ITGlueConfig {
  apiKey: string;
  /**
   * Region base URL. Defaults to US.
   * US: https://api.itglue.com
   * EU: https://api.eu.itglue.com
   * AU: https://api.au.itglue.com
   */
  baseUrl?: string;
}

export class ITGlueClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ITGlueConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.itglue.com').replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, params?: Record<string, string | number | boolean>) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        // IT Glue uses x-api-key header (lowercase)
        'x-api-key': this.apiKey,
        // Content-Type for GET must NOT be application/vnd.api+json (no body)
        // Only include it for write operations
      },
    });

    if (!response.ok) {
      throw new Error(`IT Glue API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  }

  async getOrganizations(pageSize: number = 100) {
    const response = await this.request<{
      data: Array<{ id: string; attributes: { name: string; short_name?: string; primary_domain?: string; organization_status_name?: string } }>;
      meta: { total_count: number };
    }>('/organizations', {
      'page[size]': pageSize,
      'sort': 'name',
    });
    return response.data;
  }

  async searchDocuments(query: string, organizationId?: string, pageSize: number = 50) {
    const params: Record<string, string | number | boolean> = {
      'filter[name]': query,
      'page[size]': pageSize,
    };
    
    if (organizationId) {
      params['filter[organization_id]'] = organizationId;
    }

    const response = await this.request<{
      data: ITGlueDocument[];
      meta: { pages: number };
    }>('/documents', params);
    return response.data;
  }

  async getDocument(documentId: string): Promise<ITGlueDocument> {
    const response = await this.request<{ data: ITGlueDocument }>(`/documents/${documentId}`);
    return response.data;
  }

  async getOrganizationDocuments(organizationId: string, pageSize: number = 50) {
    const response = await this.request<{
      data: ITGlueDocument[];
      meta: { pages: number };
    }>('/documents', {
      'filter[organization_id]': organizationId,
      'page[size]': pageSize,
    });
    return response.data;
  }

  async getDocumentsByType(documentType: string, pageSize: number = 50) {
    const response = await this.request<{ data: ITGlueDocument[] }>('/documents', {
      'filter[document_type]': documentType,
      'page[size]': pageSize,
    });
    return response.data;
  }

  async getRunbooks(organizationId?: string, pageSize: number = 50) {
    const params: Record<string, string | number | boolean> = {
      'filter[document_type]': 'Runbooks',
      'page[size]': pageSize,
    };
    
    if (organizationId) {
      params['filter[organization_id]'] = organizationId;
    }

    const response = await this.request<{ data: ITGlueDocument[] }>('/documents', params);
    return response.data;
  }

  async getFlexibleAssetTypes(pageSize: number = 50) {
    const response = await this.request<{
      data: Array<{ id: string; attributes: { name: string } }>;
    }>('/flexible_asset_types', {
      'page[size]': pageSize,
    });
    return response.data;
  }

  async getFlexibleAssets(assetTypeId: string, organizationId?: string, pageSize: number = 50) {
    const params: Record<string, string | number | boolean> = {
      'filter[flexible_asset_type_id]': assetTypeId,
      'page[size]': pageSize,
    };
    
    if (organizationId) {
      params['filter[organization_id]'] = organizationId;
    }

    const response = await this.request<{
      data: Array<{ id: string; attributes: Record<string, unknown> }>;
    }>('/flexible_assets', params);
    return response.data;
  }

  async getOrganizationById(orgId: string) {
    const response = await this.request<{
      data: { id: string; attributes: { name: string; short_name?: string; primary_domain?: string; organization_status_name?: string; quick_notes?: string } };
    }>(`/organizations/${orgId}`);
    return response.data;
  }

  async getConfigurations(organizationId: string, pageSize: number = 50) {
    const response = await this.request<{
      data: Array<{ id: string; attributes: { name: string; hostname?: string; primary_ip?: string; configuration_type_name?: string; operating_system_name?: string; contact_name?: string; location_name?: string; active?: boolean } }>;
      meta: { total_count: number };
    }>('/configurations', {
      'filter[organization_id]': organizationId,
      'page[size]': pageSize,
    });
    return response.data;
  }

  async getContacts(organizationId: string, pageSize: number = 50) {
    const response = await this.request<{
      data: Array<{ id: string; attributes: { first_name?: string; last_name?: string; name?: string; title?: string; contact_type_name?: string; primary_email?: string; primary_phone?: string } }>;
      meta: { total_count: number };
    }>('/contacts', {
      'filter[organization_id]': organizationId,
      'page[size]': pageSize,
    });
    return response.data;
  }

  async getPasswords(organizationId: string, pageSize: number = 50) {
    const response = await this.request<{
      data: Array<{ id: string; attributes: { name: string; username?: string; url?: string; notes?: string } }>;
      meta: { total_count: number };
    }>('/passwords', {
      'filter[organization_id]': organizationId,
      'page[size]': pageSize,
    });
    return response.data;
  }}