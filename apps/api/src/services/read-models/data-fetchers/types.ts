import type { EvidencePack } from '@cerebro/types';

export interface DataSourceContext {
    sessionId: string;
    ticketId: string;
    orgId?: string;
    tenantId?: string;
    orgNameHint?: string;
    ticketText?: string;
    deviceHints?: string[];
    // External system overrides
    organizationIds?: {
        autotask?: string;
        ninjaone?: string;
        itglue?: string;
    };
}

export interface FetchResult {
    // Partial pieces of the evidence pack this fetcher is responsible for
    ticket?: EvidencePack['ticket'];
    user?: EvidencePack['user'];
    org?: EvidencePack['org'];
    site?: EvidencePack['site'];
    device?: EvidencePack['device'];
    network_stack?: EvidencePack['network_stack'];
    signals?: EvidencePack['signals'];
    related_cases?: EvidencePack['related_cases'];
    external_status?: EvidencePack['external_status'];
    docs?: EvidencePack['docs'];

    // Raw data returned for logging or fusion/enrichment engine
    raw?: Record<string, unknown> & {
        autotaskTickets?: unknown[];
    };
}

export interface DataSourceFetcher {
    name: string;
    fetch(context: DataSourceContext): Promise<FetchResult>;
}
