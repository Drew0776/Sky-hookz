import { describe, it, expect } from 'vitest';

describe('API Integration Tests', () => {
  const API_URL = 'http://localhost:3000';

  it('should fetch bundles from API', async () => {
    const response = await fetch(`${API_URL}/api/bundles`);
    expect(response.status).toBe(200);
    const bundles = await response.json();
    expect(Array.isArray(bundles)).toBe(true);
  });

  it('should fetch jobs from API', async () => {
    const response = await fetch(`${API_URL}/api/jobs`);
    expect(response.status).toBe(200);
    const jobs = await response.json();
    expect(Array.isArray(jobs)).toBe(true);
  });

  it('should fetch dashboard metrics', async () => {
    const response = await fetch(`${API_URL}/api/dashboard`);
    expect(response.status).toBe(200);
    const metrics = await response.json();
    expect(metrics).toHaveProperty('bendingCount');
    expect(metrics).toHaveProperty('totalActiveJobs');
  });

  it('should handle health check', async () => {
    const response = await fetch(`${API_URL}/api/health`);
    expect(response.status).toBe(200);
    const health = await response.json();
    expect(health.status).toBe('ok');
  });
});
