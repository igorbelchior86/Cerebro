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
});
