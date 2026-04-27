import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportOfftakeToExcel } from '../utils/reportExports';

describe('OfftakeReport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has exportOfftakeToExcel function', () => {
    expect(typeof exportOfftakeToExcel).toBe('function');
  });
});