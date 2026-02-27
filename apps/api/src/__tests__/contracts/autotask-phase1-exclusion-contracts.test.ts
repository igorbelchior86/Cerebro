import {
  AUTOTASK_PHASE1_EXCLUSION_IMPLEMENTATION_CONTRACTS,
  AUTOTASK_PHASE1_FULL_API_CAPABILITY_MATRIX,
} from '@playbook-brain/types';

describe('Autotask Phase 1 exclusion implementation contracts (Wave 0)', () => {
  it('has no remaining excluded rows after Wave B implementation', () => {
    const excludedRows = AUTOTASK_PHASE1_FULL_API_CAPABILITY_MATRIX.filter((row) =>
      row.status === 'excluded_by_permission' || row.status === 'excluded_by_api_limitation'
    );
    expect(excludedRows).toHaveLength(0);
  });

  it('requires endpoint + payload schema + test definition for every exclusion contract', () => {
    for (const entry of AUTOTASK_PHASE1_EXCLUSION_IMPLEMENTATION_CONTRACTS) {
      expect(entry.endpoints.length).toBeGreaterThan(0);
      expect(entry.payload_schema.length).toBeGreaterThan(0);
      expect(entry.validation_rules.length).toBeGreaterThan(0);
      expect(entry.target_modules.length).toBeGreaterThan(0);
      expect(entry.test_required.trim().length).toBeGreaterThan(0);
    }
  });
});
