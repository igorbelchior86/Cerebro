import { assertSamlConditions, type TenantSamlProviderRecord } from '../../services/identity/saml-service.js';

describe('saml-service', () => {
  const provider: TenantSamlProviderRecord = {
    tenant_id: 'tenant-1',
    provider_key: 'okta',
    enabled: true,
    sp_entity_id: 'https://sp.example.com/metadata',
    acs_url: 'https://sp.example.com/auth/saml/okta/acs',
    idp_entity_id: 'https://idp.example.com/app',
    idp_sso_url: 'https://idp.example.com/sso',
    idp_certificates: ['cert'],
    nameid_format: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attribute_mapping: { email: 'email' },
  };

  test('accepts matching issuer/audience/inResponseTo with valid time window', () => {
    expect(() =>
      assertSamlConditions(
        {
          issuer: provider.idp_entity_id,
          response: {
            inResponseTo: 'req-1',
            destination: provider.acs_url,
          },
          conditions: {
            audience: provider.sp_entity_id,
            notBefore: new Date(Date.now() - 30_000).toISOString(),
            notOnOrAfter: new Date(Date.now() + 30_000).toISOString(),
          },
        },
        provider,
        'req-1',
      ),
    ).not.toThrow();
  });

  test('rejects issuer mismatch', () => {
    expect(() =>
      assertSamlConditions(
        {
          issuer: 'https://other-idp.example.com',
          response: { inResponseTo: 'req-1', destination: provider.acs_url },
          conditions: { audience: provider.sp_entity_id },
        },
        provider,
        'req-1',
      ),
    ).toThrow('SAML issuer mismatch');
  });

  test('rejects expired assertion', () => {
    expect(() =>
      assertSamlConditions(
        {
          issuer: provider.idp_entity_id,
          response: { inResponseTo: 'req-1', destination: provider.acs_url },
          conditions: {
            audience: provider.sp_entity_id,
            notOnOrAfter: new Date(Date.now() - 5 * 60_000).toISOString(),
          },
        },
        provider,
        'req-1',
      ),
    ).toThrow('SAML assertion expired');
  });
});

