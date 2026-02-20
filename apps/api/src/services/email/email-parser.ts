export interface ParsedTicket {
    id: string;
    title: string;
    description: string;
    requester: string;
    source: 'email_ingestion';
    status: 'new' | 'updated';
    rawBody: string;
    isReply: boolean;
}

export class EmailParser {
    /**
     * Parses the raw email body and subject to extract ticket information.
     *
     * Example format:
     * Ticket #: T20260219.0006
     * Title: set up bookings page in outlook please
     * Description: Please remotely sign in...
     * Created by: Lisa Case
     */
    parseEmail(subject: string, bodyText: string): ParsedTicket | null {
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
        const titleMatch = bodyText.match(/Title:\s*([^\n]+)/i);
        if (titleMatch?.[1]) {
            title = titleMatch[1].trim();
        } else {
            // Fallback: clean the subject line
            title = subject.replace(/RE:\s*/i, '').replace(/FW:\s*/i, '').trim();
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

        return {
            id,
            title,
            description,
            requester,
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
                created_at: new Date().toISOString(),
                priority: 'Normal', // Default fallback
                category: 'Network' // Default fallback, as per MVP scope
            },
            user: { name: parsed.requester, email: '' },
            // Other context empty as email alone doesn't provide it
        };
    }
}

export const emailParser = new EmailParser();
