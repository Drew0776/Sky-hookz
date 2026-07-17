import { describe, it, expect, beforeEach } from 'vitest';
import { calculateZoneCapacity, validateMaterialConstraints, estimateJobCompletion } from '../src/utils/logistics';

describe('Logistics Utilities', () => {
  describe('calculateZoneCapacity', () => {
    it('should calculate zone capacity correctly', () => {
      const bundles = [
        { id: '1', location: 'Rack-J-04', weight: 30000 },
        { id: '2', location: 'Rack-J-04', weight: 20000 },
      ];

      const result = calculateZoneCapacity(bundles, 'Rack-J-04', 75000);
      expect(result.weight).toBe(50000);
      expect(result.percentage).toBe((50000 / 75000) * 100);
      expect(result.status).toBe('WARNING');
    });

    it('should return CRITICAL status when capacity exceeds 85%', () => {
      const bundles = [{ id: '1', location: 'Zone-A', weight: 65000 }];
      const result = calculateZoneCapacity(bundles, 'Zone-A', 75000);
      expect(result.status).toBe('CRITICAL');
    });

    it('should return OK status when capacity is below 60%', () => {
      const bundles = [{ id: '1', location: 'Zone-A', weight: 30000 }];
      const result = calculateZoneCapacity(bundles, 'Zone-A', 75000);
      expect(result.status).toBe('OK');
    });
  });

  describe('validateMaterialConstraints', () => {
    it('should allow Black rebar in SW zones only', () => {
      const blackBundle = { grade: 'Black', tagId: 'TG-001' };
      
      expect(validateMaterialConstraints(blackBundle, 'Raw-SW').valid).toBe(true);
      expect(validateMaterialConstraints(blackBundle, 'Door-7').valid).toBe(true);
      expect(validateMaterialConstraints(blackBundle, 'Rack J-04').valid).toBe(false);
    });

    it('should prevent Epoxy rebar in Black-only racks', () => {
      const epoxyBundle = { grade: 'Epoxy', tagId: 'TG-002' };
      
      expect(validateMaterialConstraints(epoxyBundle, 'Rack J-20').valid).toBe(false);
      expect(validateMaterialConstraints(epoxyBundle, 'Rack J-04').valid).toBe(true);
    });

    it('should allow Epoxy rebar in general zones', () => {
      const epoxyBundle = { grade: 'Epoxy', tagId: 'TG-003' };
      
      expect(validateMaterialConstraints(epoxyBundle, 'Coat-Station').valid).toBe(true);
      expect(validateMaterialConstraints(epoxyBundle, 'Shear-North').valid).toBe(true);
    });
  });

  describe('estimateJobCompletion', () => {
    it('should estimate job completion percentage', () => {
      const job = { id: 'JOB-01', totalBundles: 10, completedBundles: 5 };
      const bundles = [
        { jobId: 'JOB-01', status: 'LOADED', barSize: '#8' },
        { jobId: 'JOB-01', status: 'RAW', barSize: '#8' },
      ];

      const result = estimateJobCompletion(job, bundles);
      expect(result.percentComplete).toBe(50);
      expect(result.estimatedMinutes).toBeGreaterThan(0);
    });
  });
});
