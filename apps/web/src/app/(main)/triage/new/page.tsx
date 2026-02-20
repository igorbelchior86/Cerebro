'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function NewTriageSession() {
  const router = useRouter();
  const [ticketId, setTicketId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Create triage session
      const sessionRes = await axios.post(`${apiUrl}/triage/sessions`, {
        ticket_id: ticketId,
        org_id: orgId,
        created_by: 'web_ui',
      });

      const sessionId = sessionRes.data.id;

      // Redirect to session page
      router.push(`/triage/${sessionId}`);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : String(err);
      setError(String(message));
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">New Triage Session</h1>

      <div className="bg-white rounded-lg border border-gray-100 p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-brand-900 mb-2">
              Ticket ID *
            </label>
            <input
              type="text"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g., T-12345"
              className="w-full px-4 py-2 border border-brand-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-sm text-brand-600 mt-1">
              The Autotask ticket ID to triage
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-900 mb-2">
              Organization ID
            </label>
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="e.g., org-456"
              className="w-full px-4 py-2 border border-brand-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-brand-600 mt-1">
              Optional. Organization/company ID for context
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-brand-300 text-white font-semibold py-3 rounded-lg transition"
          >
            {loading ? 'Creating Session...' : 'Start Triage Session'}
          </button>
        </form>

        <div className="mt-8 bg-gray-50 rounded-lg p-6 border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-3">What happens next?</h3>
          <ol className="space-y-2 text-sm text-gray-700">
            <li>✓ System collects evidence from Autotask, NinjaOne, IT Glue</li>
            <li>✓ AI analyzes the ticket and generates diagnosis</li>
            <li>✓ Safety validation checks the diagnosis</li>
            <li>✓ Playbook is generated and ready to execute</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
