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
            description = descMatch[1].trim();
        } else {
            // Fallback: use body preview or first chunk of body
            description = bodyText.substring(0, 500).trim();
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
