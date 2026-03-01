import type { DiagnosisOutput, EvidencePack } from '@cerebro/types';
import {
  shouldBlockDiagnosisOutput,
  shouldBlockPlaybookOutput,
} from '../../services/evidence-guardrails.js';

function buildBasePack(): EvidencePack {
  return {
    session_id: 's1',
    ticket: {
      id: 'T1',
      title: 'User cannot print PDF',
      description: 'Foxit fails to print attachment',
      created_at: new Date().toISOString(),
      priority: 'Medium',
      queue: 'Email Ingestion',
      category: 'Support',
    },
    org: { id: 'org-1', name: 'Org 1' },
    signals: [],
    related_cases: [],
    external_status: [],
    docs: [],
    evidence_rules: {
      require_evidence_for_claims: true,
      no_destructive_steps_without_gating: true,
    },
    missing_data: [],
    prepared_at: new Date().toISOString(),
  };
}

function buildDiagnosis(hypothesis: string): DiagnosisOutput {
  return {
    summary: hypothesis,
    top_hypotheses: [
      {
        rank: 1,
        hypothesis,
        confidence: 0.75,
        evidence: ['Ticket says print failure'],
        tests: ['Reproduce print from Foxit'],
      },
    ],
    missing_data: [],
    recommended_actions: [{ action: 'Collect logs', risk: 'low' }],
    do_not_do: [],
  };
}

describe('evidence guardrails', () => {
  it('blocks diagnosis when high-risk narrative is unsupported by direct evidence', () => {
    const pack = buildBasePack();
    const diagnosis = buildDiagnosis('Compromised account and malware persistence via nircmd.exe');
    expect(shouldBlockDiagnosisOutput(diagnosis, pack)).toBe(true);
  });

  it('does not block diagnosis when high-risk terms are directly present in evidence', () => {
    const pack = buildBasePack();
    pack.ticket.description = 'Security tool detected malware and nircmd.exe on this endpoint.';
    const diagnosis = buildDiagnosis('Possible malware compromise requiring containment');
    expect(shouldBlockDiagnosisOutput(diagnosis, pack)).toBe(false);
  });

  it('blocks playbook when it drifts to integration credential remediation for unrelated ticket', () => {
    const pack = buildBasePack();
    pack.missing_data = [
      { field: 'itglue_docs', why: 'IT Glue API error: 401 Unauthorized' },
      { field: 'ninjaone_device', why: 'NinjaOne auth error 400: {"error":"invalid_client"}' },
    ];
    const diagnosis = buildDiagnosis('Issue likely tied to NinjaOne credentials and IT Glue API key mismatch');
    const markdown = `
# T1 - Resolve NinjaOne and IT Glue Access
1. Re-register NinjaOne agent
2. Reset IT Glue API key
3. Rotate client secret
`;
    expect(shouldBlockPlaybookOutput(markdown, diagnosis, pack)).toBe(true);
  });

  it('does not block playbook when ticket is explicitly about integration access', () => {
    const pack = buildBasePack();
    pack.ticket.title = 'NinjaOne integration credentials invalid';
    pack.ticket.description = 'NinjaOne oauth invalid_client while syncing integration';
    pack.missing_data = [
      { field: 'ninjaone_device', why: 'NinjaOne auth error 400: {"error":"invalid_client"}' },
    ];
    const diagnosis = buildDiagnosis('NinjaOne OAuth credentials invalid for this integration');
    const markdown = `
# T1 - Fix NinjaOne OAuth
1. Rotate client secret
2. Reconnect integration
`;
    expect(shouldBlockPlaybookOutput(markdown, diagnosis, pack)).toBe(false);
  });

  it('does not block playbook for incidental unsupported high-risk mention without assertive drift', () => {
    const pack = buildBasePack();
    pack.ticket.title = 'Warehouse WiFi intermittent';
    pack.ticket.description = 'Job Runner tablets lose connectivity in warehouse';
    const diagnosis = buildDiagnosis('Wireless connectivity issue affecting tablets');
    const markdown = `
# T1 - Warehouse WiFi Troubleshooting
## Root Cause
- Likely DHCP or AP connectivity issue
## Verification
- Confirm connectivity is restored
- If endpoint remains unstable after network fix, run a malware scan as a separate hygiene check
`;
    expect(shouldBlockPlaybookOutput(markdown, diagnosis, pack)).toBe(false);
  });

  it('blocks playbook for unsupported high-risk root-cause drift', () => {
    const pack = buildBasePack();
    pack.ticket.title = 'Warehouse WiFi intermittent';
    pack.ticket.description = 'Job Runner tablets lose connectivity in warehouse';
    const diagnosis = buildDiagnosis('Wireless connectivity issue affecting tablets');
    const markdown = `
# T1 - Warehouse WiFi Troubleshooting
## Root Cause
- Primary hypothesis: malware compromise on the tablet is the root cause
## Resolution Steps
1. Isolate endpoint from network
`;
    expect(shouldBlockPlaybookOutput(markdown, diagnosis, pack)).toBe(true);
  });
});
