import React from 'react';
import {
  Button,
  Icon,
  Pending,
  describeEvent,
  fmtBytes,
  integrityText,
  label,
  saveFile,
  useResource,
} from './common.jsx';
import './dossier.css';

const utc = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const timestamp = (value) => (value ? utc.format(new Date(value)) + ' UTC' : '—');

async function readSnapshot(payload) {
  // Both exports use these exact bytes, including their original timestamp and actor.
  const file =
    payload instanceof Blob
      ? payload
      : new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const report = JSON.parse(await file.text());
  if (!report || !report.code || !Array.isArray(report.evidence) || !Array.isArray(report.activity)) {
    throw new Error('The server returned an incomplete case report. Please try again.');
  }
  return { file, report };
}
function Section({ title, children }) {
  return (
    <section className="w-dossier-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Lines({ rows, render, empty }) {
  if (!rows.length) return <p className="w-report-empty">{empty}</p>;
  return (
    <ol className="w-report-lines">
      {rows.map((row) => (
        <li key={row.id}>{render(row)}</li>
      ))}
    </ol>
  );
}
function Ledger({ fields, rows, empty, render }) {
  if (!rows.length) return <p className="w-report-empty">{empty}</p>;
  return (
    <table className="w-report-table">
      <thead>
        <tr>
          {fields.map((f) => (
            <th key={f} scope="col">
              {f}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {render(row).map((cell, i) => (
              <td key={fields[i]} data-label={fields[i]}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function ReportListing({ report }) {
  const byId = new Map(report.evidence.map((e) => [e.id, e]));
  const ref = (id) => byId.get(id)?.code || id;
  return (
    <article className="w-dossier" aria-labelledby="w-report-title">
      <header className="w-dossier-header">
        <div className="w-dossier-brand">
          <img src="/mark.svg" width="29" height="29" alt="" />
          <span>FORENSIQ</span>
          <span>Case dossier</span>
        </div>
        <p className="w-report-id">{report.code}</p>
        <h1 id="w-report-title">{report.title}</h1>
        <dl className="w-report-meta">
          {[
            ['Case owner', report.owner_name],
            ['Case status', label(report.status)],
            ['Priority', label(report.priority)],
            ['Opened', timestamp(report.created_at)],
            ['Report issued', timestamp(report.exported_at)],
            ['Prepared by', report.exported_by],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </header>
      <Section title="Case summary">
        <p className="w-preserve">{report.description || 'No case description recorded.'}</p>
        <p className="w-report-team">
          <strong>Case team</strong> ·{' '}
          {report.members.map((m) => m.name + ' (' + label(m.role) + ')').join(', ') ||
            report.owner_name}
        </p>
      </Section>
      <Section title="Investigation notes">
        <Lines
          rows={report.notes}
          empty="No investigation notes recorded."
          render={(r) => (
            <>
              <strong>{r.author_name}</strong>
              <time>{timestamp(r.created_at)}</time>
              <p className="w-preserve">{r.body}</p>
            </>
          )}
        />
      </Section>
      <Section title="Evidence register">
        <Lines
          rows={report.evidence}
          empty="No evidence registered."
          render={(e) => (
            <>
              <strong>
                {e.code} · {e.title}
              </strong>
              <p>
                {label(e.classification)} · {label(e.status)} · {integrityText[e.integrity]}
              </p>
              <p>
                Custodian · {e.custodian_name}
                <br />
                Storage · {e.location}
                <br />
                Registered · {timestamp(e.created_at)}
              </p>
              {e.description && <p className="w-preserve">{e.description}</p>}
              {e.sha256 && (
                <p>
                  Stored file · {e.filename} ({fmtBytes(e.size_bytes)})<br />
                  Intake SHA-256 · <code>{e.sha256}</code>
                </p>
              )}
            </>
          )}
        />
      </Section>
      <Section title="Chain of custody">
        <Ledger
          fields={['Evidence', 'Handoff', 'Recorded by', 'Recorded at']}
          rows={report.custody}
          empty="No custody entries recorded."
          render={(r) => [
            ref(r.evidence_id),
            <>
              <strong>
                {r.from_name || 'Intake'} → {r.to_name}
              </strong>
              <p>{r.location}</p>
              <p className="w-preserve">{r.reason}</p>
            </>,
            r.actor_name,
            timestamp(r.created_at),
          ]}
        />
      </Section>
      <Section title="Evidence relationships">
        <Ledger
          fields={['Source', 'Relationship', 'Target', 'Recorded at']}
          rows={report.relationships}
          empty="No evidence relationships recorded."
          render={(r) => [ref(r.source_id), label(r.kind), ref(r.target_id), timestamp(r.created_at)]}
        />
      </Section>
      <Section title="File integrity checks">
        <Lines
          rows={report.integrity_checks}
          empty="No stored-file comparisons recorded."
          render={(r) => (
            <>
              <strong>
                {ref(r.evidence_id)} · {r.matches ? 'Digest matched' : 'Hash mismatch'}
              </strong>
              <time>{timestamp(r.created_at)}</time>
              <p>Checked by {r.actor_name}</p>
              <p>
                Computed SHA-256 · <code>{r.digest}</code>
              </p>
            </>
          )}
        />
      </Section>
      <Section title="Case audit trail">
        <Ledger
          fields={['Recorded at', 'Action', 'Actor', 'Record']}
          rows={report.activity}
          empty="No case events recorded."
          render={(r) => {
            const event = describeEvent(r.action);
            return [
              timestamp(r.created_at),
              <>
                {event.title}
                {(r.subject_id || event.accountId) && (
                  <p>Affected account · {r.subject_name || r.subject_id || event.accountId}</p>
                )}
              </>,
              r.actor_name,
              r.evidence_code || r.case_code || report.code,
            ];
          }}
        />
      </Section>
    </article>
  );
}
export default function Dossier({ id, notify }) {
  const snapshot = useResource('/cases/' + encodeURIComponent(id) + '/report', 0, readSnapshot);
  return (
    <>
      <div className="w-dossier-tools">
        <a className="w-back" href="#/reports">
          <Icon name="back" size={16} />
          Case reports
        </a>
        {snapshot.data && (
          <div className="w-actions">
            <Button
              icon="download"
              onClick={() => {
                saveFile(snapshot.data.file, snapshot.data.report.code + '-case-report.json');
                notify('Case report downloaded.');
              }}
            >
              Export JSON
            </Button>
            <Button primary icon="reports" onClick={() => window.print()}>
              Print dossier
            </Button>
          </div>
        )}
      </div>
      <Pending resource={snapshot}>{(data) => <ReportListing report={data.report} />}</Pending>
    </>
  );
}
