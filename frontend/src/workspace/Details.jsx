import React from 'react';
import { api } from '../api.js';
import {
  Action,
  Button,
  Chip,
  Empty,
  EvidenceRows,
  Icon,
  PageHeader,
  Panel,
  Pending,
  Timeline,
  dateTime,
  describeEvent,
  downloadReport,
  fmtBytes,
  integrityText,
  label,
  post,
  saveFile,
  useResource,
} from './common.jsx';

function Facts({ rows }) {
  return (
    <dl className="w-facts">
      {rows.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function CaseDetail({ id, revision, user, open, notify }) {
  const resource = useResource('/cases/' + encodeURIComponent(id), revision);
  return (
    <Pending resource={resource}>
      {(record) => {
        const canWrite = user.role !== 'viewer',
          editable = canWrite && record.status !== 'closed';
        const isManager = user.role === 'admin' || user.id === record.owner_id;
        const others = record.members.filter((m) => m.id !== record.owner_id);
        return (
          <>
            <PageHeader
              eyebrow={record.code}
              title={record.title}
              back={{ label: 'Case files', path: 'cases' }}
            >
              <Action
                text="Export report"
                icon="download"
                perform={() => downloadReport(record)}
                onSuccess={() => notify('Case report downloaded.')}
              />
              {editable && (
                <Button primary icon="plus" onClick={() => open('register', { caseRecord: record })}>
                  Register evidence
                </Button>
              )}
            </PageHeader>
            <Panel
              title="Case summary"
              actions={
                canWrite && (
                  <Button quiet onClick={() => open('status', { record })}>
                    Change status
                  </Button>
                )
              }
            >
              {record.description && <p className="w-description">{record.description}</p>}
              <Facts
                rows={[
                  ['Status', <Chip value={record.status} />],
                  ['Priority', <Chip value={record.priority} />],
                  ['Case owner', record.owner_name],
                  [
                    'Report',
                    <a href={'#/reports/' + record.id}>
                      Open dossier <Icon name="open" size={14} />
                    </a>,
                  ],
                  ['Opened', dateTime(record.created_at)],
                ]}
              />
            </Panel>
            <Panel title={'Evidence (' + record.evidence.length + ')'}>
              <EvidenceRows rows={record.evidence} />
            </Panel>
            <div className="w-two-col">
              <Panel
                title="Investigation notes"
                actions={
                  editable && (
                    <Button quiet icon="plus" onClick={() => open('note', { record })}>
                      Add note
                    </Button>
                  )
                }
              >
                <Timeline
                  rows={record.notes}
                  empty="No investigation notes yet"
                  render={(n) => (
                    <>
                      <strong>{n.author_name}</strong>
                      <p className="w-preserve">{n.body}</p>
                    </>
                  )}
                />
              </Panel>
              <Panel
                title="Case team"
                actions={
                  editable &&
                  isManager && (
                    <Button quiet icon="plus" onClick={() => open('member', { record })}>
                      Assign member
                    </Button>
                  )
                }
              >
                <ul className="w-people">
                  <li>
                    <span className="w-initial">{record.owner_name.slice(0, 1)}</span>
                    <strong>{record.owner_name}</strong>
                    <span>Owner</span>
                  </li>
                  {others.map((m) => (
                    <li key={m.id}>
                      <span className="w-initial">{m.name.slice(0, 1)}</span>
                      <strong>{m.name}</strong>
                      <span>{label(m.role)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </>
        );
      }}
    </Pending>
  );
}
function StoredFile({ item, canWrite, refresh, notify }) {
  const explanations = {
    recorded: 'The item points to an external location. No file was attached at intake.',
    hashed: 'The SHA-256 digest was recorded at intake. The stored copy is ready for a comparison.',
    verified: 'The stored copy matched its intake SHA-256 digest at the most recent check.',
    mismatch: 'The latest SHA-256 check differed from the intake digest. Review the check history.',
  };
  async function download() {
    const file = await api('/evidence/' + item.id + '/download');
    if (!(file instanceof Blob)) throw new Error('The server did not return a downloadable file.');
    saveFile(file, item.filename);
  }
  return (
    <Panel
      title="File integrity"
      actions={<Chip value={item.integrity}>{integrityText[item.integrity]}</Chip>}
    >
      <p className="w-description">{explanations[item.integrity]}</p>
      {item.filename && (
        <>
          <Facts
            rows={[
              ['Original filename', item.filename],
              ['Stored size', fmtBytes(item.size_bytes)],
              ['Last check', dateTime(item.verified_at)],
            ]}
          />
          <div className="w-hash">
            <span>Intake SHA-256</span>
            <code>{item.sha256}</code>
          </div>
          <div className="w-actions w-panel-actions">
            <Action
              text="Download file"
              icon="download"
              perform={download}
              onSuccess={() => {
                notify('Evidence file downloaded.');
                refresh();
              }}
            />
            {canWrite && (
              <Action
                text="Verify stored file"
                primary
                icon="shield"
                working="Checking bytes…"
                perform={() => post('/evidence/' + item.id + '/verify')}
                onSuccess={(result) => {
                  notify(
                    result.matches
                      ? 'Stored file matches its intake digest.'
                      : 'Integrity mismatch recorded. Review the check history.',
                  );
                  refresh();
                }}
              />
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
function EvidenceRecord({ item, revision, user, open, refresh, notify }) {
  const parent = useResource('/cases/' + item.case_id, revision);
  const canWrite = user.role !== 'viewer',
    caseRecord = parent.data,
    editable = canWrite && caseRecord && caseRecord.status !== 'closed';
  const transfer = editable && (user.role === 'admin' || user.id === item.custodian_id);
  return (
    <>
      <PageHeader
        title={item.title}
        eyebrow={item.code}
        back={{ label: 'Evidence register', path: 'evidence' }}
      />
      <Panel title="Evidence record" actions={<Chip value={item.status} />}>
        {item.description && <p className="w-description">{item.description}</p>}
        <Facts
          rows={[
            [
              'Case',
              <a href={'#/cases/' + item.case_id}>
                {item.case_code} <Icon name="open" size={14} />
              </a>,
            ],
            ['Classification', label(item.classification)],
            ['Custodian', item.custodian_name],
            ['Storage location', item.location],
            ['Registered', dateTime(item.created_at)],
          ]}
        />
      </Panel>
      {parent.error && <Pending resource={parent}>{() => null}</Pending>}
      <StoredFile item={item} canWrite={canWrite} refresh={refresh} notify={notify} />
      <div className="w-two-col">
        <Panel
          title="Chain of custody"
          actions={
            transfer && (
              <Button quiet icon="handoff" onClick={() => open('transfer', { item, caseRecord })}>
                Transfer
              </Button>
            )
          }
        >
          <Timeline
            rows={item.custody}
            empty="No custody entries"
            render={(c) => (
              <>
                <strong>
                  {c.from_name ? c.from_name + ' → ' + c.to_name : 'Intake · ' + c.to_name}
                </strong>
                <p>{c.location}</p>
                <p className="w-preserve">{c.reason}</p>
                <small>Recorded by {c.actor_name}</small>
              </>
            )}
          />
        </Panel>
        <Panel
          title="Linked evidence"
          actions={
            editable && (
              <Button quiet icon="link" onClick={() => open('link', { item, caseRecord })}>
                Add link
              </Button>
            )
          }
        >
          {item.relationships.length ? (
            <ul className="w-records">
              {item.relationships.map((r) => (
                <li key={r.id}>
                  <a href={'#/evidence/' + r.target_id}>
                    <span className="w-recordicon">
                      <Icon name="link" />
                    </span>
                    <span className="w-recordtitle">
                      <small>
                        {label(r.kind)} · {r.target_code}
                      </small>
                      <strong>{r.target_title}</strong>
                    </span>
                    <Icon name="chevron" size={16} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              icon="link"
              title="No linked evidence"
              detail="Relationships connect items within this case."
            />
          )}
        </Panel>
      </div>
      <div className="w-two-col">
        <Panel title="Integrity checks">
          <Timeline
            rows={item.checks}
            empty="No stored-file comparisons yet"
            render={(c) => (
              <>
                <strong>{c.matches ? 'Digest matched' : 'Digest mismatch'}</strong>
                <p>{c.actor_name}</p>
                <code className="w-digest">{c.digest}</code>
              </>
            )}
          />
        </Panel>
        <Panel title="Evidence activity">
          <Timeline
            rows={item.events}
            render={(e) => (
              <>
                <strong>{describeEvent(e.action).title}</strong>
                <p>{e.actor_name}</p>
              </>
            )}
          />
        </Panel>
      </div>
    </>
  );
}
export function EvidenceDetail({ id, revision, ...props }) {
  const resource = useResource('/evidence/' + encodeURIComponent(id), revision);
  return (
    <Pending resource={resource}>
      {(item) => <EvidenceRecord item={item} revision={revision} {...props} />}
    </Pending>
  );
}
