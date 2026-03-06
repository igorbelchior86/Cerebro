import { IdentityProvider, ServiceProvider } from 'samlify';

export interface TenantSamlProviderRecord {
  tenant_id: string;
  provider_key: string;
  enabled: boolean;
  sp_entity_id: string;
  acs_url: string;
  idp_entity_id: string;
  idp_sso_url: string;
  idp_certificates: string[] | string;
  nameid_format: string;
  attribute_mapping: Record<string, string> | null;
}

type ExtractResult = {
  nameid?: string;
  issuer?: string;
  attributes?: Record<string, unknown>;
  response?: {
    id?: string;
    inResponseTo?: string;
    destination?: string;
  };
  conditions?: {
    audience?: string | string[];
    notBefore?: string;
    notOnOrAfter?: string;
  };
};

function asCertificates(raw: string[] | string): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (!raw) return [];
  return [raw];
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildIdpMetadata(provider: TenantSamlProviderRecord): string {
  const certBlocks = asCertificates(provider.idp_certificates)
    .map((cert) => cert.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, ''))
    .filter(Boolean)
    .map((cert) => `<KeyDescriptor use="signing"><KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><X509Data><X509Certificate>${xmlEscape(cert)}</X509Certificate></X509Data></KeyInfo></KeyDescriptor>`)
    .join('');

  return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${xmlEscape(provider.idp_entity_id)}">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    ${certBlocks}
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${xmlEscape(provider.idp_sso_url)}"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;
}

function buildServiceProvider(provider: TenantSamlProviderRecord) {
  return ServiceProvider({
    entityID: provider.sp_entity_id,
    assertionConsumerService: [
      {
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        Location: provider.acs_url,
      },
    ],
    authnRequestsSigned: false,
    wantAssertionsSigned: true,
    wantMessageSigned: true,
    allowCreate: false,
    nameIDFormat: [provider.nameid_format],
  });
}

function buildIdentityProvider(provider: TenantSamlProviderRecord) {
  return IdentityProvider({
    metadata: buildIdpMetadata(provider),
    wantAuthnRequestsSigned: false,
    isAssertionEncrypted: false,
  });
}

function appendRelayState(context: string, relayState: string): string {
  const suffix = `RelayState=${encodeURIComponent(relayState)}`;
  return context.includes('?') ? `${context}&${suffix}` : `${context}?${suffix}`;
}

export async function createSpInitiatedLoginRequest(
  provider: TenantSamlProviderRecord,
  relayState: string,
): Promise<{ samlRequestId: string; redirectUrl: string }> {
  const sp = buildServiceProvider(provider);
  const idp = buildIdentityProvider(provider);
  const { id, context } = await sp.createLoginRequest(idp, 'redirect');
  return {
    samlRequestId: id,
    redirectUrl: appendRelayState(context, relayState),
  };
}

function toAudienceList(audience?: string | string[]): string[] {
  if (!audience) return [];
  return Array.isArray(audience) ? audience : [audience];
}

export function assertSamlConditions(
  extract: ExtractResult,
  provider: TenantSamlProviderRecord,
  expectedInResponseTo: string,
): void {
  if (!extract.issuer || extract.issuer !== provider.idp_entity_id) {
    throw new Error('SAML issuer mismatch');
  }

  if (!extract.response?.inResponseTo || extract.response.inResponseTo !== expectedInResponseTo) {
    throw new Error('SAML inResponseTo mismatch');
  }

  if (extract.response?.destination && extract.response.destination !== provider.acs_url) {
    throw new Error('SAML destination mismatch');
  }

  const audiences = toAudienceList(extract.conditions?.audience);
  if (audiences.length > 0 && !audiences.includes(provider.sp_entity_id)) {
    throw new Error('SAML audience mismatch');
  }

  const now = Date.now();
  const skewMs = 120_000;
  const notBefore = extract.conditions?.notBefore ? Date.parse(extract.conditions.notBefore) : undefined;
  const notOnOrAfter = extract.conditions?.notOnOrAfter
    ? Date.parse(extract.conditions.notOnOrAfter)
    : undefined;
  if (notBefore && now + skewMs < notBefore) {
    throw new Error('SAML assertion not yet valid');
  }
  if (notOnOrAfter && now - skewMs >= notOnOrAfter) {
    throw new Error('SAML assertion expired');
  }
}

export async function parseAcsResponse(
  provider: TenantSamlProviderRecord,
  req: Parameters<ReturnType<typeof buildServiceProvider>['parseLoginResponse']>[2],
  expectedInResponseTo: string,
): Promise<{
  email: string;
  firstName?: string;
  lastName?: string;
  groups?: string[] | string;
  samlResponseId?: string;
}> {
  const sp = buildServiceProvider(provider);
  const idp = buildIdentityProvider(provider);
  const parsed = await sp.parseLoginResponse(idp, 'post', req);
  const extract = ((parsed as { extract?: ExtractResult } | null)?.extract) as ExtractResult | undefined;
  if (!extract) {
    throw new Error('SAML response missing extracted assertion data');
  }

  assertSamlConditions(extract, provider, expectedInResponseTo);

  const mapping = provider.attribute_mapping || {};
  const attrs = extract?.attributes || {};
  const emailAttr = String(mapping.email || 'email');
  const firstNameAttr = String(mapping.first_name || 'firstName');
  const lastNameAttr = String(mapping.last_name || 'lastName');
  const groupsAttr = String(mapping.groups || 'groups');

  const fromAttr = attrs[emailAttr];
  const email = String(fromAttr || extract?.nameid || '').trim().toLowerCase();
  if (!email) {
    throw new Error('SAML response missing email claim');
  }

  const firstName = attrs[firstNameAttr] ? String(attrs[firstNameAttr]) : undefined;
  const lastName = attrs[lastNameAttr] ? String(attrs[lastNameAttr]) : undefined;
  const groups = attrs[groupsAttr] as string[] | string | undefined;

  const out: {
    email: string;
    firstName?: string;
    lastName?: string;
    groups?: string[] | string;
    samlResponseId?: string;
  } = { email };
  if (firstName) out.firstName = firstName;
  if (lastName) out.lastName = lastName;
  if (groups) out.groups = groups;
  if (extract?.response?.id) out.samlResponseId = extract.response.id;
  return out;
}
