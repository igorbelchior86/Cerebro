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

type JsonRecord = Record<string, unknown>;

function asJsonRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function asJsonRecordArray(value: unknown): JsonRecord[] {
    return Array.isArray(value)
        ? value.filter((item): item is JsonRecord => typeof item === 'object' && item !== null)
        : [];
}

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
    const source = asJsonRecord(snapshot);
    const configs = asJsonRecordArray(source.configs);
    const passwords = asJsonRecordArray(source.passwords);
    const assets = asJsonRecordArray(source.assets);
    const docs = asJsonRecordArray(source.docs);
    const documentsRaw = asJsonRecordArray(source.documents_raw);
    const documentAttachmentsById = asJsonRecord(source.document_attachments_by_id);
    const documentRelatedItemsById = asJsonRecord(source.document_related_items_by_id);
    const locations = asJsonRecordArray(source.locations);
    const domains = asJsonRecordArray(source.domains);
    const sslCertificates = asJsonRecordArray(source.ssl_certificates);
    const contacts = asJsonRecordArray(source.contacts);

    return {
        org_id: source.org_id,
        org_name: source.org_name,
        organization_details: asJsonRecord(source.organization_details),
        configs: configs.slice(0, 200).map((config) => ({
            id: config.id,
            name: itgAttr(asJsonRecord(config.attributes), 'name') || config.name,
            manufacturer:
                itgAttr(asJsonRecord(config.attributes), 'manufacturer_name') ||
                itgAttr(asJsonRecord(config.attributes), 'manufacturer') ||
                config.manufacturer,
            model:
                itgAttr(asJsonRecord(config.attributes), 'model_name') ||
                itgAttr(asJsonRecord(config.attributes), 'model') ||
                config.model,
            type:
                itgAttr(asJsonRecord(config.attributes), 'configuration_type_name') ||
                itgAttr(asJsonRecord(config.attributes), 'type'),
        })),
        passwords: passwords.slice(0, 200).map((password) => ({
            id: password.id,
            name: itgAttr(asJsonRecord(password.attributes), 'name') || password.name,
            username:
                itgAttr(asJsonRecord(password.attributes), 'username') ||
                itgAttr(asJsonRecord(password.attributes), 'user_name') ||
                password.username,
            resource:
                itgAttr(asJsonRecord(password.attributes), 'resource_name') ||
                itgAttr(asJsonRecord(password.attributes), 'resource') ||
                password.resource,
            category:
                itgAttr(asJsonRecord(password.attributes), 'password_category_name') ||
                itgAttr(asJsonRecord(password.attributes), 'category') ||
                password.category,
        })),
        contacts: contacts.slice(0, 200).map((contact) => ({
            id: contact.id,
            name:
                itgAttr(asJsonRecord(contact.attributes), 'name') ||
                [
                    itgAttr(asJsonRecord(contact.attributes), 'first_name'),
                    itgAttr(asJsonRecord(contact.attributes), 'last_name'),
                ]
                    .filter(Boolean)
                    .join(' '),
            email: itgAttr(asJsonRecord(contact.attributes), 'primary_email'),
            phone: itgAttr(asJsonRecord(contact.attributes), 'primary_phone'),
            type: itgAttr(asJsonRecord(contact.attributes), 'contact_type_name'),
        })),
        assets: assets.slice(0, 200).map((asset) => ({
            id: asset.id,
            name: itgAttr(asJsonRecord(asset.attributes), 'name') || asset.name,
            type:
                itgAttr(asJsonRecord(asset.attributes), 'flexible_asset_type_name') ||
                itgAttr(asJsonRecord(asset.attributes), 'type'),
            provider:
                itgAttr(asJsonRecord(asset.attributes), 'provider') ||
                itgAttr(asJsonRecord(asset.attributes), 'isp') ||
                itgAttr(asJsonRecord(asset.attributes), 'carrier'),
            location:
                itgAttr(asJsonRecord(asset.attributes), 'location') ||
                itgAttr(asJsonRecord(asset.attributes), 'locations') ||
                itgAttr(asJsonRecord(asset.attributes), 'site') ||
                itgAttr(asJsonRecord(asset.attributes), 'address'),
        })),
        locations: locations.slice(0, 200).map((location) => ({
            id: location.id,
            name: itgAttr(asJsonRecord(location.attributes), 'name') || location.name,
            city: itgAttr(asJsonRecord(location.attributes), 'city'),
            state:
                itgAttr(asJsonRecord(location.attributes), 'region_name') ||
                itgAttr(asJsonRecord(location.attributes), 'state'),
            country:
                itgAttr(asJsonRecord(location.attributes), 'country_name') ||
                itgAttr(asJsonRecord(location.attributes), 'country'),
        })),
        domains: domains.slice(0, 200).map((domain) => ({
            id: domain.id,
            name: itgAttr(asJsonRecord(domain.attributes), 'name') || domain.name,
        })),
        ssl_certificates: sslCertificates.slice(0, 200).map((certificate) => ({
            id: certificate.id,
            name: itgAttr(asJsonRecord(certificate.attributes), 'name') || certificate.name,
            active: itgAttr(asJsonRecord(certificate.attributes), 'active'),
            issued_by: itgAttr(asJsonRecord(certificate.attributes), 'issued_by'),
        })),
        docs: docs.slice(0, 50).map((doc) => ({
            id: doc.id,
            title: doc.title || doc.name,
        })),
        documents_raw: documentsRaw.slice(0, 100).map((document) => ({
            id: document.id,
            name: itgAttr(asJsonRecord(document.attributes), 'name') || document.name,
            type:
                itgAttr(asJsonRecord(document.attributes), 'document_type_name') ||
                itgAttr(asJsonRecord(document.attributes), 'document_type') ||
                document.documentType,
            updated_at: itgAttr(asJsonRecord(document.attributes), 'updated_at') || document.updatedAt,
        })),
        document_attachments_sample: Object.entries(documentAttachmentsById)
            .slice(0, 50)
            .map(([docId, items]) => ({
                document_id: docId,
                count: asJsonRecordArray(items).length,
                names: asJsonRecordArray(items)
                    .slice(0, 5)
                    .map((item) => itgAttr(asJsonRecord(item.attributes), 'name') || itgAttr(asJsonRecord(item.attributes), 'file_name') || item.name)
                    .filter(Boolean),
            })),
        document_related_items_sample: Object.entries(documentRelatedItemsById)
            .slice(0, 50)
            .map(([docId, items]) => ({
                document_id: docId,
                count: asJsonRecordArray(items).length,
                item_types: [...new Set(asJsonRecordArray(items)
                        .slice(0, 5)
                        .slice(0, 20)
                        .map((item) => itgAttr(asJsonRecord(item.attributes), 'resource_type') || itgAttr(asJsonRecord(item.attributes), 'item_type') || 'unknown'))],
            })),
        collection_errors: Array.isArray(source.collection_errors) ? source.collection_errors.slice(0, 20) : [],
    };
}

export function buildNinjaExtractionInput(snapshot: Record<string, unknown>): Record<string, unknown> {
    const source = asJsonRecord(snapshot);
    const devices = asJsonRecordArray(source.devices);
    const alerts = asJsonRecordArray(source.alerts);
    const softwareInventory = asJsonRecordArray(source.software_inventory_query);
    const checks = asJsonRecordArray(source.selected_device_checks);
    const contextSignals = asJsonRecordArray(source.selected_device_context_signals);
    const selectedDevice = asJsonRecord(source.selected_device);
    const selectedDeviceDetails = asJsonRecord(source.selected_device_details);

    return {
        org_id: source.org_id,
        org_name: source.org_name,
        organization_details: asJsonRecord(source.organization_details),
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
        selected_device_context_signals: contextSignals.slice(0, 100).map((signal) => ({
            id: signal.id,
            type: signal.type,
            summary: signal.summary,
            timestamp: signal.timestamp,
        })),
        recent_alerts: alerts.slice(0, 100).map((alert) => ({
            uid: alert.uid,
            severity: alert.severity,
            message: alert.message,
            device_id: alert.deviceId,
            device_name: alert.deviceName,
        })),
        software_inventory_query: softwareInventory.slice(0, 300).map((row) => ({
            device_id: row.deviceId,
            name: row.name,
            version: row.version,
            publisher: row.publisher,
            timestamp: row.timestamp,
        })),
        devices_sample: devices.slice(0, 200).map((device) => ({
            id: device.id,
            hostname: device.hostname || device.systemName,
            os_name: device.osName,
            os_version: device.osVersion,
            ip_address: device.ipAddress,
            last_contact: device.lastContact || device.lastActivityTime,
            online: device.online,
        })),
        logged_in_user: source.logged_in_user || '',
        logged_in_at: source.logged_in_at || '',
        resolved_device_score: source.resolved_device_score ?? null,
        collection_errors: Array.isArray(source.collection_errors) ? source.collection_errors.slice(0, 20) : [],
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
    const prompt = `You are an IT Glue data extractor. Given a JSON summary of ALL configs, passwords, assets, and docs for an organization, extract ONLY the fields below and return valid JSON.\n\nRules:\n1. If value unknown, set value to "unknown" and confidence to 0.\n2. Include evidence_refs as JSON path hints (e.g., "passwords[12].name").\n3. Return ONLY JSON, no extra text.\n\nOutput schema:\n{\n  "org_id": "string",\n  "source_hash": "string",\n  "fields": {\n    "firewall_make_model": { "value": "string", "confidence": 0.0, "source_system": "itglue", "evidence_refs": ["string"] },\n    "wifi_make_model": { "value": "string", "confidence": 0.0, "source_system": "itglue", "evidence_refs": ["string"] },\n    "switch_make_model": { "value": "string", "confidence": 0.0, "source_system": "itglue", "evidence_refs": ["string"] },\n    "isp_name": { "value": "string", "confidence": 0.0, "source_system": "itglue", "evidence_refs": ["string"] }\n  }\n}\n\nSnapshot JSON:\n${JSON.stringify(summary).slice(0, 12000)}`;

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
