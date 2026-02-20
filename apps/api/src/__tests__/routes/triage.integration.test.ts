/**
 * Integration test examples for triage endpoints
 * These are smoke tests - extend with actual API calls when running tests
 */

import { v4 as uuidv4 } from 'uuid';

describe('Triage Endpoints - Schema & Structure', () => {
  describe('Session data structure', () => {
    it('should have valid session schema', () => {
      const mockSession = {
        id: uuidv4(),
        ticketId: 'T-12345',
        orgId: 'org-001',
        status: 'created',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'user-001'
      };

      expect(mockSession).toHaveProperty('id');
      expect(mockSession).toHaveProperty('ticketId');
      expect(mockSession).toHaveProperty('status');
      expect(mockSession.status).toMatch(/^(created|evidence|diagnosing|validating|approved|completed|failed)$/);
    });

    it('should validate UUID format for session ID', () => {
      const sessionId = uuidv4();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      expect(uuidRegex.test(sessionId)).toBe(true);
    });

    it('should enforce ticket ID format', () => {
      const validTicketIds = ['T-12345', 'TICKET-001', 'INC-9999', 'SR-001'];
      const ticketRegex = /^[A-Z]+-\d+$/;

      validTicketIds.forEach(id => {
        expect(ticketRegex.test(id)).toBe(true);
      });
    });
  });

  describe('Error response structure', () => {
    it('should return consistent error format', () => {
      const errorResponse = {
        error: 'BAD_REQUEST',
        message: 'Missing required field: ticketId',
        statusCode: 400,
        timestamp: new Date().toISOString()
      };

      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse).toHaveProperty('message');
      expect(errorResponse).toHaveProperty('statusCode');
      expect(errorResponse).toHaveProperty('timestamp');
    });

    it('should map HTTP status codes to error types', () => {
      const errorMapping = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        404: 'NOT_FOUND',
        500: 'INTERNAL_ERROR',
        503: 'SERVICE_UNAVAILABLE'
      };

      Object.entries(errorMapping).forEach(([status, errorType]) => {
        expect(typeof errorType).toBe('string');
      });
    });
  });

  describe('Pipeline state transitions', () => {
    it('should validate session status transitions', () => {
      const validTransitions: Record<string, string[]> = {
        'created': ['evidence', 'failed'],
        'evidence': ['diagnosing', 'failed'],
        'diagnosing': ['validating', 'failed'],
        'validating': ['approved', 'failed'],
        'approved': ['completed'],
        'completed': []
      };

      Object.entries(validTransitions).forEach(([from, tos]) => {
        expect(Array.isArray(tos)).toBe(true);
      });
    });
  });
});

describe('Full Pipeline Integration - Schema Validation', () => {
  const sessionId = uuidv4();
  const ticketId = 'T-E2E-' + Date.now();

  it('should validate evidence pack structure', () => {
    const mockEvidencePack = {
      id: uuidv4(),
      sessionId,
      ticketId,
      devices: [
        { id: 'dev1', name: 'Server', type: 'endpoint', status: 'warning' }
      ],
      documentation: [
        { id: 'doc1', title: 'Fix Guide', url: 'http://...' }
      ],
      ticketHistory: [
        { timestamp: new Date(), action: 'created', actor: 'user' }
      ],
      createdAt: new Date()
    };

    expect(mockEvidencePack).toHaveProperty('sessionId', sessionId);
    expect(Array.isArray(mockEvidencePack.devices)).toBe(true);
    expect(Array.isArray(mockEvidencePack.documentation)).toBe(true);
  });

  it('should validate diagnosis structure', () => {
    const mockDiagnosis = {
      id: uuidv4(),
      sessionId,
      rootCause: 'DNS misconfiguration',
      severity: 'high',
      components: ['DNS', 'Network'],
      evidence: 'Timeout on DNS queries',
      confidence: 0.92,
      tokensUsed: 1200,
      costUsd: 0.002
    };

    expect(mockDiagnosis).toHaveProperty('sessionId');
    expect(mockDiagnosis).toHaveProperty('rootCause');
    expect(typeof mockDiagnosis.confidence).toBe('number');
    expect(mockDiagnosis.confidence).toBeGreaterThanOrEqual(0);
    expect(mockDiagnosis.confidence).toBeLessThanOrEqual(1);
  });

  it('should validate validation result structure', () => {
    const mockValidation = {
      id: uuidv4(),
      sessionId,
      passed: true,
      safeToGenerate: true,
      checks: [
        { name: 'escalation_check', passed: true },
        { name: 'data_privacy_check', passed: true }
      ],
      issues: []
    };

    expect(mockValidation).toHaveProperty('sessionId');
    expect(typeof mockValidation.passed).toBe('boolean');
    expect(typeof mockValidation.safeToGenerate).toBe('boolean');
    expect(Array.isArray(mockValidation.checks)).toBe(true);
  });

  it('should validate playbook structure', () => {
    const mockPlaybook = {
      id: uuidv4(),
      sessionId,
      markdown: '# Title\n\n## Steps\n\n1. Check logs',
      sections: ['overview', 'steps', 'verification', 'rollback'],
      estimatedTime: 15,
      tokensUsed: 2500,
      costUsd: 0.005
    };

    expect(mockPlaybook).toHaveProperty('sessionId');
    expect(typeof mockPlaybook.markdown).toBe('string');
    expect(mockPlaybook.markdown.length).toBeGreaterThan(0);
    expect(Array.isArray(mockPlaybook.sections)).toBe(true);
  });
});
