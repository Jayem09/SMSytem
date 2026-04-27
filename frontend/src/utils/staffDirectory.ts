export type StaffDirectoryType = 'service_advisor' | 'mechanic' | 'carwasher';

export interface StaffDirectoryEntry {
  name: string;
  type: StaffDirectoryType;
}

const STAFF_DIRECTORY_TYPES = new Set<StaffDirectoryType>([
  'service_advisor',
  'mechanic',
  'carwasher',
]);

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function toLabel(type: StaffDirectoryType): string {
  switch (type) {
    case 'service_advisor':
      return 'Service Advisor';
    case 'mechanic':
      return 'Mechanic';
    case 'carwasher':
      return 'Carwasher';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeStructuredEntries(raw: unknown): StaffDirectoryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter(isRecord)
    .map((entry) => ({
      name: normalizeName(String(entry.name ?? '')),
      type: String(entry.type ?? '') as StaffDirectoryType,
    }))
    .filter((entry) => entry.name.length > 0 && STAFF_DIRECTORY_TYPES.has(entry.type));
}

function normalizeLegacyServiceAdvisors(raw: unknown): StaffDirectoryEntry[] {
  const values = Array.isArray(raw) ? raw : [];

  return values
    .map((value) => normalizeName(String(value ?? '')))
    .filter((name) => name.length > 0)
    .map((name) => ({ name, type: 'service_advisor' as const }));
}

export function normalizeStaffDirectorySettings(settings: {
  staff_directory?: unknown;
  service_advisors?: unknown;
}): StaffDirectoryEntry[] {
  const structuredEntries = normalizeStructuredEntries(settings.staff_directory);
  if (structuredEntries.length > 0) {
    return structuredEntries;
  }

  return normalizeLegacyServiceAdvisors(settings.service_advisors);
}

export function filterStaffDirectoryByType(
  entries: StaffDirectoryEntry[],
  type: StaffDirectoryType,
): StaffDirectoryEntry[] {
  return entries.filter((entry) => entry.type === type);
}

export function addStaffDirectoryEntry(
  entries: StaffDirectoryEntry[],
  nextEntry: StaffDirectoryEntry,
): StaffDirectoryEntry[] {
  const normalizedName = normalizeName(nextEntry.name);
  if (!normalizedName) {
    throw new Error('Name is required.');
  }

  const duplicate = entries.find(
    (entry) =>
      entry.type === nextEntry.type &&
      normalizeName(entry.name).toLowerCase() === normalizedName.toLowerCase(),
  );

  if (duplicate) {
    throw new Error(`A ${toLabel(nextEntry.type)} named ${duplicate.name} already exists.`);
  }

  return [...entries, { name: normalizedName, type: nextEntry.type }];
}

export function removeStaffDirectoryEntry(
  entries: StaffDirectoryEntry[],
  target: StaffDirectoryEntry,
): StaffDirectoryEntry[] {
  return entries.filter((entry) => !(entry.name === target.name && entry.type === target.type));
}
