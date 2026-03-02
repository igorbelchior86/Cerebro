import { operationalLogger } from '../../../lib/operational-logger.js';

export interface ParsedTicket {
    id: string;
    title: string;
    description: string;
    company?: string;
    requester: string;
    createdAt: string;
    source: 'email_ingestion';
    status: 'new' | 'updated';
    rawBody: string;
    isReply: boolean;
}

export class EmailParser {
    private extractEndUser(bodyText: string): string {
        const requestFrom = bodyText.match(/request\s+from\s+([A-Za-z][A-Za-z\s.'-]{1,80})\s*:/i);
        if (requestFrom?.[1]) return this.cleanInlineField(requestFrom[1]);

        const salutation = bodyText.match(/^\s*([A-Za-z][A-Za-z\s.'-]{1,80})\s*,\s*(?:<br\s*\/?>|\n|\r)/i);
        if (salutation?.[1]) return this.cleanInlineField(salutation[1]);

        return '';
    }

    private cleanInlineField(value: string): string {
        return value
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^[,\s]+|[,\s]+$/g, '')
            .trim();
    }

    private cleanDescription(value: string): string {
        const original = value || '';
        let text = original
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/\r/g, '');

        // Trim quoted replies/forwards.
        const replyMarkers = [
            /^\s*On .+wrote:\s*$/im,
            /^\s*From:\s.+$/im,
            /^\s*-----Original Message-----\s*$/im,
            /^\s*---+\s*Forwarded message\s*---+\s*$/im,
        ];
        for (const marker of replyMarkers) {
            const m = text.match(marker);
            if (m && typeof m.index === 'number') {
                text = text.slice(0, m.index);
            }
        }

        // Cut automated footer/disclaimer blocks.
        const footerMarkers = [
            /^\s*This email was sent to .+$/im,
            /^\s*This e-?mail and any attachments?.+$/im,
            /^\s*The information contained in this (e-?mail|message).+$/im,
            /^\s*Confidentiality Notice[:\s].+$/im,
        ];
        for (const marker of footerMarkers) {
            const m = text.match(marker);
            if (m && typeof m.index === 'number') {
                text = text.slice(0, m.index);
            }
        }

        // Remove common sign-off/signature tails when they appear near the end.
        text = text
            .replace(/\n\s*(best regards|kind regards|regards|thanks|thank you),?\s*\n[\s\S]*$/i, '\n')
            .replace(/\n\s*sent from my (iphone|ipad|android).*/i, '\n');

        text = text
            .replace(/^\s*Description\s*:\s*/i, '')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        // Safety fallback: if cleanup over-pruned, keep normalized original.
        if (text.length < 30 && original.length > 80) {
            return this.cleanInlineField(original);
        }

        return text;
    }
    /**
     * Parses the raw email body and subject to extract ticket information.
     *
     * Example format:
     * Ticket #: T20260219.0006
     * Title: set up bookings page in outlook please
     * Description: Please remotely sign in...
     * Created by: Lisa Case
     */
    parseEmail(subject: string, bodyText: string, receivedDateTime?: string): ParsedTicket | null {
        // Determine if it's a thread update
        const isReply = subject.toUpperCase().startsWith('RE:');

        // Extract Ticket ID
        // Look for TICKET #: T... or TICKET # T... or Ticket #: T...
        const idMatch = bodyText.match(/Ticket\s*#?:\s*(T\d{8}\.\d+)/i) || subject.match(/TICKET\s*#?\s*(T\d{8}\.\d+)/i);
        const id = idMatch ? idMatch[1] : null;

        if (!id) {
            operationalLogger.warn('adapters.email_parser.ticket_id_not_found', {
                module: 'adapters.email.email-parser',
                signal: 'integration_failure',
                degraded_mode: true,
                subject_preview: subject.slice(0, 120),
            });
            return null;
        }

        // Extract Title
        let title = '';
        const titleMatch = bodyText.match(/Title:\s*([\s\S]*?)(?=\bDescription\s*:|\bCreated\s+by\b|\bTicket\s*#?:|$)/i);
        if (titleMatch?.[1]) {
            title = this.cleanInlineField(titleMatch[1]);
        } else {
            const subjectTemplateMatch =
                subject.match(/A NEW TICKET has been received for .*? - (.*?) - T\d{8}\.\d+/i) ||
                subject.match(/-\s*(.*?)\s*-\s*T\d{8}\.\d+/i);
            if (subjectTemplateMatch?.[1]) {
                title = this.cleanInlineField(subjectTemplateMatch[1]);
            }
        }

        if (!title) {
            // Fallback: clean the subject line
            title = this.cleanInlineField(
                subject
                    .replace(/RE:\s*/i, '')
                    .replace(/FW:\s*/i, '')
                    .replace(/TICKET\s*#?\s*T\d{8}\.\d+\s*:?\s*/i, '')
            );
        }

        // Extract Description
        let description = '';
        const descMatch = bodyText.match(/Description:\s*([\s\S]*?)(?=Created by:|$)/i);
        if (descMatch?.[1]) {
            description = this.cleanDescription(descMatch[1]);
        } else {
            // Fallback: use body preview or first chunk of body
            description = this.cleanDescription(bodyText.substring(0, 500));
        }

        // Extract Requester (requested-for user first, then creator fallback)
        let requester = 'Unknown';
        const endUser = this.extractEndUser(bodyText);
        if (endUser) {
            requester = endUser;
        }
        const reqMatch =
            bodyText.match(/Created by:\s*([^\n<]+)/i) ||
            bodyText.match(/Created on\s+[^\n<]*?\s+by\s+([^\n<]+)/i);
        if (requester === 'Unknown' && reqMatch?.[1]) {
            requester = this.cleanInlineField(reqMatch[1]);
        }

        // Extract Company
        let company = '';
        const companyMatch = bodyText.match(/has been created for\s+(.+?)\.\s*we will attend/i);
        if (companyMatch?.[1]) {
            company = this.cleanInlineField(companyMatch[1]);
        }

        // Extract ticket creation time from body when available, fallback to email received time.
        // Supports common patterns like:
        // - Created at: 2026-02-20T10:05:00Z
        // - Created on: 2026-02-20 10:05 AM
        const createdMatch = bodyText.match(/Created\s*(?:at|on|date|time)?\s*:?\s*([^\n<]+?)(?=\s+by\b|$)/i);
        const createdCandidate = createdMatch?.[1]?.trim();
        const createdFromBody = createdCandidate ? new Date(createdCandidate) : null;
        const createdFromEmail = receivedDateTime ? new Date(receivedDateTime) : null;
        const createdAt =
            createdFromBody && !Number.isNaN(createdFromBody.getTime())
                ? createdFromBody.toISOString()
                : createdFromEmail && !Number.isNaN(createdFromEmail.getTime())
                    ? createdFromEmail.toISOString()
                    : new Date().toISOString();

        return {
            id,
            title,
            description,
            company,
            requester,
            createdAt,
            source: 'email_ingestion',
            status: isReply ? 'updated' : 'new',
            rawBody: bodyText,
            isReply
        };
    }

    /**
     * Prepares the evidence JSON payload required for the PrepareContext/Diagnose steps.
     */
    toEvidencePackFormat(parsed: ParsedTicket) {
        return {
            ticket: {
                id: parsed.id,
                title: parsed.title,
                description: parsed.description,
                created_at: parsed.createdAt,
                priority: 'Normal', // Default fallback
                category: 'Network' // Default fallback, as per MVP scope
            },
            user: { name: parsed.requester, email: '' },
            // Other context empty as email alone doesn't provide it
        };
    }
}

export const emailParser = new EmailParser();
