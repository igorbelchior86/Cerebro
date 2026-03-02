import { queryOne } from '../../db/index.js';
import { tenantContext } from '../../lib/tenantContext.js';
import { operationalLogger } from '../../lib/operational-logger.js';
import { resetDefaultLLMProvider } from '../ai/llm-adapter.js';

type WorkspaceSettings = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  return v.length > 0 ? v : undefined;
}

function applyIfPresent(envKey: string, value: unknown) {
  const v = asString(value);
  if (v) process.env[envKey] = v;
}

export function applyWorkspaceRuntimeSettings(settings: WorkspaceSettings): void {
  // LLM provider/model
  const llmProvider = asString(settings.llmProvider);
  process.env.LLM_PROVIDER = llmProvider || 'gemini';
  applyIfPresent('GEMINI_MODEL', settings.llmModel);
  applyIfPresent('LLM_FALLBACK_PROVIDER', settings.llmFallbackProvider);
  applyIfPresent('LLM_FALLBACK_MODEL', settings.llmFallbackModel);

  // Generation controls
  applyIfPresent('LLM_MAX_TOKENS', settings.llmMaxTokens);
  applyIfPresent('LLM_TEMPERATURE', settings.llmTemperature);
  applyIfPresent('TRIAGE_GATING_PROFILE', settings.triageGatingProfile ?? settings.pipelineGatingProfile);

  // Gemini quota controls (temporary free-tier protection)
  applyIfPresent('GEMINI_LIMIT_RPM', settings.geminiLimitRpm);
  applyIfPresent('GEMINI_LIMIT_RPD', settings.geminiLimitRpd);
  applyIfPresent('GEMINI_LIMIT_TPM', settings.geminiLimitTpm);
  applyIfPresent('GEMINI_RETRY_MAX', settings.geminiRetryMax);

  // Force re-instantiation so new provider/model settings take effect immediately.
  resetDefaultLLMProvider();
}

export async function bootstrapWorkspaceRuntimeSettings(): Promise<void> {
  await tenantContext.run({ tenantId: undefined, bypassRLS: true }, async () => {
    const tenant = await queryOne<{ settings: WorkspaceSettings }>(
      `SELECT settings
       FROM tenants
       ORDER BY created_at ASC
       LIMIT 1`
    );
    if (!tenant?.settings) return;
    applyWorkspaceRuntimeSettings(tenant.settings);
    operationalLogger.info('read_models.runtime_settings.bootstrap_loaded', {
      module: 'services.read-models.runtime-settings',
      source: 'tenant_settings',
    });
  });
}
