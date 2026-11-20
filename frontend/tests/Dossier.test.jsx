import React from 'react';
import { Blob as FileBlob } from 'node:buffer';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Workspace from '../src/workspace/Workspace.jsx';
import { api } from '../src/api.js';

vi.mock('../src/api.js', () => ({ api: vi.fn() }));

const caseId = 'e88aa8ac-6cf5-48ed-ab7c-37138ec18b30';
const timestamp = '2026-11-18T09:00:00Z';
const digest = 'ad'.repeat(32);
const viewer = { id: 'viewer', name: 'Report reviewer', role: 'viewer' };
const emptyReport = {
  id: caseId,
  code: 'CF-240',
  title: 'Preservation review',
  status: 'open',
  priority: 'high',
  owner_name: 'Case owner',
  exported_by: viewer.name,
  exported_at: timestamp,
  created_at: timestamp,
  members: [],
  evidence: [],
  notes: [],
  custody: [],
  integrity_checks: [],
  relationships: [],
  activity: [],
};
function openReport() {
  history.replaceState(null, '', '/#/reports/' + caseId);
  render(<Workspace user={viewer} theme="light" onToggleTheme={vi.fn()} onLogout={vi.fn()} />);
}

afterEach(() => {
  cleanup();
  api.mockReset();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  history.replaceState(null, '', '/');
});

it('opens a dossier route, prints it and downloads the same audited snapshot', async () => {
  // The jsdom Blob lacks .text(); use the standard Blob implementation provided by Node.
  vi.stubGlobal('Blob', FileBlob);
  const file = new FileBlob(
    [
      JSON.stringify({
        ...emptyReport,
        evidence: [
          {
            id: 'item-240',
            code: 'EV-240',
            title: 'Acquisition manifest',
            classification: 'document',
            status: 'transferred',
            integrity: 'verified',
            filename: 'manifest.txt',
            size_bytes: 5,
            sha256: digest,
            location: 'Cabinet B',
            custodian_name: 'Receiving custodian',
            created_at: timestamp,
          },
        ],
        notes: [
          {
            id: 'note-1',
            body: 'Original bytes retained.',
            author_name: 'Case owner',
            created_at: timestamp,
          },
        ],
        custody: [
          {
            id: 'handoff-1',
            evidence_id: 'item-240',
            from_name: 'Case owner',
            to_name: 'Receiving custodian',
            actor_name: 'Case owner',
            reason: 'Preservation check',
            location: 'Cabinet B',
            created_at: timestamp,
          },
        ],
        integrity_checks: [
          {
            id: 'check-1',
            evidence_id: 'item-240',
            actor_name: 'Case owner',
            matches: true,
            digest,
            created_at: timestamp,
          },
        ],
        activity: [
          {
            id: 'log-1',
            action: 'evidence.verified',
            actor_name: 'Case owner',
            evidence_code: 'EV-240',
            created_at: timestamp,
          },
        ],
      }),
    ],
    { type: 'application/json' },
  );
  api.mockResolvedValue(file);
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const createURL = vi.fn(() => 'blob:unit-test');
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createURL;
      static revokeObjectURL = vi.fn();
    },
  );
  const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  openReport();

  expect(await screen.findByRole('heading', { name: 'Preservation review' })).toBeTruthy();
  expect(screen.getByText('Case owner → Receiving custodian')).toBeTruthy();
  expect(screen.getByText('Original bytes retained.')).toBeTruthy();
  expect(screen.getAllByText(digest)).toHaveLength(2);
  expect(screen.getByText('EV-240 · Digest matched')).toBeTruthy();
  expect(screen.getByText('Stored file matched intake digest')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Print dossier' }));
  expect(print).toHaveBeenCalledOnce();
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
  expect(createURL).toHaveBeenCalledWith(file);
  expect(clicked).toHaveBeenCalledOnce();
  expect(api).toHaveBeenCalledTimes(1);
  expect(api.mock.calls[0][0]).toBe('/cases/' + caseId + '/report');
});

it('retains a path back to reports if the case is inaccessible', async () => {
  api.mockRejectedValue(new Error('Case not found.'));
  openReport();
  expect((await screen.findByRole('alert')).textContent).toContain('Case not found.');
  expect(screen.getAllByRole('link', { name: 'Case reports' }).some((a) => a.hash === '#/reports')).toBe(
    true,
  );
  expect(screen.queryByRole('button', { name: 'Print dossier' })).toBeNull();
});
