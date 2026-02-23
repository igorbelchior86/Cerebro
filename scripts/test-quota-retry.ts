import { TriageOrchestrator } from '../apps/api/src/services/triage-orchestrator';
import { LLMQuotaExceededError } from '../apps/api/src/services/llm-adapter';
import { execute, queryOne } from '../apps/api/src/db';

async function testRetryLogic() {
    console.log('--- Testing Quota Retry Logic ---');

    // 1. Create a dummy ticket and session
    const ticketId = 'test-retry-' + Date.now();
    const session = await queryOne<{ id: string }>(
        'INSERT INTO triage_sessions (ticket_id, status) VALUES ($1, $2) RETURNING id',
        [ticketId, 'processing']
    );
    const sessionId = session?.id;
    if (!sessionId) {
        throw new Error('Failed to create test session');
    }

    const orchestrator = new TriageOrchestrator();

    // 2. Mock a failure that should trigger 'pending'
    console.log('Simulating LLM Quota Exceeded...');
    try {
        // We'll manually trigger the logic that happens in runPipeline's catch block
        // by pretending an error occurred during processing.
        throw new LLMQuotaExceededError('Gemini', 'Quota reached in test');
    } catch (error: any) {
        if (error.name === 'LLMQuotaExceededError') {
            await (orchestrator as any).markPendingForRetry(sessionId, 'Quota reached in test');
            console.log('Successfully marked session as pending with retry metadata.');
        }
    }

    // 3. Verify status in DB
    const persisted = await queryOne<{ status: string; retry_count: number; next_retry_at: string | null }>(
        'SELECT status, retry_count, next_retry_at FROM triage_sessions WHERE ticket_id = $1',
        [ticketId]
    );
    console.log('Current Session Status in DB:', persisted?.status);

    if (persisted?.status === 'pending') {
        console.log('✅ PASS: Session marked as pending for retry.');
    } else {
        console.log('❌ FAIL: Session status is', persisted?.status);
    }

    // 4. Clean up
    await execute('DELETE FROM triage_sessions WHERE ticket_id = $1', [ticketId]);
}

testRetryLogic().catch(console.error);
