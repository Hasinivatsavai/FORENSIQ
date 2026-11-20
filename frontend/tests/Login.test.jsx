import React, { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Login from '../src/Login.jsx';
import { api } from '../src/api.js';

// These tests exercise the real components and mock only the HTTP boundary.
// SQLite persistence, authentication and cookie handling have separate integration tests.
vi.mock('../src/api.js', () => ({ api: vi.fn() }));

const account = { id: 'test-account', name: 'Alex Reviewer', role: 'investigator' };
const email = 'reviewer@example.test';
const password = 'component-fixture-only';

function showLogin(props = {}) {
  const onAuthenticated = vi.fn();
  render(<Login theme="light" onToggleTheme={() => {}} onAuthenticated={onAuthenticated} {...props} />);
  return onAuthenticated;
}

async function fillCredentials(user) {
  await user.type(screen.getByLabelText('Email address'), email);
  await user.type(screen.getByLabelText('Password', { exact: true }), password);
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('Investigator access', () => {
  it('offers both account actions on entry and registers through the same-origin API', async () => {
    const user = userEvent.setup();
    const onAuthenticated = showLogin();
    const { api: request } = await vi.importActual('../src/api.js');
    api.mockImplementationOnce(request);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(account), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);

    expect(screen.getByRole('button', { name: 'Sign in', pressed: true })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Create account', pressed: false }));
    const name = screen.getByLabelText('Full name');
    expect(document.activeElement).toBe(name);
    await user.type(name, '  Alex Reviewer  ');
    await fillCredentials(user);
    await user.type(screen.getByLabelText('Confirm password'), password);
    await user.click(screen.getByRole('button', { name: 'Create account & enter' }));

    expect(fetch).toHaveBeenCalledTimes(1);
    const [path, options] = fetch.mock.calls[0];
    expect(path).toBe('/api/auth/register');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('same-origin');
    expect(options.headers.get('X-Forensiq-Request')).toBe('1');
    expect(JSON.parse(options.body)).toEqual({ name: 'Alex Reviewer', email, password });
    expect(onAuthenticated).toHaveBeenCalledExactlyOnceWith(account);
    expect(screen.getByLabelText('Confirm password').value).toBe('');
    expect(screen.getByLabelText('Password', { exact: true }).value).toBe('');
  });

  it('keeps an invalid signup on the form and focuses the field that needs attention', async () => {
    const user = userEvent.setup();
    showLogin();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    const name = screen.getByLabelText('Full name');
    const secret = screen.getByLabelText('Password', { exact: true });
    const confirmation = screen.getByLabelText('Confirm password');
    const submit = screen.getByRole('button', { name: 'Create account & enter' });
    await user.type(name, '   ');
    await user.type(screen.getByLabelText('Email address'), email);
    await user.type(secret, 'short');
    await user.type(confirmation, 'different');
    await user.click(submit);
    expect(document.activeElement).toBe(name);
    expect(screen.getByRole('alert').textContent).toBe('Enter your name.');

    await user.type(name, 'Alex Reviewer');
    await user.click(submit);
    expect(document.activeElement).toBe(secret);
    expect(screen.getByRole('alert').textContent).toMatch(/12 to 128 characters/i);

    await user.clear(secret);
    await user.type(secret, password);
    await user.click(submit);
    expect(document.activeElement).toBe(confirmation);
    expect(confirmation.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toMatch(/passwords do not match/i);
    expect(api).not.toHaveBeenCalled();
  });

  it('returns focus to a duplicate email and allows a corrected signup without retyping the password', async () => {
    const user = userEvent.setup();
    api.mockRejectedValueOnce(Object.assign(new Error('This email is already in use.'), { status: 409 }))
      .mockResolvedValueOnce(account);
    const onAuthenticated = showLogin();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Full name'), account.name);
    await fillCredentials(user);
    await user.type(screen.getByLabelText('Confirm password'), password);
    await user.click(screen.getByRole('button', { name: 'Create account & enter' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/already in use/);
    const address = screen.getByLabelText('Email address');
    expect(document.activeElement).toBe(address);
    await user.clear(address);
    await user.type(address, 'another@example.test');
    await user.click(screen.getByRole('button', { name: 'Create account & enter' }));
    expect(onAuthenticated).toHaveBeenCalledExactlyOnceWith(account);
  });

  it('clears secret fields and resets visibility when switching between sign-up and sign-in', async () => {
    const user = userEvent.setup();
    showLogin();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await fillCredentials(user);
    await user.type(screen.getByLabelText('Confirm password'), password);
    await user.click(screen.getByRole('button', { name: 'Show passwords' }));
    expect(screen.getByLabelText('Confirm password').type).toBe('text');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const secret = screen.getByLabelText('Password', { exact: true });
    expect(secret.value).toBe('');
    expect(secret.type).toBe('password');
    expect(document.activeElement).toBe(screen.getByLabelText('Email address'));
    expect(screen.getByLabelText('Email address').value).toBe(email);
    expect(screen.queryByLabelText('Confirm password')).toBeNull();
    expect(api).not.toHaveBeenCalled();
  });

  it('waits for the API response before entering the workspace and clears the password', async () => {
    const user = userEvent.setup();
    let resolveLogin;
    api.mockReturnValueOnce(new Promise(resolve => { resolveLogin = resolve; }));
    const onAuthenticated = showLogin();
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Enter workspace' }));

    expect(api).toHaveBeenCalledWith('/auth/login', { method: 'POST', body: { email, password } });
    expect(screen.getByRole('button', { name: 'Authenticating…' }).disabled).toBe(true);
    expect(onAuthenticated).not.toHaveBeenCalled();

    await act(async () => { resolveLogin(account); });
    expect(onAuthenticated).toHaveBeenCalledExactlyOnceWith(account);
    expect(screen.getByLabelText('Password', { exact: true }).value).toBe('');
  });

  it('announces a rejected login, then lets the investigator retry', async () => {
    const user = userEvent.setup();
    api.mockRejectedValueOnce(new Error('Email or password is incorrect.')).mockResolvedValueOnce(account);
    const onAuthenticated = showLogin();
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Enter workspace' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Email or password is incorrect.');
    expect(onAuthenticated).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Enter workspace' }));
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledExactlyOnceWith(account));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('holds the form while an existing session is being checked', async () => {
    const user = userEvent.setup();
    showLogin({ restoring: true });
    const submit = screen.getByRole('button', { name: 'Checking session…' });
    expect(submit.disabled).toBe(true);
    await user.click(submit);
    expect(api).not.toHaveBeenCalled();
  });

  it('reveals and hides the current password without submitting it', async () => {
    const user = userEvent.setup();
    showLogin();
    const field = screen.getByLabelText('Password', { exact: true });
    await user.type(field, password);
    await user.click(screen.getByRole('button', { name: 'Show password', pressed: false }));
    expect(field.type).toBe('text');
    expect(field.value).toBe(password);
    await user.click(screen.getByRole('button', { name: 'Hide password', pressed: true }));
    expect(field.type).toBe('password');
    expect(api).not.toHaveBeenCalled();
  });

  it('switches both the selected theme and the actual specimen image in either direction', async () => {
    function ThemedLogin() {
      const [theme, setTheme] = useState('light');
      return <Login theme={theme} onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />;
    }
    const user = userEvent.setup();
    render(<ThemedLogin />);
    const plate = screen.getByRole('button', { name: /visual scan/i });
    const artwork = () => plate.querySelector('image')?.getAttribute('href');
    expect(artwork()).toBe('/art/latent-print.png');
    await user.click(screen.getByRole('button', { name: 'Dark', pressed: false }));
    expect(screen.getByRole('button', { name: 'Dark', pressed: true })).toBeTruthy();
    expect(artwork()).toBe('/art/latent-print-phosphor.png');
    await user.click(screen.getByRole('button', { name: 'Light', pressed: false }));
    expect(screen.getByRole('button', { name: 'Light', pressed: true })).toBeTruthy();
    expect(artwork()).toBe('/art/latent-print.png');
  });

  it('runs the illustrative scan from the keyboard without authenticating', async () => {
    const user = userEvent.setup();
    const onAuthenticated = showLogin();
    const plate = screen.getByRole('button', { name: /visual scan/i });
    plate.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status').textContent).toBe('Scanning the illustrative specimen.');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Specimen scan complete.'), { timeout: 3000 });
    expect(api).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});
