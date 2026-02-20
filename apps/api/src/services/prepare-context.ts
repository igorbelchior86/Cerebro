// ─────────────────────────────────────────────────────────────
// PrepareContext Service — Orquestra coleta de dados
// ─────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import type {
  EvidencePack,
  Signal,
  RelatedCase,
  Doc,
  ExternalStatus,
  TriageSession,
} from '@playbook-brain/types';
import { AutotaskClient } from '../clients/autotask.js';
import { NinjaOneClient } from '../clients/ninjaone.js';
import { ITGlueClient } from '../clients/itglue.js';
import { query, queryOne, execute } from '../db/index.js';

interface PrepareContextInput {
  sessionId: string;
  ticketId: string;
  orgId?: string;
  organizationIds?: {
    autotask?: string;
    ninjaone?: string;
    itglue?: string;
  };
}

export class PrepareContextService {
  private autotaskClient: AutotaskClient;
  private ninjaoneClient: NinjaOneClient;
  private itglueClient: ITGlueClient;

  constructor() {
    this.autotaskClient = new AutotaskClient({
      apiIntegrationCode: process.env.AUTOTASK_API_INTEGRATION_CODE || '',
      username: process.env.AUTOTASK_USERNAME || '',
      secret: process.env.AUTOTASK_SECRET || '',
    });

    this.ninjaoneClient = new NinjaOneClient({
      clientId: process.env.NINJAONE_CLIENT_ID || '',
      clientSecret: process.env.NINJAONE_CLIENT_SECRET || '',
    });

    this.itglueClient = new ITGlueClient({
      apiKey: process.env.ITGLUE_API_KEY || '',
    });
  }

  /**
   * Principal: Coleta dados de múltiplas fontes e monta EvidencePack
   */
  async prepare(input: PrepareContextInput): Promise<EvidencePack> {
    console.log(`[PrepareContext] Starting for ticket ${input.ticketId}`);

    const startTime = Date.now();
    const missingData: Array<{ field: string; why: string }> = [];

    // ─── Coleta do Autotask ──────────────────────────────────────
    let ticket = null;
    let signals: Signal[] = [];

    try {
      const ticketIdNum = parseInt(input.ticketId, 10);
      ticket = await this.autotaskClient.getTicket(ticketIdNum);
      console.log(`[PrepareContext] Got Autotask ticket ${input.ticketId}`);

      // Coleta notas (signals)
      const notes = await this.autotaskClient.getTicketNotes(ticketIdNum);
      signals = notes.map((note, idx) => ({
        id: `autotask-note-${idx}`,
        source: 'autotask' as const,
        timestamp: note.createDate,
        type: 'ticket_note',
        summary: note.noteText?.substring(0, 200) || '',
        raw_ref: note,
      }));
    } catch (error) {
      missingData.push({
        field: 'autotask_ticket',
        why: `Failed to fetch Autotask ticket: ${(error as Error).message}`,
      });
    }

    if (!ticket) {
      throw new Error(`Cannot prepare context without valid ticket from Autotask`);
    }

    // ─── Coleta do NinjaOne ──────────────────────────────────────
    let device = null;
    let ninjaChecks: Signal[] = [];

    try {
      // Assume device hostname might match or we need custom logic
      const devices = await this.ninjaoneClient.listDevices({ limit: 100 });
      console.log(`[PrepareContext] Got ${devices.length} devices from NinjaOne`);

      // Heurística simples: match por hostname (em produção, usar custom field mapping)
      if (devices.length > 0) {
        device = devices[0];

        // Get health checks
        if (device) {
          const checks = await this.ninjaoneClient.getDeviceChecks(device.id);
          ninjaChecks = checks.map((check) => ({
            id: `ninja-check-${check.id}`,
            source: 'ninja' as const,
            timestamp: check.lastCheck,
            type: check.status === 'passed' ? 'health_ok' : 'health_warn',
            summary: `${check.name}: ${check.status}`,
            raw_ref: check,
          }));
        }
      }
    } catch (error) {
      missingData.push({
        field: 'ninjaone_device',
        why: `Failed to fetch NinjaOne data: ${(error as Error).message}`,
      });
    }

    // ─── Coleta do IT Glue ───────────────────────────────────────
    let docs: Doc[] = [];

    try {
      // Pesquisa runbooks relacionados ao problema
      const runbooks = await this.itglueClient.getRunbooks();
      console.log(`[PrepareContext] Got ${runbooks.length} runbooks from IT Glue`);

      docs = runbooks
        .slice(0, 5) // Limit to top 5
        .map((doc, idx) => ({
          id: doc.id,
          source: 'itglue' as const,
          title: doc.name,
          snippet: doc.body?.substring(0, 500) || '',
          relevance: 0.5 - idx * 0.05, // Decaying relevance
          raw_ref: doc as unknown as Record<string, unknown>,
        }));
    } catch (error) {
      missingData.push({
        field: 'itglue_docs',
        why: `Failed to fetch IT Glue docs: ${(error as Error).message}`,
      });
    }

    // ─── Busca Casos Passados ────────────────────────────────────
    const relatedCases = await this.findRelatedCases(ticket.title || '', input.orgId);

    // ─── Status de Provedores Externos ───────────────────────────
    // Placeholder: em produção, chamar status page APIs
    const externalStatus: ExternalStatus[] = [
      {
        provider: 'AWS',
        region: 'us-east-1',
        status: 'operational',
        updated_at: new Date().toISOString(),
        source_ref: 'https://status.aws.amazon.com',
      },
    ];

    // ─── Monta EvidencePack ──────────────────────────────────────
    const basePackObject = {
      session_id: input.sessionId,
      ticket: {
        id: ticket.ticketNumber || String(ticket.id),
        title: ticket.title || '',
        description: ticket.description || '',
        created_at: ticket.createDate || new Date().toISOString(),
        priority: this.mapAutotaskPriority((ticket as any).priority),
        queue: (ticket as any).queueName || 'Unknown',
        category: 'Support',
      },
      org: {
        id: input.orgId || 'unknown',
        name: 'Organization', // Would come from Autotask
      },
      signals: [...signals, ...ninjaChecks],
      related_cases: relatedCases,
      external_status: externalStatus,
      docs: docs,
      evidence_rules: {
        require_evidence_for_claims: true,
        no_destructive_steps_without_gating: true,
      },
      prepared_at: new Date().toISOString(),
    };

    const evidencePack: EvidencePack = {
      ...basePackObject,
      ...(device && {
        device: {
          ninja_device_id: device.id,
          hostname: device.hostname,
          os: device.osName,
          last_seen: device.lastActivityTime,
          confidence: 'high' as const,
        },
      }),
      ...(missingData.length > 0 && { missing_data: missingData }),
    } as EvidencePack;

    const duration = Date.now() - startTime;
    console.log(`[PrepareContext] Completed in ${duration}ms`);

    return evidencePack;
  }

  /**
   * Busca casos passados similares no banco
   */
  private async findRelatedCases(ticketTitle: string, orgId?: string): Promise<RelatedCase[]> {
    try {
      // Busca por palavras-chave no banco (simplificado)
      const keyword = ticketTitle.split(' ')[0];
      const cases = await query<{ ticket_id: string; summary: string; resolution: string; resolved_at: string }>(
        `
        SELECT 
          t.ticket_id,
          array_agg(DISTINCT l.payload->>'summary') as summary,
          array_agg(DISTINCT l.payload->>'content') as resolution,
          max(t.updated_at) as resolved_at
        FROM triage_sessions t
        LEFT JOIN llm_outputs l ON t.id = l.session_id
        WHERE t.status = 'approved' 
        AND (t.ticket_id ILIKE $1 OR l.payload->>'summary' ILIKE $2)
        ${orgId ? 'AND t.org_id = $3' : ''}
        GROUP BY t.ticket_id
        LIMIT 3
        `,
        orgId ? [`%${keyword}%`, `%${keyword}%`, orgId] : [`%${keyword}%`, `%${keyword}%`]
      );

      return cases.map((c) => ({
        ticket_id: c.ticket_id,
        symptom: Array.isArray(c.summary) ? c.summary[0] : String(c.summary),
        resolution: Array.isArray(c.resolution) ? c.resolution[0] : String(c.resolution),
        resolved_at: c.resolved_at,
      }));
    } catch (error) {
      console.log('[PrepareContext] Could not find related cases:', error);
      return [];
    }
  }

  /**
   * Mapeia prioridade do Autotask para formato padronizado
   */
  private mapAutotaskPriority(
    priority: number | undefined
  ): 'Critical' | 'High' | 'Medium' | 'Low' {
    if (!priority) return 'Medium';
    if (priority === 1) return 'Critical';
    if (priority <= 2) return 'High';
    if (priority <= 3) return 'Medium';
    return 'Low';
  }
}

/**
 * Persist EvidencePack ao banco
 */
export async function persistEvidencePack(sessionId: string, pack: EvidencePack): Promise<void> {
  try {
    await execute(
      `
      INSERT INTO evidence_packs (session_id, payload, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (session_id) DO UPDATE
      SET payload = $2, created_at = NOW()
      `,
      [sessionId, JSON.stringify(pack)]
    );
    console.log(`[DB] Persisted EvidencePack for session ${sessionId}`);
  } catch (error) {
    console.error('[DB] Failed to persist EvidencePack:', error);
    throw error;
  }
}

/**
 * Recupera EvidencePack do banco
 */
export async function getEvidencePack(sessionId: string): Promise<EvidencePack | null> {
  try {
    const result = await queryOne<{ payload: EvidencePack }>(
      `SELECT payload FROM evidence_packs WHERE session_id = $1`,
      [sessionId]
    );
    return result?.payload || null;
  } catch (error) {
    console.error('[DB] Failed to retrieve EvidencePack:', error);
    return null;
  }
}
