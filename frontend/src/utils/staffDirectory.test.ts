import { describe, expect, it } from 'vitest';

import {
  addStaffDirectoryEntry,
  filterStaffDirectoryByType,
  normalizeStaffDirectorySettings,
  removeStaffDirectoryEntry,
  type StaffDirectoryEntry,
} from './staffDirectory';

describe('normalizeStaffDirectorySettings', () => {
  it('uses staff_directory entries when present', () => {
    const entries = normalizeStaffDirectorySettings({
      staff_directory: [
        { name: 'Mike', type: 'service_advisor' },
        { name: 'Jun', type: 'mechanic' },
      ],
      service_advisors: ['Legacy SA'],
    });

    expect(entries).toEqual([
      { name: 'Mike', type: 'service_advisor' },
      { name: 'Jun', type: 'mechanic' },
    ]);
  });

  it('falls back to legacy service_advisors when staff_directory is absent', () => {
    const entries = normalizeStaffDirectorySettings({
      service_advisors: ['Mike', '  Ana  '],
    });

    expect(entries).toEqual([
      { name: 'Mike', type: 'service_advisor' },
      { name: 'Ana', type: 'service_advisor' },
    ]);
  });
});

describe('staffDirectory helpers', () => {
  it('filters entries by type', () => {
    const entries: StaffDirectoryEntry[] = [
      { name: 'Mike', type: 'service_advisor' },
      { name: 'Jun', type: 'mechanic' },
      { name: 'Paul', type: 'carwasher' },
    ];

    expect(filterStaffDirectoryByType(entries, 'mechanic')).toEqual([
      { name: 'Jun', type: 'mechanic' },
    ]);
  });

  it('rejects duplicate names within the same type using trimmed case-insensitive comparison', () => {
    const entries: StaffDirectoryEntry[] = [
      { name: 'Mike', type: 'service_advisor' },
    ];

    expect(() => addStaffDirectoryEntry(entries, { name: '  mike  ', type: 'service_advisor' })).toThrow(
      'A Service Advisor named Mike already exists.',
    );
  });

  it('removes one exact name-and-type entry', () => {
    const entries: StaffDirectoryEntry[] = [
      { name: 'Mike', type: 'service_advisor' },
      { name: 'Mike', type: 'mechanic' },
    ];

    expect(removeStaffDirectoryEntry(entries, { name: 'Mike', type: 'mechanic' })).toEqual([
      { name: 'Mike', type: 'service_advisor' },
    ]);
  });
});
