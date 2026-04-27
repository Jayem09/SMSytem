import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

const { mockApiGet, mockApiPost, mockShowToast } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockShowToast: vi.fn(),
}));

vi.mock('../api/axios', () => ({
  default: {
    get: mockApiGet,
    post: mockApiPost,
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, role: 'super_admin' } }),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('../components/DataTable', () => ({
  default: () => <div data-testid="account-table" />,
}));

vi.mock('../components/Modal', () => ({
  default: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? <div><h2>{title}</h2>{children}</div> : null,
}));

import Staff from './Staff';

describe('Staff directory management', () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/users') return Promise.resolve({ data: { users: [] } });
      if (url === '/api/branches') return Promise.resolve({ data: { branches: [{ id: 1, name: 'Main' }] } });
      if (url === '/api/settings') {
        return Promise.resolve({
          data: {
            staff_directory: [
              { name: 'Mike', type: 'service_advisor' },
              { name: 'Jun', type: 'mechanic' },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    document.body.innerHTML = '';
  });

  async function renderStaffPage() {
    const container = document.getElementById('root');
    if (!container) throw new Error('Missing root container');

    root = createRoot(container);
    await act(async () => {
      root?.render(<Staff />);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('renders named staff entries from staff_directory', async () => {
    await renderStaffPage();

    expect(document.body.textContent).toContain('Add Staff Name');
    expect(document.body.textContent).toContain('Mike');
    expect(document.body.textContent).toContain('Jun');
  });

  it('falls back to legacy service_advisors when staff_directory is absent', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/users') return Promise.resolve({ data: { users: [] } });
      if (url === '/api/branches') return Promise.resolve({ data: { branches: [{ id: 1, name: 'Main' }] } });
      if (url === '/api/settings') return Promise.resolve({ data: { service_advisors: ['Legacy Mike'] } });
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    await renderStaffPage();

    expect(document.body.textContent).toContain('Legacy Mike');
    expect(document.body.textContent).toContain('Service Advisor');
  });

  it('shows the add staff name modal when button is clicked', async () => {
    mockApiPost.mockResolvedValue({ data: { message: 'ok' } });
    await renderStaffPage();

    // Click the Add Staff Name button
    const openButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Add Staff Name'),
    ) as HTMLButtonElement;
    openButton.click();

    await act(async () => {
      await Promise.resolve();
    });

    // Modal should now be visible with the form
    expect(document.body.textContent).toContain('Name');
    expect(document.body.textContent).toContain('Type');
    expect(document.body.textContent).toContain('Service Advisor');
    expect(document.body.textContent).toContain('Mechanic');
    expect(document.body.textContent).toContain('Save Staff Name');
  });
});