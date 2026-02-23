import { execute } from '../apps/api/src/db/index.js';

async function resetAllSessions() {
    console.log('--- Resetting All Triage Sessions and Artifacts ---');

    try {
        // 1. Clear artifact tables
        console.log('Clearing evidence_packs...');
        await execute('DELETE FROM evidence_packs');

        console.log('Clearing llm_outputs...');
        await execute('DELETE FROM llm_outputs');

        console.log('Clearing validation_results...');
        await execute('DELETE FROM validation_results');

        console.log('Clearing playbooks...');
        await execute('DELETE FROM playbooks');

        // 2. Reset session status to pending
        console.log('Resetting triage_sessions status to "pending"...');
        const result = await execute('UPDATE triage_sessions SET status = \'pending\', updated_at = NOW()');

        console.log('✅ Success: All sessions reset. Handled rows:', (result as any)?.rowCount || 'unknown');
        console.log('Ready to test the pipeline/quota logic.');
    } catch (error) {
        console.error('❌ Error during reset:', error);
    }
}

resetAllSessions().catch(console.error);
