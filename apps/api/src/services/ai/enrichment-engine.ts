import type { EvidencePack, Signal, Doc, SecurityAgentSummary } from '@cerebro/types';

export class EnrichmentEngine {

    inferDeviceType(input: {
        ticketNarrative: string;
        device: any | null;
        deviceDetails: any | null;
    }): 'desktop' | 'laptop' | 'mobile' | 'unknown' {
        const nodeClass = String(input.device?.nodeClass || input.deviceDetails?.nodeClass || '').toLowerCase();
        const chassis = String(input.deviceDetails?.system?.chassisType || '').toLowerCase();
        if (/(laptop|notebook)/.test(chassis)) return 'laptop';
        if (/(windows_workstation|linux_workstation|mac)/.test(nodeClass)) return 'desktop';
        if (/(android|apple_ios|apple_ipados)/.test(nodeClass)) return 'mobile';

        const source = [
            input.ticketNarrative,
            String(input.device?.osName || ''),
            String(input.device?.nodeClass || ''),
            String(input.device?.model || ''),
            String(input.deviceDetails?.system?.chassisType || ''),
            String(input.deviceDetails?.system?.model || ''),
            String(input.deviceDetails?.model || ''),
            String(input.deviceDetails?.systemModel || ''),
        ].join(' ').toLowerCase();

        if (/(iphone|android|ipad|mobile|cell)/i.test(source)) return 'mobile';
        if (/(laptop|notebook|macbook|thinkpad|latitude|elitebook|probook)/i.test(source)) return 'laptop';
        if (/(desktop|workstation|tower|optiplex|prodesk)/i.test(source)) return 'desktop';

        return 'unknown';
    }

    inferSecurityAgent(checks: Signal[], deviceDetails: any): SecurityAgentSummary {
        const sourceText = [
            ...checks.map((check) => check.summary || ''),
            JSON.stringify(deviceDetails || {}),
        ].join(' ').toLowerCase();

        const knownAgents: Array<{ name: string; pattern: RegExp }> = [
            { name: 'Microsoft Defender', pattern: /\bdefender\b/ },
            { name: 'CrowdStrike', pattern: /\bcrowdstrike\b/ },
            { name: 'SentinelOne', pattern: /\bsentinelone\b/ },
            { name: 'Sophos', pattern: /\bsophos\b/ },
            { name: 'Bitdefender', pattern: /\bbitdefender\b/ },
            { name: 'Trend Micro', pattern: /\btrend\s?micro\b/ },
            { name: 'Carbon Black', pattern: /\bcarbon\s?black\b/ },
        ];

        const detected = knownAgents.find((agent) => agent.pattern.test(sourceText));
        if (detected) {
            return { state: 'present', name: detected.name };
        }

        if (
            /(antivirus|endpoint security|edr|xdr)/i.test(sourceText) &&
            /(disabled|inactive|not installed|missing|stopped|failed)/i.test(sourceText)
        ) {
            return { state: 'absent', name: 'Unknown' };
        }

        return { state: 'unknown', name: 'Unknown' };
    }

    inferLocationContext(ticketNarrative: string): 'office' | 'remote' | 'unknown' {
        const source = String(ticketNarrative || '').toLowerCase();
        if (/(home|remote|offsite|work from home|wfh|vpn)/i.test(source)) return 'remote';
        if (/(office|onsite|on-site|conference room|headquarters|hq)/i.test(source)) return 'office';
        return 'unknown';
    }

    inferVpnState(ninjaChecks: Signal[], ticketNarrative: string): 'connected' | 'disconnected' | 'unknown' {
        const vpnChecks = ninjaChecks.filter((check) => /vpn/i.test(check.summary || check.type || ''));
        if (vpnChecks.length > 0) {
            const combined = vpnChecks.map((check) => `${check.type} ${check.summary}`.toLowerCase()).join(' ');
            if (/passed|ok|connected|up/.test(combined)) return 'connected';
            if (/failed|warn|down|disconnected|error/.test(combined)) return 'disconnected';
        }
        if (/vpn/i.test(ticketNarrative || '')) return 'unknown';
        return 'unknown';
    }

    isPublicIPv4(value: string): boolean {
        const match = /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
        if (!match) return false;
        const octets = value.split('.').map((part) => Number(part));
        const first = octets[0] ?? -1;
        const second = octets[1] ?? -1;
        if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
        if (first === 10) return false;
        if (first === 127) return false;
        if (first === 192 && second === 168) return false;
        if (first === 172 && second >= 16 && second <= 31) return false;
        return true;
    }

    resolvePublicIp(device: any, deviceDetails: any): string {
        const candidates = [
            String(device?.ipAddress || ''),
            String(device?.publicIP || ''),
            String(deviceDetails?.publicIp || ''),
            String(deviceDetails?.publicIP || ''),
            String(deviceDetails?.public_ip || ''),
            String(deviceDetails?.wanIp || ''),
            String(deviceDetails?.wan_ip || ''),
            ...(Array.isArray(deviceDetails?.ipAddresses) ? deviceDetails.ipAddresses.map((ip: unknown) => String(ip || '')) : []),
        ].map((value) => value.trim()).filter(Boolean);

        const publicIp = candidates.find((value) => this.isPublicIPv4(value));
        return publicIp || '';
    }

    normalizeTimeValue(value: unknown): string {
        if (value === null || value === undefined || value === '') return '';
        if (typeof value === 'number') {
            const millis = value > 1e12 ? value : value > 1e9 ? value * 1000 : value;
            const date = new Date(millis);
            return Number.isNaN(date.getTime()) ? '' : date.toISOString();
        }
        const text = String(value).trim();
        if (!text) return '';
        const numeric = Number(text);
        if (!Number.isNaN(numeric)) return this.normalizeTimeValue(numeric);
        const date = new Date(text);
        return Number.isNaN(date.getTime()) ? text : date.toISOString();
    }
}
