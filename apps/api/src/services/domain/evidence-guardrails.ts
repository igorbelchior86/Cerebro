import type { DiagnosisOutput, EvidencePack } from '@cerebro/types';

const HIGH_RISK_TERMS = [
  'malware',
  'phishing',
  'ransomware',
  'compromis',
  'lateral movement',
  'data exfiltration',
  'nircmd',
  'credential theft',
  'account takeover',
];

const HIGH_RISK_ASSERTIVE_CONTEXT_PATTERNS: RegExp[] = [
  /\b(root cause|primary hypothesis|likely cause|cause|why this happened)\b[\s\S]{0,120}\b(malware|phishing|ransomware|credential theft|account takeover|data exfiltration|lateral movement|compromis)\b/i,
  /\b(malware|phishing|ransomware|credential theft|account takeover|data exfiltration|lateral movement|compromis)\b[\s\S]{0,120}\b(root cause|confirmed|detected|likely|caused|compromise)\b/i,
];

const HIGH_RISK_REMEDIATION_ACTION_TERMS = [
  'isolate device',
  'isolate endpoint',
  'contain host',
  'contain endpoint',
  'disconnect from network',
  'quarantine endpoint',
  'reimage',
  'wipe device',
  'reset all passwords',
  'disable account',
  'disable user',
  'incident response',
];

const INTEGRATION_CONTEXT_TERMS = [
  'ninjaone',
  'it glue',
  'integration',
  'api key',
  'credentials',
  'oauth',
  'invalid_client',
  'unauthorized',
];

const INTEGRATION_REMEDIATION_TERMS = [
  're-register',
  'reregister',
  'reset api',
  'rotate api key',
  'ninjaone agent',
  'it glue api',
  'fix credentials',
  'oauth token',
  'client secret',
];

function includesAny(text: string, terms: string[]): boolean {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function collectDirectEvidenceText(pack: EvidencePack): string {
  const sourceFindings = ((pack as any).source_findings || []) as Array<{
    summary?: string;
    details?: string[];
  }>;
  const chunks: string[] = [
    pack.ticket.title,
    pack.ticket.description,
    pack.org?.name || '',
    ...(pack.signals || []).map((s) => `${s.source} ${s.type} ${s.summary}`),
    ...(pack.docs || []).flatMap((d) => [d.title, d.snippet]),
    ...(pack.external_status || []).map((s) => `${s.provider} ${s.status}`),
    ...sourceFindings.flatMap((f) => [f.summary || '', ...(f.details || [])]),
  ];
  return normalize(chunks.filter(Boolean).join(' '));
}

function collectDiagnosisNarrativeText(diagnosis: DiagnosisOutput): string {
  const chunks: string[] = [
    diagnosis.summary,
    ...diagnosis.top_hypotheses.flatMap((h) => [h.hypothesis, ...(h.evidence || []), ...(h.tests || [])]),
    ...diagnosis.recommended_actions.map((a) => a.action),
  ];
  return normalize(chunks.filter(Boolean).join(' '));
}

function hasIntegrationAuthGaps(pack: EvidencePack): boolean {
  return (pack.missing_data || []).some((m) => {
    const field = (m.field || '').toLowerCase();
    const why = (m.why || '').toLowerCase();
    if (field.includes('itglue') || field.includes('ninjaone')) return true;
    return why.includes('unauthorized') || why.includes('invalid_client') || why.includes('auth error');
  });
}

function ticketMentionsIntegrationContext(pack: EvidencePack): boolean {
  const ticketText = normalize(`${pack.ticket.title} ${pack.ticket.description}`);
  return includesAny(ticketText, INTEGRATION_CONTEXT_TERMS);
}

export function shouldBlockDiagnosisOutput(
  diagnosis: DiagnosisOutput,
  pack: EvidencePack
): boolean {
  const evidenceText = collectDirectEvidenceText(pack);
  const diagnosisText = collectDiagnosisNarrativeText(diagnosis);
  const topHypothesis = normalize(diagnosis.top_hypotheses?.[0]?.hypothesis || '');

  const diagnosisHasUnsupportedHighRisk =
    includesAny(diagnosisText, HIGH_RISK_TERMS) && !includesAny(evidenceText, HIGH_RISK_TERMS);
  if (diagnosisHasUnsupportedHighRisk) return true;

  const integrationDrift =
    hasIntegrationAuthGaps(pack) &&
    !ticketMentionsIntegrationContext(pack) &&
    includesAny(topHypothesis, INTEGRATION_CONTEXT_TERMS);
  if (integrationDrift) return true;

  return false;
}

export function shouldBlockPlaybookOutput(
  markdown: string,
  diagnosis: DiagnosisOutput,
  pack: EvidencePack
): boolean {
  const playbookText = normalize(markdown);
  const evidenceText = normalize(
    `${collectDirectEvidenceText(pack)} ${collectDiagnosisNarrativeText(diagnosis)}`
  );

  const unsupportedHighRiskMention =
    includesAny(playbookText, HIGH_RISK_TERMS) && !includesAny(evidenceText, HIGH_RISK_TERMS);
  const highRiskAssertiveDrift = HIGH_RISK_ASSERTIVE_CONTEXT_PATTERNS.some((pattern) => pattern.test(markdown));
  const highRiskRemediationDrift = includesAny(playbookText, HIGH_RISK_REMEDIATION_ACTION_TERMS);
  const playbookHasUnsupportedHighRisk =
    unsupportedHighRiskMention && (highRiskAssertiveDrift || highRiskRemediationDrift);
  if (playbookHasUnsupportedHighRisk) return true;

  const integrationRemediationDrift =
    hasIntegrationAuthGaps(pack) &&
    !ticketMentionsIntegrationContext(pack) &&
    includesAny(playbookText, INTEGRATION_REMEDIATION_TERMS);
  if (integrationRemediationDrift) return true;

  return false;
}

export function explainPlaybookGuardBlock(
  markdown: string,
  diagnosis: DiagnosisOutput,
  pack: EvidencePack
): string | null {
  const playbookText = normalize(markdown);
  const evidenceText = normalize(
    `${collectDirectEvidenceText(pack)} ${collectDiagnosisNarrativeText(diagnosis)}`
  );

  const unsupportedHighRiskMention =
    includesAny(playbookText, HIGH_RISK_TERMS) && !includesAny(evidenceText, HIGH_RISK_TERMS);
  if (unsupportedHighRiskMention) {
    const highRiskAssertiveDrift = HIGH_RISK_ASSERTIVE_CONTEXT_PATTERNS.some((pattern) => pattern.test(markdown));
    const highRiskRemediationDrift = includesAny(playbookText, HIGH_RISK_REMEDIATION_ACTION_TERMS);
    if (highRiskAssertiveDrift || highRiskRemediationDrift) {
      return 'unsupported_high_risk_inference';
    }
  }

  const integrationRemediationDrift =
    hasIntegrationAuthGaps(pack) &&
    !ticketMentionsIntegrationContext(pack) &&
    includesAny(playbookText, INTEGRATION_REMEDIATION_TERMS);
  if (integrationRemediationDrift) {
    return 'unsupported_integration_remediation';
  }

  return null;
}
