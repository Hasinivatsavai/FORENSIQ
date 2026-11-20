import React, { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api.js';

const icons = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  cases: <path d="M3 7a2 2 0 0 1 2-2h5l2 3h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2z" />,
  evidence: <path d="m3 8 9-5 9 5-9 5zM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" />,
  reports: <path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" />,
  activity: <path d="M2 12h5l3-7 4 14 3-7h5" />,
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6.5" />
      <path d="m15 15 5 5" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  plus: <path d="M12 4v16M4 12h16" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-5.6 8-8 9-2.4-1-8-4-8-9V6z" />
      <path d="m8.5 12 2 2 5-5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  moon: <path d="M20.8 13.3A9 9 0 0 1 10.7 3.2a9 9 0 1 0 10.1 10.1Z" />,
  logout: <path d="M10 4H4v16h6m-1-8h11m-5-5 5 5-5 5" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  link: (
    <path d="m10 14 4-4M9 16l-2 2a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0m2-1 2-2a3.5 3.5 0 0 1 5 5l-4 4a3.5 3.5 0 0 1-5 0" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  handoff: <path d="M3 8h16m-4-4 4 4-4 4M21 16H5m4-4-4 4 4 4" />,
  open: <path d="M8 4h12v12M20 4 8 16M4 8v12h12" />,
  check: <path d="m4 12 5 5L20 6" />,
};
export function Icon({ name, size = 19 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  );
}

export function label(value) {
  const str = String(value ?? '')
    .replace(/[_.-]+/g, ' ')
    .trim();
  return str ? str[0].toUpperCase() + str.slice(1) : '—';
}
const actionNames = {
  'auth.login_failed': 'Sign-in attempt failed',
  'auth.signed_in': 'Signed in',
  'auth.signed_out': 'Signed out',
  'case.created': 'Case opened',
  'case.viewed': 'Case viewed',
  'case.member_added': 'Case member assigned',
  'case.note_added': 'Investigation note added',
  'case.report_exported': 'Case report exported',
  'custody.transferred': 'Custody transferred',
  'evidence.registered': 'Evidence registered',
  'evidence.viewed': 'Evidence viewed',
  'evidence.downloaded': 'Evidence file downloaded',
  'evidence.verified': 'Stored file matched intake digest',
  'evidence.hash_mismatch': 'Evidence hash mismatch',
  'evidence.relationship_added': 'Evidence relationship created',
  'user.admin_provisioned': 'Administrator provisioned',
  'user.created': 'Team account created',
  'user.self_registered': 'Account created',
  'user.activated': 'Team account activated',
  'user.deactivated': 'Team account deactivated',
  'user.password_reset_by_operator': 'Account password reset',
};
export function describeEvent(action) {
  const code = String(action || '');
  const match = code.match(/^(.+)\.([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i);
  const base = match ? match[1] : code;
  const title = base.startsWith('case.status.')
    ? 'Case status changed to ' + label(base.slice(12)).toLowerCase()
    : actionNames[base] || label(base);
  return { title, accountId: match?.[2] };
}
export const dateTime = (value) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const fmtBytes = (n) =>
  n == null
    ? '—'
    : n < 1024
      ? n + ' B'
      : n < 1048576
        ? (n / 1024).toFixed(1) + ' KiB'
        : (n / 1048576).toFixed(2) + ' MiB';
export const integrityText = {
  recorded: 'Reference only',
  hashed: 'Hash recorded',
  verified: 'Hash verified',
  mismatch: 'Hash mismatch',
};
export function Chip({ value, children }) {
  return <span className={'w-chip w-chip-' + value}>{children || label(value)}</span>;
}
export function query(path, values = {}) {
  const params = new URLSearchParams(Object.entries(values).filter(([, v]) => v !== '' && v != null));
  return path + (params.size ? '?' + params : '');
}
export function useDebounced(text, delay = 230) {
  const [v, setV] = useState(text);
  useEffect(() => {
    const timer = setTimeout(() => setV(text), delay);
    return () => clearTimeout(timer);
  }, [text, delay]);
  return v;
}
export function useResource(path, revision = 0, transform = null) {
  const [state, setState] = useState({ key: '', data: null, error: '' });
  const [attempt, retry] = useState(0);
  const key = path + '@' + revision + '@' + attempt;
  useEffect(() => {
    if (!path) return;
    let live = true;
    const controller = new AbortController();
    api(path, { signal: controller.signal })
      .then((value) => (transform ? transform(value) : value))
      .then((data) => {
        if (live) setState({ key, data, error: '' });
      })
      .catch((e) => {
        if (live) setState({ key, data: null, error: e.message || 'Unable to load records.' });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [key, path, transform]);
  return {
    loading: Boolean(path && key !== state.key),
    data: key === state.key ? state.data : null,
    error: key === state.key ? state.error : '',
    retry: () => retry((x) => x + 1),
  };
}
export function Empty({ icon = 'cases', title, detail, action }) {
  return (
    <div className="w-empty">
      <span className="w-empty-icon">
        <Icon name={icon} size={24} />
      </span>
      <div>
        <strong>{title}</strong>
        {detail && <p>{detail}</p>}
        {action}
      </div>
    </div>
  );
}
export function Pending({ resource, children }) {
  if (resource.loading)
    return (
      <div className="w-loading" role="status">
        <i /> Loading records…
      </div>
    );
  if (resource.error)
    return (
      <div className="w-error" role="alert">
        <p>{resource.error}</p>
        <button type="button" className="w-quiet" onClick={resource.retry}>
          Try again
        </button>
      </div>
    );
  if (resource.data == null) return null;
  return children(resource.data);
}
export function Button({ icon, children, primary = false, quiet = false, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={
        'w-button ' +
        (primary ? 'w-primary' : quiet ? 'w-quiet' : 'w-secondary') +
        ' ' +
        (props.className || '')
      }
    >
      {icon && <Icon name={icon} />} {children}
    </button>
  );
}
export function Field({ title, hint, children }) {
  const id = useId();
  const hintId = id + 'h';
  return (
    <div className="w-field">
      <label htmlFor={id}>{title}</label>
      {React.cloneElement(children, { id, 'aria-describedby': hint ? hintId : undefined })}
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  );
}
export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    const active = document.activeElement;
    el.showModal();
    return () => {
      el.close();
      active?.focus?.();
    };
  }, []);
  return (
    <dialog
      className="w-dialog"
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="w-dialog-header">
        <h2 id={id}>{title}</h2>
        <button type="button" className="w-iconbutton" aria-label="Close dialog" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function FormModal({
  title,
  onClose,
  onSave,
  submitText,
  children,
  onDone,
  submitDisabled = false,
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const locked = useRef(false);
  async function submit(e) {
    e.preventDefault();
    if (locked.current || submitDisabled) return;
    locked.current = true;
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const result = await onSave(form);
      onDone(result);
    } catch (err) {
      setError(err.message || 'Unable to save this record.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const close = () => {
    if (!locked.current) onClose();
  };
  return (
    <Modal title={title} onClose={close}>
      <form onSubmit={submit}>
        <div className="w-form-body">
          {children}
          {error && (
            <p className="w-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="w-form-actions">
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button primary type="submit" disabled={busy || submitDisabled}>
            {busy ? 'Saving…' : submitText}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function PageHeader({ eyebrow, title, subtitle, children, back }) {
  return (
    <header className="w-pageheader">
      {back && (
        <a className="w-back" href={'#/' + back.path}>
          <Icon name="back" size={16} />
          {back.label}
        </a>
      )}
      <div className="w-pageheader-row">
        <div>
          {eyebrow && <p className="w-kicker">{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <p className="w-intro">{subtitle}</p>}
        </div>
        {children && <div className="w-actions">{children}</div>}
      </div>
    </header>
  );
}
export function Panel({ title, actions, children, className = '' }) {
  return (
    <section className={'w-panel ' + className}>
      <div className="w-panel-head">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
export function Search({ value, onChange, placeholder, label: ariaLabel }) {
  return (
    <label className="w-search">
      <Icon name="search" />
      <input
        type="search"
        aria-label={ariaLabel || placeholder}
        maxLength={160}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function post(path, body) {
  return api(path, { method: 'POST', ...(body === undefined ? {} : { body }) });
}
export function saveFile(data, name, kind = 'application/json') {
  const blob = data instanceof Blob ? data : new Blob([JSON.stringify(data, null, 2)], { type: kind });
  const href = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}
export async function downloadReport(record) {
  const data = await api('/cases/' + record.id + '/report');
  saveFile(data, record.code + '-case-report.json');
}
export function Action({ perform, onSuccess, text, working = 'Working…', icon, primary = false }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  async function act() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const out = await perform();
      onSuccess?.(out);
    } catch (err) {
      setError(err.message || 'The request failed. Please try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="w-action">
      <Button primary={primary} icon={icon} disabled={busy} onClick={act}>
        {busy ? working : text}
      </Button>
      {error && (
        <p className="w-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Timeline({ rows, render, empty = 'No activity recorded.' }) {
  return rows.length ? (
    <ol className="w-timeline">
      {rows.map((row) => (
        <li key={row.id}>
          <div>
            {render(row)}
            <time dateTime={row.created_at}>{dateTime(row.created_at)}</time>
          </div>
        </li>
      ))}
    </ol>
  ) : (
    <Empty icon="clock" title={empty} />
  );
}
export function CaseRows({ rows }) {
  if (!rows.length)
    return (
      <Empty
        icon="cases"
        title="No cases found"
        detail="Cases you own or have access to will appear here."
      />
    );
  return (
    <ul className="w-records">
      {rows.map((row) => (
        <li key={row.id}>
          <a href={'#/cases/' + row.id}>
            <span className="w-recordicon">
              <Icon name="cases" />
            </span>
            <span className="w-recordtitle">
              <small>{row.code}</small>
              <strong>{row.title}</strong>
            </span>
            <Chip value={row.status} />
            <Icon name="chevron" size={16} />
          </a>
        </li>
      ))}
    </ul>
  );
}
export function EvidenceRows({ rows }) {
  if (!rows.length)
    return (
      <Empty
        icon="evidence"
        title="No evidence found"
        detail="Registered items that match this view will appear here."
      />
    );
  return (
    <ul className="w-records">
      {rows.map((row) => (
        <li key={row.id}>
          <a href={'#/evidence/' + row.id}>
            <span className="w-recordicon">
              <Icon name="evidence" />
            </span>
            <span className="w-recordtitle">
              <small>
                {row.code} · {row.case_code}
              </small>
              <strong>{row.title}</strong>
            </span>
            <Chip value={row.integrity}>{integrityText[row.integrity]}</Chip>
            <Icon name="chevron" size={16} />
          </a>
        </li>
      ))}
    </ul>
  );
}
