// ─────────────────────────────────────────────────────────────
// Enrichment Cache
// Hash, extraction-input builders, and LLM-backed enrichment
// refresh for IT Glue and NinjaOne org snapshots.
// ─────────────────────────────────────────────────────────────
import crypto from 'crypto';

import { callLLM } from '../ai/llm-adapter.js';
import { operationalLogger } from '../../lib/operational-logger.js';
import { extractJsonObject, itgAttr } from './prepare-context-helpers.js';
import {
    getItglueOrgEnriched,
    upsertItglueOrgEnriched,
    getNinjaOrgEnriched,
    upsertNinjaOrgEnriched,
} from './persistence.js';
import type {
    ItglueEnrichedPayload,
    ItglueEnrichedField,
    NinjaEnrichedPayload,
    NinjaEnrichedField,
} from './prepare-context.types.js';

const ITGLUE_EXTRACTOR_VERSION = 'v2-summary-2026-02-23';
const NINJA_EXTRACTOR_VERSION = 'v1-summary-2026-02-23';

// ─── Hash helpers ─────────────────────────────────────────────

export function hashSnapshot(snapshot: Record<string, unknown>): string {
    const json = JSON.stringify(snapshot);
    return crypto.createHash('sha256').update(`${ITGLUE_EXTRACTOR_VERSION}:${json}`).digest('hex');
}

export function hashSnapshotWithVersion(snapshot: Record<string, unknown>, version: string): string {
    const json = JSON.stringify(snapshot);
    return crypto.createHash('sha256').update(`${version}:${json}`).digest('hex');
}

export function pickEnrichedValue(payload: ItglueEnrichedPayload | null, key: string): string | null {
    if (!payload || !payload.fields || !payload.fields[key]) return null;
    const value = String(payload.fields[key]?.value || '').trim();
    if (!value || value.toLowerCase() === 'unknown') return null;
    return value;
}

// ─── Extraction input builders ────────────────────────────────

export function buildItglueExtractionInput(snapshot: Record<string, unknown>): Record<string, unknown> {
    const configs = Array.isArray((snapshot as any).configs) ? (snapshot as any).configs : [];
    const passwords = Array.isArray((snapshot as any).passwords) ? (snapshot as any).passwords : [];
    const assets = Array.isArray((snapshot as any).assets) ? (snapshot as any).assets : [];
    const docs = Array.isArray((snapshot as any).docs) ? (snapshot as any).docs : [];
    const documentsRaw = Array.isArray((snapshot as any).documents_raw) ? (snapshot as any).documents_raw : [];
    const documentAttachmentsById = ((snapshot as any).document_attachments_by_id && typeof (snapshot as any).document_attachments_by_id === 'object')
        ? (snapshot as any).document_attachments_by_id
        : {};
    const documentRelatedItemsById = ((snapshot as any).document_related_items_by_id && typeof (snapshot as any).document_related_items_by_id === 'object')
        ? (snapshot as any).document_related_items_by_id
        : {};
    const locations = Array.isArray((snapshot as any).locations) ? (snapshot as any).locations : [];
    const domains = Array.isArray((snapshot as any).domains) ? (snapshot as any).domains : [];
    const sslCertificates = Array.isArray((snapshot as any).ssl_certificates) ? (snapshot as any).ssl_certificates : [];
    const contacts = Array.isArray((snapshot as any).contacts) ? (snapshot as any).contacts : [];

    return {
        org_id: (snapshot as any).org_id,
        org_name: (snapshot as any).org_name,
        organization_details: (snapshot as any).organization_details || {},
        configs: configs.slice(0, 200).map((c: any) => ({
            id: c?.id,
            name: itgAttr(c?.attributes || {}, 'name') || c?.name,
            manufacturer:
                itgAttr(c?.attributes || {}, 'manufacturer_name') ||
                itgAttr(c?.attributes || {}, 'manufacturer') ||
                c?.manufacturer,
            model:
                itgAttr(c?.attributes || {}, 'model_name') ||
                itgAttr(c?.attributes || {}, 'model') ||
                c?.model,
            type:
                itgAttr(c?.attributes || {}, 'configuration_type_name') ||
                itgAttr(c?.attributes || {}, 'type'),
        })),
        passwords: passwords.slice(0, 200).map((p: any) => ({
            id: p?.id,
            name: itgAttr(p?.attributes || {}, 'name') || p?.name,
            username:
                itgAttr(p?.attributes || {}, 'username') ||
                itgAttr(p?.attributes || {}, 'user_name') ||
                p?.username,
            resource:
                itgAttr(p?.attributes || {}, 'resource_name') ||
                itgAttr(p?.attributes || {}, 'resource') ||
                p?.resource,
            category:
                itgAttr(p?.attributes || {}, 'password_category_name') ||
                itgAttr(p?.attributes || {}, 'category') ||
                p?.category,
        })),
        contacts: contacts.slice(0, 200).map((x: any) => ({
            id: x?.id,
            name:
                itgAttr(x?.attributes || {}, 'name') ||
                [
                    itgAttr(x?.attributes || {}, 'first_name'),
                    itgAttr(x?.attributes || {}, 'last_name'),
                ]
                    .filter(Boolean)
                    .join(' '),
            email: itgAttr(x?.attributes || {}, 'primary_email'),
            phone: itgAttr(x?.attributes || {}, 'primary_phone'),
            type: itgAttr(x?.attributes || {}, 'contact_type_name'),
        })),
        assets: assets.slice(0, 200).map((a: any) => ({
            id: a?.id,
            name: itgAttr(a?.attributes || {}, 'name') || a?.name,
            type:
                itgAttr(a?.attributes || {}, 'flexible_asset_type_name') ||
                itgAttr(a?.attributes || {}, 'type'),
            provider:
                itgAttr(a?.attributes || {}, 'provider') ||
                itgAttr(a?.attributes || {}, 'isp') ||
                itgAttr(a?.attributes || {}, 'carrier'),
            location:
                itgAttr(a?.attributes || {}, 'location') ||
                itgAttr(a?.attributes || {}, 'locations') ||
                itgAttr(a?.attributes || {}, 'site') ||
                itgAttr(a?.attributes || {}, 'address'),
        })),
        locations: locations.slice(0, 200).map((x: any) => ({
            id: x?.id,
            name: itgAttr(x?.attributes || {}, 'name') || x?.name,
            city: itgAttr(x?.attributes || {}, 'city'),
            state:
                itgAttr(x?.attributes || {}, 'region_name') ||
                itgAttr(x?.attributes || {}, 'state'),
            country:
                itgAttr(x?.attributes || {}, 'country_name') ||
                itgAttr(x?.attributes || {}, 'country'),
        })),
        domains: domains.slice(0, 200).map((x: any) => ({
            id: x?.id,
            name: itgAttr(x?.attributes || {}, 'name') || x?.name,
        })),
        ssl_certificates: sslCertificates.slice(0, 200).map((x: any) => ({
            id: x?.id,
            name: itgAttr(x?.attributes || {}, 'name') || x?.name,
            active: itgAttr(x?.attributes || {}, 'active'),
            issued_by: itgAttr(x?.attributes || {}, 'issued_by'),
        })),
        docs: docs.slice(0, 50).map((d: any) => ({
            id: d?.id,
            title: d?.title || d?.name,
        })),
        documents_raw: documentsRaw.slice(0, 100).map((d: any) => ({
            id: d?.id,
            name: itgAttr(d?.attributes || {}, 'name') || d?.name,
            type:
                itgAttr(d?.attributes || {}, 'document_type_name') ||
                itgAttr(d?.attributes || {}, 'document_type') ||
                d?.documentType,
            updated_at: itgAttr(d?.attributes || {}, 'updated_at') || d?.updatedAt,
        })),
        document_attachments_sample: Object.entries(documentAttachmentsById)
            .slice(0, 50)
            .map(([docId, items]: [string, any]) => ({
                document_id: docId,
                count: Array.isArray(items) ? items.length : 0,
                names: Array.isArray(items)
                    ? items
                        .slice(0, 5)
                        .map((x: any) => itgAttr(x?.attributes || {}, 'name') || itgAttr(x?.attributes || {}, 'file_name') || x?.name)
                        .filter(Boolean)
                    : [],
            })),
        document_related_items_sample: Object.entries(documentRelatedItemsById)
            .slice(0, 50)
            .map(([docId, items]: [string, any]) => ({
                document_id: docId,
                count: Array.isArray(items) ? items.length : 0,
                item_types: Array.isArray(items)
                    ? [...new Set(items
                        .slice(0, 20)
                        .map((x: any) => itgAttr(x?.attributes || {}, 'resource_type') || itgAttr(x?.attributes || {}, 'item_type') || 'unknown'))]
                    : [],
            })),
        collection_errors: Array.isArray((snapshot as any).collection_errors) ? (snapshot as any).collection_errors.slice(0, 20) : [],
    };
}

export function buildNinjaExtractionInput(snapshot: Record<string, unknown>): Record<string, unknown> {
    const devices = Array.isArray((snapshot as any).devices) ? (snapshot as any).devices : [];
    const alerts = Array.isArray((snapshot as any).alerts) ? (snapshot as any).alerts : [];
    const softwareInventory = Array.isArray((snapshot as any).software_inventory_query) ? (snapshot as any).software_inventory_query : [];
    const checks = Array.isArray((snapshot as any).selected_device_checks) ? (snapshot as any).selected_device_checks : [];
    const contextSignals = Array.isArray((snapshot as any).selected_device_context_signals) ? (snapshot as any).selected_device_context_signals : [];
    const selectedDevice = (snapshot as any).selected_device || {};
    const selectedDeviceDetails = (snapshot as any).selected_device_details || {};

    return {
        org_id: (snapshot as any).org_id,
        org_name: (snapshot as any).org_name,
        organization_details: (snapshot as any).organization_details || {},
        device_count: devices.length,
        alert_count: alerts.length,
        selected_device: {
            id: selectedDevice.id,
            hostname: selectedDevice.hostname || selectedDevice.systemName,
            os_name: selectedDevice.osName,
            os_version: selectedDevice.osVersion,
            ip_address: selectedDevice.ipAddress,
            last_contact: selectedDevice.lastContact || selectedDevice.lastActivityTime,
            online: selectedDevice.online,
        },
        selected_device_details: {
            hostname: selectedDeviceDetails.hostname,
            os_name: selectedDeviceDetails.osName,
            os_version: selectedDeviceDetails.osVersion,
            ip_address: selectedDeviceDetails.ipAddress,
            last_activity_time: selectedDeviceDetails.lastActivityTime,
            properties: selectedDeviceDetails.properties || {},
        },
        selected_device_checks: checks.slice(0, 100),
        selected_device_context_signals: contextSignals.slice(0, 100).map((s: any) => ({
            id: s?.id,
            type: s?.type,
            summary: s?.summary,
            timestamp: s?.timestamp,
        })),
        recent_alerts: alerts.slice(0, 100).map((a: any) => ({
            uid: a?.uid,
            severity: a?.severity,
            message: a?.message,
            device_id: a?.deviceId,
            device_name: a?.deviceName,
        })),
        software_inventory_query: softwareInventory.slice(0, 300).map((row: any) => ({
            device_id: row?.deviceId,
            name: row?.name,
            version: row?.version,
            publisher: row?.publisher,
            timestamp: row?.timestamp,
        })),
        devices_sample: devices.slice(0, 200).map((d: any) => ({
            id: d?.id,
            hostname: d?.hostname || d?.systemName,
            os_name: d?.osName,
            os_version: d?.osVersion,
            ip_address: d?.ipAddress,
            last_contact: d?.lastContact || d?.lastActivityTime,
            online: d?.online,
        })),
        logged_in_user: (snapshot as any).logged_in_user || '',
        logged_in_at: (snapshot as any).logged_in_at || '',
        resolved_device_score: (snapshot as any).resolved_device_score ?? null,
        collection_errors: Array.isArray((snapshot as any).collection_errors) ? (snapshot as any).collection_errors.slice(0, 20) : [],
    };
}

// ─── LLM-backed enrichment refresh ───────────────────────────

export async function getOrRefreshItglueEnriched(input: {
    orgId: string;
    snapshot: Record<string, unknown>;
    sourceHash: string;
}): Promise<ItglueEnrichedPayload | null> {
    const cached = await getItglueOrgEnriched(input.orgId);
    const ttlMs = 24 * 60 * 60 * 1000;
    if (cached) {
        const updatedAt = new Date(cached.updated_at || cached.created_at || 0).getTime();
        const isFresh = Number.isFinite(updatedAt) && (Date.now() - updatedAt) < ttlMs;
        if (isFresh && cached.source_hash === input.sourceHash) {
            return cached.payload as unknown as ItglueEnrichedPayload;
        }
    }

    const summary = buildItglueExtractionInput(input.snapshot);
    const prompt = `You are an IT Glue data extractor. Given a JSON summary of ALL configs, passwords, assets, and docs for an organization, extract ONLY the fields below and return valid JSON.\n\nRules:\n1. If value unknown, set value to \"unknown\" and confidence to 0.\n2. Include evidence_refs as JSON path hints (e.g., \"passwords[12].name\").\n3. Return ONLY JSON, no extra text.\n\nOutput schema:\n{\n  \"org_id\": \"string\",\n  \"source_hash\": \"string\",\n  \"fields\": {\n    \"firewall_make_model\": { \"value\": \"string\", \"confidence\": 0.0, \"source_system\": \"itglue\", \"evidence_refs\": [\"string\"] },\n    \"wifi_make_model\": { \"value\": \"string\", \"confidence\": 0.0, \"source_system\": \"itglue\", \"evidence_refs\": [\"string\"] },\n    \"switch_make_model\": { \"value\": \"string\", \"confidence\": 0.0, \"source_system\": \"itglue\", \"evidence_refs\": [\"string\"] },\n    \"isp_name\": { \"value\": \"string\", \"confidence\": 0.0, \"source_system\": \"itglue\", \"evidence_refs\": [\"string\"] }\n  }\n}\n\nSnapshot JSON:\n${JSON.stringify(summary).slice(0, 12000)}`;

    try {
        const llm = await callLLM(prompt);
        const parsed = extractJsonObject(llm.content);
        const fields = (parsed?.fields && typeof parsed.fields === 'object')
            ? (parsed.fields as Record<string, ItglueEnrichedField>)
            : {};
        const payload: ItglueEnrichedPayload = {
            org_id: String(parsed?.org_id || input.orgId),
            source_hash: String(parsed?.source_hash || input.sourceHash),
            fields,
            created_at: new Date().toISOString(),
        };
        await upsertItglueOrgEnriched(input.orgId, payload as unknown as Record<string, unknown>, input.sourceHash);
        return payload;
    } catch (error) {
        operationalLogger.error('context.enrichment_cache.itglue_enrichment_failed', error, {
            module: 'services.context.enrichment-cache',
            org_id: input.orgId,
            signal: 'integration_failure',
            degraded_mode: true,
        });
        return cached ? (cached.payload as unknown as ItglueEnrichedPayload) : null;
    }
}

export async function getOrRefreshNinjaEnriched(input: {
    orgId: string;
    snapshot: Record<string, unknown>;
    sourceHash: string;
}): Promise<NinjaEnrichedPayload | null> {
    const cached = await getNinjaOrgEnriched(input.orgId);
    const ttlMs = 24 * 60 * 60 * 1000;
    if (cached) {
        const updatedAt = new Date(cached.updated_at || cached.created_at || 0).getTime();
        const isFresh = Number.isFinite(updatedAt) && (Date.now() - updatedAt) < ttlMs;
        if (isFresh && cached.source_hash === input.sourceHash) {
            return cached.payload as unknown as NinjaEnrichedPayload;
        }
    }

    const summary = buildNinjaExtractionInput(input.snapshot);
    const prompt = `You are a NinjaOne data extractor. Given a JSON summary of endpoint and organization telemetry, extract ONLY the fields below and return valid JSON.

Rules:
1. If value unknown, set value to "unknown" and confidence to 0.
2. Include evidence_refs as JSON path hints (e.g., "selected_device.hostname", "selected_device_checks[2].name").
3. Return ONLY JSON.

Output schema:
{
  "org_id": "string",
  "source_hash": "string",
  "fields": {
    "device_name": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "device_type": { "value": "desktop|laptop|mobile|unknown", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "os_name": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "os_version": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "last_check_in": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "security_agent_name": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "security_agent_present": { "value": "present|absent|unknown", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "user_signed_in": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "public_ip": { "value": "string", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] },
    "vpn_state": { "value": "connected|disconnected|unknown", "confidence": 0.0, "source_system": "ninjaone", "evidence_refs": ["string"] }
  }
}

Snapshot JSON:
${JSON.stringify(summary).slice(0, 14000)}`;

    try {
        const llm = await callLLM(prompt);
        const parsed = extractJsonObject(llm.content);
        const fields = (parsed?.fields && typeof parsed.fields === 'object')
            ? (parsed.fields as Record<string, NinjaEnrichedField>)
            : {};
        const payload: NinjaEnrichedPayload = {
            org_id: String(parsed?.org_id || input.orgId),
            source_hash: String(parsed?.source_hash || input.sourceHash),
            fields,
            created_at: new Date().toISOString(),
        };
        await upsertNinjaOrgEnriched(input.orgId, payload as unknown as Record<string, unknown>, input.sourceHash);
        return payload;
    } catch (error) {
        operationalLogger.error('context.enrichment_cache.ninja_enrichment_failed', error, {
            module: 'services.context.enrichment-cache',
            org_id: input.orgId,
            signal: 'integration_failure',
            degraded_mode: true,
        });
        return cached ? (cached.payload as unknown as NinjaEnrichedPayload) : null;
    }
}
