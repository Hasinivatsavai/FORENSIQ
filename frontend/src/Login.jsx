import React, { useEffect, useRef, useState } from 'react';
import FingerprintPlate from './motion/FingerprintPlate';
import { Icon, ThemeSwitch } from './Identity';
import { api } from './api';

function AccessHelp({ onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="access-dialog"
      aria-labelledby="help-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-content">
        <div className="dialog-top">
          <Icon name="shield" />
          <button
            type="button"
            className="icon-button"
            aria-label="Close account help"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <h2 id="help-title">Account access</h2>
        <p>
          Choose Create account to register with your name, email address and
          a password. After registration, you can open the lab immediately.
        </p>
        <p>
          Already registered? Use Sign in with the same email address. Contact
          your workspace administrator if you need a password reset or access
          to an existing case.
        </p>
        <button className="login-submit" onClick={onClose}>
          Return to account access <Icon name="arrow" />
        </button>
      </div>
    </dialog>
  );
}
function UtcClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="utc-clock">
      <Icon name="clock" size={15} /> {now.toISOString().slice(11, 19)} UTC
    </span>
  );
}
export default function Login({
  theme,
  onToggleTheme,
  onAuthenticated,
  sessionMessage,
  restoring,
}) {
  const [mode, setMode] = useState('login');
  const registering = mode === 'register';
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const form = useRef(null);
  const alert = useRef(null);
  const focusAfterSwitch = useRef(false);

  useEffect(() => {
    if (focusAfterSwitch.current) {
      form.current.elements.namedItem(registering ? 'name' : 'email').focus();
      focusAfterSwitch.current = false;
    }
  }, [registering]);

  useEffect(() => {
    if (!error) return;
    const target = error.field
      ? form.current.elements.namedItem(error.field)
      : alert.current;
    target?.focus();
  }, [error]);

  function changeMode(next) {
    if (next === mode || busy) return;
    focusAfterSwitch.current = true;
    setMode(next);
    setError(null);
    setPassword('');
    setConfirmation('');
    setVisible(false);
  }

  function fieldFeedback(field, hint) {
    if (error?.field === field) {
      return { 'aria-invalid': true, 'aria-describedby': 'auth-error' };
    }
    return { 'aria-describedby': hint };
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || restoring) return;

    if (registering && !name.trim()) {
      setError({ field: 'name', message: 'Enter your name.' });
      return;
    }
    if (registering) {
      const length = Array.from(password).length;
      if (length < 12 || length > 128) {
        setError({ field: 'password', message: 'Use 12 to 128 characters for your password.' });
        return;
      }
    }
    if (registering && confirmation !== password) {
      setError({
        field: 'confirmation',
        message: 'The passwords do not match. Enter your password again.',
      });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const credentials = { email: email.trim(), password };
      const user = await api(registering ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: registering ? { name: name.trim(), ...credentials } : credentials,
      });
      setPassword('');
      setConfirmation('');
      onAuthenticated(user);
    } catch (failure) {
      setError({
        field: registering && failure.status === 409 ? 'email' : undefined,
        message: failure.message,
      });
      setBusy(false);
    }
  }
  let action = registering ? 'Create account & enter' : 'Enter workspace';
  if (restoring) action = 'Checking session…';
  if (busy) action = registering ? 'Creating account…' : 'Authenticating…';

  return (
    <main className="entry-shell">
      <header className="entry-header">
        <div className="entry-brand">
          <img src="/mark.svg" width="40" height="40" alt="" />
          <span>FORENSIQ</span>
          <i aria-hidden="true" />
          <div className="entry-brand-sub">Digital forensics lab</div>
        </div>
        <ThemeSwitch theme={theme} onToggleTheme={onToggleTheme} />
      </header>
      <div className="entry-grid">
        <section className="specimen-area" aria-labelledby="lab-title">
          <div className="field-label">
            <span className="short-rule" />
            FORENSIC REFERENCE COLLECTION
          </div>
          <h1 id="lab-title">
            Trace <em>laboratory.</em>
          </h1>
          <FingerprintPlate theme={theme} />
          <div className="plate-caption">
            <span>
              <b>Fig. 01</b>
              <i />
              Latent thumbprint
            </span>
            <small>
              <Icon name="hand" size={15} /> Interactive plate
            </small>
          </div>
        </section>
        <section
          className={`login-panel${registering ? ' auth-register' : ''}`}
          aria-labelledby="login-title"
        >
          <div className="panel-accent" aria-hidden="true" />
          <div className="panel-content">
            <div className="access-label">
              <span className="status-dot" /> SECURE WORKSPACE
            </div>
            <h2 id="login-title">
              Investigator <br />
              access<span>.</span>
            </h2>
            <p className="login-intro">
              {registering
                ? 'Your name identifies your work in the case record.'
                : 'Sign in or create an account to open the lab.'}
            </p>
            <div className="auth-modes" role="group" aria-label="Account access options">
              <button
                type="button"
                aria-pressed={!registering}
                disabled={busy}
                onClick={() => changeMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                aria-pressed={registering}
                disabled={busy}
                onClick={() => changeMode('register')}
              >
                Create account
              </button>
            </div>
            <form
              ref={form}
              className="login-form"
              aria-label={registering ? 'Create your account' : 'Sign in'}
              onChange={() => setError(null)}
              onSubmit={submit}
            >
              {registering && (
                <>
                  <label htmlFor="register-name">Full name</label>
                  <div className="input-shell">
                    <Icon name="person" />
                    <input
                      id="register-name"
                      name="name"
                      autoComplete="name"
                      type="text"
                      maxLength={160}
                      required
                      {...fieldFeedback('name')}
                      placeholder="Your full name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>
                </>
              )}
              <label htmlFor="login-email">Email address</label>
              <div className="input-shell">
                <Icon name="email" />
                <input
                  id="login-email"
                  name="email"
                  autoComplete="username"
                  type="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  placeholder="name@agency.org"
                  maxLength={254}
                  {...fieldFeedback('email')}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <label htmlFor="login-password">Password</label>
              {registering && (
                <p className="auth-mode-hint" id="password-hint">12 to 128 characters.</p>
              )}
              <div className="input-shell">
                <Icon name="lock" />
                <input
                  id="login-password"
                  name="password"
                  autoComplete={registering ? 'new-password' : 'current-password'}
                  type={visible ? 'text' : 'password'}
                  required
                  maxLength={256}
                  {...fieldFeedback('password', registering ? 'password-hint' : undefined)}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setVisible((v) => !v)}
                  aria-pressed={visible}
                  aria-label={`${visible ? 'Hide' : 'Show'} ${registering ? 'passwords' : 'password'}`}
                >
                  <Icon name={visible ? 'eyeOff' : 'eye'} />
                </button>
              </div>
              {registering && (
                <>
                  <label htmlFor="register-confirm">Confirm password</label>
                  <div className="input-shell">
                    <Icon name="lock" />
                    <input
                      id="register-confirm"
                      name="confirmation"
                      type={visible ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      maxLength={256}
                      {...fieldFeedback('confirmation')}
                      placeholder="Re-enter your password"
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                  </div>
                </>
              )}
              {(error || (!registering && sessionMessage)) && (
                <p id="auth-error" ref={alert} className="login-error" role="alert" tabIndex={-1}>
                  {error?.message || sessionMessage}
                </p>
              )}
              <button
                className="login-submit"
                type="submit"
                disabled={busy || restoring}
              >
                {action}
                <Icon name="arrow" />
              </button>
            </form>
          </div>
          <div className="panel-foot">
            <span>
              <Icon name="lock" size={16} /> Restricted access
            </span>
            <button onClick={() => setHelp(true)}>
              Account help <Icon name="external" size={15} />
            </button>
          </div>
        </section>
      </div>
      <footer className="entry-footer">
        <span className="footer-system">
          <span className="footer-square" /> FORENSIQ <i /> Evidence management
          system
        </span>
        <UtcClock />
      </footer>
      {help && <AccessHelp onClose={() => setHelp(false)} />}
    </main>
  );
}
