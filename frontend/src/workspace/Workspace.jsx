import React, { useEffect, useRef, useState } from 'react';
import { Icon, Modal, label } from './common.jsx';
import { Overview, Cases, Evidence, Reports, Activity, Team } from './Registers.jsx';
import { CaseDetail, EvidenceDetail } from './Details.jsx';
import {
  AccountStatus,
  AddMember,
  AddNote,
  AddRelationship,
  AddUser,
  ChangeStatus,
  NewCase,
  RegisterEvidence,
  Transfer,
} from './forms.jsx';
import './workspace.css';
import Dossier from './Dossier.jsx';

const navigation = [
  { id: 'overview', name: 'Overview', page: Overview },
  { id: 'cases', name: 'Case files', page: Cases },
  { id: 'evidence', name: 'Evidence register', page: Evidence },
  { id: 'reports', name: 'Case reports', page: Reports },
  { id: 'activity', name: 'Audit trail', page: Activity },
  { id: 'team', name: 'Team directory', page: Team },
];
const forms = {
  case: NewCase,
  register: RegisterEvidence,
  note: AddNote,
  status: ChangeStatus,
  member: AddMember,
  transfer: Transfer,
  link: AddRelationship,
  user: AddUser,
  accountStatus: AccountStatus,
};
const confirmations = {
  case: 'Case created.',
  register: 'Evidence registered.',
  note: 'Investigation note saved.',
  status: 'Case status updated.',
  member: 'Member assigned to this case.',
  transfer: 'Custody transfer recorded.',
  link: 'Evidence relationship created.',
  user: 'Team account created.',
  accountStatus: 'Account access updated.',
};
function Wordmark() {
  return (
    <a className="w-wordmark" aria-label="FORENSIQ overview" href="#/overview">
      <img src="/mark.svg" width="34" height="34" alt="" />
      <span>FORENSIQ</span>
    </a>
  );
}
function NavItems({ items, current, close }) {
  return (
    <nav aria-label="Workspace">
      <ul className="w-navlinks">
        {items.map((p) => (
          <li key={p.id}>
            <a aria-current={current === p.id ? 'page' : undefined} href={'#/' + p.id} onClick={close}>
              <Icon name={p.id} />
              {p.name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
export default function Workspace({ user, onLogout, theme, onToggleTheme }) {
  const [hash, setHash] = useState(window.location.hash);
  const [revision, setRevision] = useState(0),
    [modal, setModal] = useState(null),
    [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const timer = useRef();
  const main = useRef(null);
  const [leaving, setLeaving] = useState(false),
    [exitError, setExitError] = useState('');
  useEffect(() => {
    function changed() {
      setHash(location.hash);
      setModal(null);
      setMenu(false);
    }
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const [path, search = ''] = hash.replace(/^#\/?/, '').split('?');
  const [section, id] = path.split('/');
  const items = navigation.filter((p) => p.id !== 'team' || user.role === 'admin');
  const current = items.find((p) => p.id === section) || items[0];
  const detailPages = { cases: CaseDetail, evidence: EvidenceDetail, reports: Dossier };
  const Page = (id && detailPages[current.id]) || current.page;
  const open = (kind, data = {}) => setModal({ kind, data });
  const refresh = () => setRevision((v) => v + 1);
  function notify(message) {
    clearTimeout(timer.current);
    setNotice(message);
    timer.current = setTimeout(() => setNotice(''), 5200);
  }
  function done(record) {
    const kind = modal.kind;
    setModal(null);
    notify(confirmations[kind]);
    refresh();
    if (kind === 'case') location.hash = '/cases/' + record.id;
    else if (kind === 'register') location.hash = '/evidence/' + record.id;
    else requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  }
  async function logout() {
    if (leaving) return;
    setLeaving(true);
    setExitError('');
    try {
      await onLogout();
    } catch (error) {
      setExitError(error.message || 'Sign out failed. Please try again.');
    } finally {
      setLeaving(false);
    }
  }
  const pageKey = current.id + (id || '');
  const lastPage = useRef(pageKey);
  useEffect(() => {
    if (pageKey !== lastPage.current) {
      lastPage.current = pageKey;
      window.scrollTo(0, 0);
      main.current?.focus({ preventScroll: true });
    }
  }, [pageKey]);
  const Form = modal && forms[modal.kind];
  return (
    <div className="w-shell">
      <a
        className="w-skip"
        href="#w-main"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="w-rail">
        <Wordmark />
        <div className="w-rail-nav">
          <h2>Workspace</h2>
          <NavItems items={items} current={current.id} />
        </div>
        <div className="w-rail-foot">
          <span className="w-avatar">{user.name.trim().slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <span>{label(user.role)}</span>
          </div>
        </div>
      </aside>
      <div className="w-maincol">
        <header className="w-top">
          <div className="w-top-left">
            <button
              className="w-menu w-iconbutton"
              aria-label="Open workspace navigation"
              onClick={() => setMenu(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="w-breadcrumb">
              <span>Workspace</span> <Icon name="chevron" size={14} /> <strong>{current.name}</strong>
            </span>
          </div>
          <div className="w-topactions">
            <button
              type="button"
              className="w-mode"
              onClick={onToggleTheme}
              aria-label={'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
              <span>{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
            </button>
            <button type="button" className="w-exit" onClick={logout} disabled={leaving}>
              <Icon name="logout" size={17} />
              {leaving ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>
        {exitError && (
          <p className="w-error" role="alert">
            {exitError}
          </p>
        )}
        <main className="w-main" id="w-main" tabIndex="-1" ref={main}>
          <Page
            key={pageKey}
            id={id}
            revision={revision}
            params={new URLSearchParams(search)}
            user={user}
            open={open}
            refresh={refresh}
            notify={notify}
          />
        </main>
      </div>
      {menu && (
        <Modal title="Workspace navigation" onClose={() => setMenu(false)}>
          <div className="w-mobile-nav">
            <NavItems items={items} current={current.id} close={() => setMenu(false)} />
            <p>
              {user.name} · {label(user.role)}
            </p>
          </div>
        </Modal>
      )}
      {Form && <Form {...modal.data} onDone={done} onClose={() => setModal(null)} />}
      <div className={'w-toast' + (notice ? ' w-visible' : '')} role="status" aria-live="polite">
        {notice && (
          <>
            <Icon name="check" size={18} />
            {notice}
          </>
        )}
      </div>
    </div>
  );
}
