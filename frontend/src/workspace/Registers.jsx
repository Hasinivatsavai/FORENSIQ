import React, { useState } from 'react';
import {
  Action,
  Button,
  CaseRows,
  Chip,
  Empty,
  EvidenceRows,
  Icon,
  PageHeader,
  Panel,
  Pending,
  Search,
  Timeline,
  describeEvent,
  downloadReport,
  integrityText,
  label,
  query,
  useDebounced,
  useResource,
} from './common.jsx';
import { statuses, options } from './forms.jsx';
import laboratoryPhoto from './media/laboratory-study.jpg';

function ViewAll({ page, label: linkLabel = 'View all' }) {
  return (
    <a className="w-textlink" href={'#/' + page}>
      {linkLabel}
      <Icon name="arrow" size={16} />
    </a>
  );
}
function EventDescription({ row }) {
  const record = row.evidence_id
    ? { path: 'evidence', id: row.evidence_id, code: row.evidence_code }
    : { path: 'cases', id: row.case_id, code: row.case_code };
  const { title, accountId: legacyAccountId } = describeEvent(row.action);
  const accountId = row.subject_id || legacyAccountId;
  return (
    <>
      <strong>{title}</strong>
      <p>
        {row.actor_name || 'System'}
        {record.id && (
          <>
            {' '}
            · <a href={'#/' + record.path + '/' + record.id}>{record.code || 'Open record'}</a>
          </>
        )}
      </p>
      {accountId && (
        <details className="w-event-target">
          <summary>
            {row.subject_name ? 'Affected account · ' + row.subject_name : 'Affected account'}
          </summary>
          <code>{accountId}</code>
        </details>
      )}
    </>
  );
}
function Breakdown({ title, rows, path }) {
  const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
  return (
    <Panel title={title}>
      {total ? (
        <ol className="w-bars">
          {rows.map((r) => (
            <li key={r.label}>
              {path ? <a href={path(r.label)}>{label(r.label)}</a> : <span>{label(r.label)}</span>}
              <strong>{r.count}</strong>
              <span className="w-track" aria-hidden="true">
                <i style={{ width: (100 * r.count) / total + '%' }} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <Empty
          icon="overview"
          title="No records yet"
          detail="The distribution appears as records are added."
        />
      )}
    </Panel>
  );
}
export function Overview({ revision, user, open }) {
  const info = useResource('/dashboard', revision);
  return (
    <>
      <div className="w-hero">
        <svg
          className="w-hero-photo"
          aria-hidden="true"
          viewBox="305 705 427 440"
          preserveAspectRatio="xMidYMid slice"
        >
          <image href={laboratoryPhoto} width="736" height="1308" />
        </svg>
        <div className="w-hero-content">
          <p className="w-hero-date">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <h1>
            Investigation
            <br />
            <em>overview.</em>
          </h1>
          {user.role !== 'viewer' && (
            <Button icon="plus" onClick={() => open('case')}>
              Create a case
            </Button>
          )}
        </div>
      </div>
      <Pending resource={info}>
        {(d) => (
          <>
            <div className="w-metrics">
              {[
                ['Accessible cases', d.counts.cases, 'cases', 'cases'],
                ['Open cases', d.counts.open_cases, 'cases?status=open', 'activity'],
                ['Evidence items', d.counts.evidence, 'evidence', 'evidence'],
                ['Hash verified', d.counts.verified, 'evidence?integrity=verified', 'shield'],
              ].map(([title, value, path, icon]) => (
                <a href={'#/' + path} key={title}>
                  <span className="w-metric-label">
                    <Icon name={icon} />
                    {title}
                  </span>
                  <strong>{Number(value).toLocaleString()}</strong>
                  <span className="w-metric-arrow">
                    <Icon name="arrow" size={17} />
                  </span>
                </a>
              ))}
            </div>
            <div className="w-two-col">
              <Panel title="Recent cases" actions={<ViewAll page="cases" />}>
                <CaseRows rows={d.recent_cases} />
              </Panel>
              <Panel title="Recent activity" actions={<ViewAll page="activity" />}>
                <Timeline
                  rows={d.recent_events.slice(0, 5)}
                  render={(row) => <EventDescription row={row} />}
                />
              </Panel>
            </div>
            <div className="w-two-col">
              <Breakdown
                title="Case status"
                rows={d.by_status}
                path={(status) => '#/cases?status=' + encodeURIComponent(status)}
              />
              <Breakdown title="Evidence classifications" rows={d.by_classification} />
            </div>
          </>
        )}
      </Pending>
    </>
  );
}
export function Cases({ revision, params, user, open }) {
  const [q, setQ] = useState('');
  const status = statuses.includes(params.get('status')) ? params.get('status') : '';
  const resource = useResource(query('/cases', { q: useDebounced(q), status }), revision);
  return (
    <>
      <PageHeader
        title="Case files"
        subtitle="Open a file to review its evidence, notes and assigned team."
      >
        {user.role !== 'viewer' && (
          <Button primary icon="plus" onClick={() => open('case')}>
            Create case
          </Button>
        )}
      </PageHeader>
      <Panel title="Case register">
        <div className="w-filters">
          <Search value={q} onChange={setQ} placeholder="Search case title or ID" />
          <select
            aria-label="Filter by case status"
            value={status}
            onChange={(e) => {
              location.hash = query('/cases', { status: e.target.value });
            }}
          >
            <option value="">All statuses</option>
            {options(statuses)}
          </select>
        </div>
        <Pending resource={resource}>{(rows) => <CaseRows rows={rows} />}</Pending>
      </Panel>
    </>
  );
}
export function Evidence({ revision, params, user, open }) {
  const [q, setQ] = useState('');
  const integrity = Object.hasOwn(integrityText, params.get('integrity')) ? params.get('integrity') : '';
  const caseId = params.get('case_id') || '';
  const resource = useResource(
    query('/evidence', { q: useDebounced(q), integrity, case_id: caseId }),
    revision,
  );
  const cases = useResource('/cases', revision);
  const filter = (newIntegrity, newCase) => {
    location.hash = query('/evidence', { integrity: newIntegrity, case_id: newCase });
  };
  return (
    <>
      <PageHeader
        title="Evidence register"
        subtitle="Find stored files and external references across your cases."
      >
        {user.role !== 'viewer' && (
          <Button primary icon="plus" onClick={() => open('register')}>
            Register evidence
          </Button>
        )}
      </PageHeader>
      <Panel title="Evidence items">
        <div className="w-filters">
          <Search value={q} onChange={setQ} placeholder="Search evidence title or ID" />
          <select
            aria-label="Filter by case"
            value={caseId}
            onChange={(e) => filter(integrity, e.target.value)}
          >
            <option value="">All cases</option>
            {(cases.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by integrity"
            value={integrity}
            onChange={(e) => filter(e.target.value, caseId)}
          >
            <option value="">All integrity states</option>
            {Object.entries(integrityText).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {cases.error && <Pending resource={cases}>{() => null}</Pending>}
        <Pending resource={resource}>{(rows) => <EvidenceRows rows={rows} />}</Pending>
      </Panel>
    </>
  );
}
export function Reports({ revision, notify }) {
  const [q, setQ] = useState('');
  const resource = useResource(query('/cases', { q: useDebounced(q) }), revision);
  return (
    <>
      <PageHeader
        title="Case reports"
        subtitle="Open a printable case dossier or export its evidence, custody and integrity records as JSON."
      />
      <Panel title="Available dossiers">
        <div className="w-filters">
          <Search value={q} onChange={setQ} placeholder="Search reports by case title or ID" />
        </div>
        <Pending resource={resource}>
          {(rows) =>
            rows.length ? (
              <ul className="w-records">
                {rows.map((row) => (
                  <li className="w-manage-row" key={row.id}>
                    <a className="w-recordmain" href={'#/reports/' + row.id}>
                      <span className="w-recordicon">
                        <Icon name="reports" />
                      </span>
                      <span className="w-recordtitle">
                        <small>{row.code}</small>
                        <strong>{row.title}</strong>
                        <span>Open dossier →</span>
                      </span>
                    </a>
                    <Action
                      perform={() => downloadReport(row)}
                      onSuccess={() => notify('Case report downloaded.')}
                      text="Export JSON"
                      working="Exporting…"
                      icon="download"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Empty
                icon="reports"
                title="No matching cases"
                detail="A dossier becomes available when you create a case."
              />
            )
          }
        </Pending>
      </Panel>
    </>
  );
}
export function Activity({ revision }) {
  const [q, setQ] = useState(''),
    [caseId, setCase] = useState(''),
    [limit, setLimit] = useState('100');
  const resource = useResource(
    query('/audit', { q: useDebounced(q), case_id: caseId, limit }),
    revision,
  );
  const cases = useResource('/cases', revision);
  return (
    <>
      <PageHeader
        title="Audit trail"
        subtitle="Inspect the time, actor and record behind each logged action."
      />
      <Panel title="Activity history">
        <div className="w-filters">
          <Search value={q} onChange={setQ} placeholder="Search logged actions" />
          <select
            aria-label="Filter activity by case"
            value={caseId}
            onChange={(e) => setCase(e.target.value)}
          >
            <option value="">All cases</option>
            {(cases.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.title}
              </option>
            ))}
          </select>
          <select aria-label="Number of events" value={limit} onChange={(e) => setLimit(e.target.value)}>
            {[25, 100, 250, 500].map((n) => (
              <option key={n} value={n}>
                Latest {n}
              </option>
            ))}
          </select>
        </div>
        {cases.error && <Pending resource={cases}>{() => null}</Pending>}
        <Pending resource={resource}>
          {(rows) => (
            <Timeline
              rows={rows}
              empty="No matching events"
              render={(row) => <EventDescription row={row} />}
            />
          )}
        </Pending>
      </Panel>
    </>
  );
}
export function Team({ revision, user, open }) {
  const resource = useResource('/users', revision);
  const [q, setQ] = useState('');
  return (
    <>
      <PageHeader title="Workspace team" subtitle="Manage accounts and review their workspace access.">
        <Button primary icon="plus" onClick={() => open('user')}>
          Create account
        </Button>
      </PageHeader>
      <Panel title="Team directory">
        <div className="w-filters">
          <Search value={q} onChange={setQ} placeholder="Search name or email" />
        </div>
        <Pending resource={resource}>
          {(all) => {
            const text = q.trim().toLowerCase(),
              rows = all.filter((r) => (r.name + ' ' + r.email).toLowerCase().includes(text));
            return rows.length ? (
              <ul className="w-records">
                {rows.map((r) => (
                  <li className="w-manage-row" key={r.id}>
                    <span className="w-initial">{r.name.slice(0, 1)}</span>
                    <span className="w-recordtitle">
                      <strong>
                        {r.name}
                        {r.id === user.id ? ' (you)' : ''}
                      </strong>
                      <small>{r.email}</small>
                      <span>{label(r.role)}</span>
                    </span>
                    <Chip value={r.active ? 'open' : 'closed'}>{r.active ? 'Active' : 'Inactive'}</Chip>
                    {r.id !== user.id && (
                      <Button onClick={() => open('accountStatus', { person: r })}>
                        {r.active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="team" title="No matching accounts" />
            );
          }}
        </Pending>
      </Panel>
    </>
  );
}
