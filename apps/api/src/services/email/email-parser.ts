export interface ParsedTicket {
    id: string;
    title: string;
    description: string;
    requester: string;
    createdAt: string;
    source: 'email_ingestion';
    status: 'new' | 'updated';
    rawBody: string;
    isReply: boolean;
}

export class EmailParser {
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
            console.warn('[EmailParser] Could not extract Ticket ID from email.', { subject });
            return null;
        }

        // Extract Title
        let title = '';
        const titleMatch = bodyText.match(/Title:\s*([\s\S]*?)(?=\bDescription\s*:|\bCreated\s+by\b|\bTicket\s*#?:|$)/i);
        if (titleMatch?.[1]) {
            title = this.cleanInlineField(titleMatch[1]);
        } else {
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

        // Extract Requester
        let requester = 'Unknown';
        const reqMatch = bodyText.match(/Created by:\s*([^\n]+)/i);
        if (reqMatch?.[1]) {
            requester = reqMatch[1].trim();
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
