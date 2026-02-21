import { PrepareContextService } from '../../services/prepare-context.js';

describe('PrepareContextService device resolution guard', () => {
  it('does not select a device when top correlation score is zero', async () => {
    const service = new PrepareContextService() as any;

    const result = await service.resolveDeviceDeterministically({
      devices: [
        { id: 1, hostname: 'DISCOZ220', systemName: 'DISCOZ220' },
        { id: 2, hostname: 'OTHER01', systemName: 'OTHER01' },
      ],
      ticketText: 'Phone line help for Chelsea Calles at Stintino management',
      requesterName: 'Chelsea Calles',
      itglueConfigs: [],
      ninjaoneClient: {
        getDeviceChecks: async () => [],
        getDeviceDetails: async () => null,
        getDeviceLastLoggedOnUser: async () => null,
        listLastLoggedOnUsers: async () => ({ results: [] }),
      },
      sourceWorkspace: 'tenant:test',
      tenantId: 'tenant-test',
      orgId: null,
    });

    expect(result.device).toBeNull();
    expect(result.strongMatch).toBe(false);
    expect(result.score).toBe(0);
    expect(String(result.reason)).toContain('no reliable device match');
  });

  it('builds ticket narrative using raw body and updates', () => {
    const service = new PrepareContextService() as any;
    const narrative = service.buildTicketNarrative({
      title: 'phone line help',
      description: 'No dial tone',
      company: '',
      requester: 'Chelsea Calles',
      rawBody: 'Company: Stintino Management',
      updates: [{ content: 'Provider appears to be GoTo Connect' }],
    });

    expect(narrative).toContain('Company: Stintino Management');
    expect(narrative).toContain('Provider appears to be GoTo Connect');
  });

  it('deterministic normalization strips signature and caution boilerplate', () => {
    const service = new PrepareContextService() as any;
    const normalized = service.normalizeTicketDeterministically(
      'Laptop Capabilities',
      `Firstname: Alex Lastname: Zigler Message: Need multi-monitor confirmation.
       You can access your service ticket via our client portal...
       Sincerely, Refresh Support Team
       Caution This email originated outside the organization.`
    );

    expect(normalized.descriptionClean).toContain('Need multi-monitor confirmation');
    expect(normalized.descriptionClean.toLowerCase()).not.toContain('client portal');
    expect(normalized.descriptionClean.toLowerCase()).not.toContain('caution');
  });

  it('prioritizes last logged-in user match over weak config-only hostname correlation', async () => {
    const service = new PrepareContextService() as any;

    const result = await service.resolveDeviceDeterministically({
      devices: [
        { id: 1, hostname: 'LINNANE-GENERAL', systemName: 'LINNANE-GENERAL' },
        { id: 2, hostname: 'ALEX-LAPTOP-01', systemName: 'ALEX-LAPTOP-01' },
      ],
      ticketText: 'Firstname: Alex Lastname: Zigler Email: alex@linnanehomes.com',
      requesterName: 'Alex Zigler',
      itglueConfigs: [
        { attributes: { hostname: 'LINNANE-GENERAL' } }, // weak/indirect hint
      ],
      ninjaoneClient: {
        getDeviceChecks: async () => [],
        getDeviceDetails: async (deviceId: string) => {
          if (String(deviceId) === '2') {
            return { id: 2, loggedInUser: 'alex@linnanehomes.com' };
          }
          return { id: 1 };
        },
        getDeviceLastLoggedOnUser: async (deviceId: string) => {
          if (String(deviceId) === '2') return { userName: 'alex@linnanehomes.com' };
          return null;
        },
        listLastLoggedOnUsers: async () => ({ results: [] }),
      },
      sourceWorkspace: 'tenant:test',
      tenantId: 'tenant-test',
      orgId: null,
    });

    expect(result.device?.id).toBe(2);
    expect(result.loggedInUser).toBe('alex@linnanehomes.com');
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(String(result.reason)).toContain('last logged-in user');
  });

  it('does not grant company score without contact company evidence', () => {
    const service = new PrepareContextService() as any;
    const result = service.resolveEntityScope({
      ticketText: 'Firstname: Chelsea Lastname: Calles',
      requesterName: 'Chelsea Calles',
      companyName: 'Stintino Management',
      contacts: [
        {
          id: 'contact-1',
          attributes: {
            name: 'Different User',
            primary_email: '',
            primary_phone: '',
            organization_name: '',
          },
        },
      ],
      orgScopeId: 'org-1',
      tenantId: 'tenant-1',
      sourceWorkspace: 'tenant:tenant-1',
    });

    expect(result.actor_candidates?.[0]?.score_breakdown.company_normalized || 0).toBe(0);
  });

  it('rejects org-scoped evidence when target org is unresolved', () => {
    const service = new PrepareContextService() as any;
    const decision = service.enforceOrgBoundary({
      itemId: 'doc:123',
      itemOrgId: 'org-foreign',
      targetOrgId: null,
      source: 'itglue',
      summary: 'Foreign org doc',
      scopeMeta: {
        tenant_id: 'tenant-1',
        org_id: null,
        source_workspace: 'tenant:tenant-1',
      },
    });

    expect(decision.accepted).toBe(false);
    expect(decision.rejected?.reason).toBe('invalid_source_scope');
  });

  it('infers phone provider deterministically from ticket context', () => {
    const service = new PrepareContextService() as any;
    const provider = service.inferPhoneProvider({
      ticketText: 'Phone line help. User reports GoTo Connect extension not registering.',
      docs: [],
      itglueConfigs: [],
      itgluePasswords: [],
      signals: [],
    });

    expect(provider).toBe('GoTo Connect');
  });

  it('copies requester into affected user fields when actor is unresolved', () => {
    const service = new PrepareContextService() as any;
    const section = service.buildTicketEnrichmentSection({
      ticket: {
        ticketNumber: 'T20260221.0001',
        requester: 'Alex Zigler <alex@linnanehomes.com>',
        title: 'Laptop outputs not working',
        description: 'Need confirmation for multiple monitors',
        createDate: '2026-02-21T10:00:00.000Z',
      },
      companyName: 'Linnane Homes',
      inferredCompany: '',
      requesterName: 'Alex Zigler',
      entityResolution: {
        extracted_entities: {
          person: ['Alex Zigler'],
          company: ['Linnane Homes'],
          phone: [],
          email: ['alex@linnanehomes.com'],
          location: [],
          product_or_domain: [],
        },
        status: 'unresolved',
      },
    });

    expect(section.affected_user_name.value).toBe('Alex Zigler <alex@linnanehomes.com>');
    expect(section.affected_user_name.status).toBe('inferred');
    expect(section.affected_user_email.value).toBe('alex@linnanehomes.com');
    expect(section.affected_user_email.status).toBe('inferred');
  });

  it('prefers round-0 canonical requester/affected identities when provided', () => {
    const service = new PrepareContextService() as any;
    const section = service.buildTicketEnrichmentSection({
      ticket: {
        ticketNumber: 'T20260221.0003',
        requester: 'Answer ZSource',
        canonicalRequesterName: 'Alex Zigler',
        canonicalRequesterEmail: 'alex@linnanehomes.com',
        canonicalAffectedName: 'Alex Zigler',
        canonicalAffectedEmail: 'alex@linnanehomes.com',
        title: 'Laptop capabilities',
        description: 'Need usb-c video confirmation',
        createDate: '2026-02-21T10:00:00.000Z',
      },
      companyName: 'Linnane Homes',
      inferredCompany: '',
      requesterName: 'Answer ZSource',
      entityResolution: {
        extracted_entities: {
          person: ['Alex Zigler'],
          company: ['Linnane Homes'],
          phone: [],
          email: ['alex@linnanehomes.com'],
          location: [],
          product_or_domain: [],
        },
        status: 'unresolved',
      },
    });

    expect(section.requester_name.value).toBe('Alex Zigler');
    expect(section.requester_email.value).toBe('alex@linnanehomes.com');
    expect(section.affected_user_name.value).toBe('Alex Zigler');
    expect(section.affected_user_email.value).toBe('alex@linnanehomes.com');
  });

  it('builds network enrichment with vpn and phone-provider inference', () => {
    const service = new PrepareContextService() as any;
    const section = service.buildNetworkEnrichmentSection({
      ticketNarrative: 'User working remote over VPN',
      device: { ipAddress: '8.8.8.8' },
      deviceDetails: {},
      docs: [],
      itglueConfigs: [],
      ninjaChecks: [
        {
          id: 'n1',
          source: 'ninja',
          timestamp: new Date().toISOString(),
          type: 'health_ok',
          summary: 'VPN tunnel passed',
        },
      ],
      inferredPhoneProvider: 'GoTo Connect',
    });

    expect(section.location_context.value).toBe('remote');
    expect(section.public_ip.value).toBe('8.8.8.8');
    expect(section.vpn_state.value).toBe('connected');
    expect(section.phone_provider.value).toBe('connected');
    expect(section.phone_provider_name.value).toBe('GoTo Connect');
  });

  it('builds iterative enrichment profile with round summaries', () => {
    const service = new PrepareContextService() as any;
    const profile = service.buildIterativeEnrichmentProfile({
      ticket: {
        ticketNumber: 'T20260221.0002',
        title: 'VPN issue',
        description: 'Remote user cannot connect',
        requester: 'John Example <john@example.com>',
        createDate: '2026-02-21T10:00:00.000Z',
        company: 'Acme Corp',
      },
      ticketNarrative: 'Remote user cannot connect to VPN',
      companyName: 'Acme Corp',
      inferredCompany: '',
      requesterName: 'John Example',
      entityResolution: {
        extracted_entities: {
          person: ['John Example'],
          company: ['Acme Corp'],
          phone: [],
          email: ['john@example.com'],
          location: [],
          product_or_domain: ['vpn'],
        },
        resolved_actor: {
          id: 'u1',
          name: 'John Example',
          email: 'john@example.com',
          confidence: 'medium',
        },
        status: 'resolved',
      },
      device: {
        id: 'd1',
        hostname: 'ACME-LT-01',
        osName: 'Windows',
        osVersion: '11',
        lastActivityTime: '2026-02-21T09:59:00.000Z',
        ipAddress: '8.8.4.4',
      },
      deviceDetails: {},
      loggedInUser: 'john@example.com',
      loggedInAt: '2026-02-21T09:58:00.000Z',
      inferredPhoneProvider: 'GoTo Connect',
      sourceFindings: [
        { source: 'autotask', round: 1, queried: true, matched: true, summary: 'ticket parsed', details: [] },
        { source: 'ninjaone', round: 1, queried: true, matched: true, summary: 'device found', details: [] },
        { source: 'autotask', round: 2, queried: true, matched: false, summary: 'history done', details: [] },
        { source: 'external', round: 4, queried: false, matched: false, summary: 'external skipped', details: [] },
      ],
      itglueConfigs: [],
      docs: [],
      ninjaChecks: [],
      missingData: [],
    });

    expect(profile.schema_version).toBe('1.0.0');
    expect(profile.sections.ticket.ticket_id.value).toBe('T20260221.0002');
    expect(profile.rounds.some((round: any) => round.round === 1)).toBe(true);
    expect(profile.rounds.some((round: any) => round.round === 4)).toBe(true);
  });
});
