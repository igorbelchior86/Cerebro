import { resolveAutotaskOperation } from '../../services/adapters/autotask-operation-registry.js';

describe('Autotask operation registry (Prompt B unblocked surface)', () => {
  it('resolves newly unblocked operations to concrete handlers', () => {
    expect(resolveAutotaskOperation('update_priority', { ticket_id: 'T1', priority: 2 })).toMatchObject({
      rejected: false,
      operation: { handler: 'update_priority', canonical_operation: 'tickets.update_priority' },
    });
    expect(resolveAutotaskOperation('checklist_create', { ticket_id: 'T1', title: 'Confirm reboot' })).toMatchObject({
      rejected: false,
      operation: { handler: 'checklist_create', canonical_operation: 'ticket_checklist_items.create' },
    });
    expect(resolveAutotaskOperation('contact_create', { company_id: 1, first_name: 'Ada', last_name: 'Lovelace' })).toMatchObject({
      rejected: false,
      operation: { handler: 'contact_create', canonical_operation: 'contacts.create' },
    });
    expect(resolveAutotaskOperation('companies_query_search', { search: { op: 'contains', field: 'companyName', value: 'Acme' } })).toMatchObject({
      rejected: false,
      operation: { handler: 'companies_query', canonical_operation: 'companies.query_search' },
    });
  });

  it('rejects destructive operations without explicit approval token', () => {
    expect(resolveAutotaskOperation('delete', { ticket_id: 'T1' })).toEqual({
      rejected: true,
      reason: 'missing_destructive_approval_token',
    });
    expect(resolveAutotaskOperation('time_entry_delete', { id: 11 })).toEqual({
      rejected: true,
      reason: 'missing_destructive_approval_token',
    });
    expect(resolveAutotaskOperation('checklist_delete', { ticket_id: 'T1', checklist_item_id: 22 })).toEqual({
      rejected: true,
      reason: 'missing_destructive_approval_token',
    });
  });
});
