import { describe, expect, it } from 'vitest';
import type { User } from '../context/AuthContextObject';
import { getBranchDisplayName } from './branchDisplay';

describe('getBranchDisplayName', () => {
  it('returns the real branch name when it exists', () => {
    const user = {
      id: 1,
      name: 'Sidney',
      email: 'sidney@example.com',
      role: 'admin',
      branch_id: 4,
      created_at: new Date().toISOString(),
      branch: {
        id: 4,
        name: 'LIPA A',
        code: 'LA',
      },
    } satisfies User;

    expect(getBranchDisplayName(user)).toBe('LIPA A');
  });

  it('falls back to the branch id when branch details are missing', () => {
    const user = {
      id: 1,
      name: 'Sidney',
      email: 'sidney@example.com',
      role: 'admin',
      branch_id: 4,
      created_at: new Date().toISOString(),
    } satisfies User;

    expect(getBranchDisplayName(user)).toBe('Branch #4');
  });

  it('returns an empty string when no branch information exists', () => {
    expect(getBranchDisplayName(null)).toBe('');
  });
});
