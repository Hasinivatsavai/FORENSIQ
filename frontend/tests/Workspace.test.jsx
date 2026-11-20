import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import Workspace from '../src/workspace/Workspace.jsx';
import { api } from '../src/api.js';

vi.mock('../src/api.js', () => ({ api: vi.fn() }));

const admin = { id: 'test-admin', name: 'Alex Reviewer', role: 'admin' };
const emptyDashboard = {
  counts: { cases: 0, open_cases: 0, evidence: 0, verified: 0 },
  by_classification: [], by_status: [], recent_cases: [], recent_events: [],
};

// jsdom represents <dialog> but does not implement the native open/close methods.
const dialogPrototype = HTMLDialogElement.prototype;
const originalDialogMethods = Object.getOwnPropertyDescriptors(dialogPrototype);
beforeAll(() => {
  Object.defineProperty(dialogPrototype, 'showModal', { configurable: true, value() { this.open = true; } });
  Object.defineProperty(dialogPrototype, 'close', { configurable: true, value() { this.open = false; } });
});
afterAll(() => {
  for (const method of ['showModal', 'close']) {
    if (originalDialogMethods[method]) Object.defineProperty(dialogPrototype, method, originalDialogMethods[method]);
    else delete dialogPrototype[method];
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  api.mockReset();
  history.replaceState(null, '', '/');
});

it('opens a case from the empty dashboard and navigates to the case ID returned by the API', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const title = 'Classroom evidence file';
  const record = {
    id: '2b4faed2-02a8-4f11-b063-dbf883d2bb00', code: 'CASE-000001', title,
    description: '', priority: 'high', status: 'open', owner_id: admin.id, owner_name: admin.name,
    created_at: '2026-10-01T12:00:00Z', members: [], notes: [], evidence: [],
  };
  api.mockImplementation(async (route, options = {}) => {
    if (route === '/dashboard') return emptyDashboard;
    if (route === '/cases' && options.method === 'POST') return record;
    if (route === '/cases/' + record.id) return record;
    throw new Error('Unexpected test request: ' + route);
  });

  const user = userEvent.setup();
  render(<Workspace user={admin} theme="light" onToggleTheme={() => {}} onLogout={vi.fn()} />);
  expect(await screen.findByText('No cases found')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Accessible cases 0/ })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Create a case' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Create a case' }));
  await user.type(dialog.getByLabelText('Case title'), title);
  await user.selectOptions(dialog.getByLabelText('Priority'), 'high');
  await user.click(dialog.getByRole('button', { name: 'Create case' }));

  expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
  expect(api).toHaveBeenCalledWith('/cases', {
    method: 'POST', body: { title, priority: 'high', description: '' },
  });
  expect(location.hash).toBe('#/cases/' + record.id);
  expect(screen.getByText('Case created.')).toBeTruthy();
});


it('shows read-only navigation for a viewer', async () => {
  api.mockResolvedValue(emptyDashboard);
  render(<Workspace user={{ ...admin, role: 'viewer' }} theme="light" onToggleTheme={() => {}} onLogout={vi.fn()} />);
  expect(await screen.findByText('No cases found')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Case files' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Create a case' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Team directory' })).toBeNull();
});
