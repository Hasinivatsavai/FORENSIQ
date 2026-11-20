import React, { useState } from 'react';
import { api } from '../api.js';
import { Field, FormModal, Pending, label, post, useResource } from './common.jsx';

export const statuses = ['open', 'in_review', 'closed'];
export const priorities = ['low', 'medium', 'high', 'critical'];
export const classifications = ['document', 'image', 'video', 'audio', 'device', 'archive', 'other'];
export const options = (items) =>
  items.map((item) => (
    <option key={item} value={item}>
      {label(item)}
    </option>
  ));
const fromForm = (form) => Object.fromEntries(form);
const peopleOptions = (people) =>
  people.map((person) => (
    <option key={person.id} value={person.id}>
      {person.name} · {label(person.role)}
    </option>
  ));

export function NewCase(props) {
  return (
    <FormModal
      {...props}
      title="Create a case"
      submitText="Create case"
      onSave={(f) => post('/cases', fromForm(f))}
    >
      <Field title="Case title">
        <input name="title" required maxLength={160} autoFocus />
      </Field>
      <Field title="Description (optional)">
        <textarea name="description" rows={4} maxLength={6000} />
      </Field>
      <Field title="Priority">
        <select name="priority" defaultValue="medium">
          {options(priorities)}
        </select>
      </Field>
    </FormModal>
  );
}
export function RegisterEvidence({ caseRecord, ...props }) {
  const cases = useResource(caseRecord ? null : '/cases');
  const available = caseRecord ? [caseRecord] : (cases.data || []).filter((c) => c.status !== 'closed');
  const [mode, setMode] = useState('file');
  function upload(form) {
    form.delete('intake_mode');
    const file = form.get('file');
    if (mode === 'file' && !file?.name) throw new Error('Choose a file.');
    if (file?.size > 10 * 1024 * 1024) throw new Error('Choose a file of 10 MiB or smaller.');
    if (mode === 'reference') form.delete('file');
    return post('/evidence', form);
  }
  return (
    <FormModal
      {...props}
      title="Register evidence"
      submitText="Register evidence"
      submitDisabled={!available.length}
      onSave={upload}
    >
      <Field title="Case">
        <select name="case_id" required defaultValue={caseRecord?.id || ''}>
          <option value="" disabled>
            Select a case
          </option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.title}
            </option>
          ))}
        </select>
      </Field>
      {!caseRecord && (
        <Pending resource={cases}>
          {() =>
            available.length ? null : (
              <p className="w-notice">Create or reopen a case to register evidence.</p>
            )
          }
        </Pending>
      )}
      <Field title="Evidence title">
        <input name="title" required maxLength={160} />
      </Field>
      <Field title="Classification">
        <select name="classification" defaultValue="document">
          {options(classifications)}
        </select>
      </Field>
      <Field title="Storage location or reference">
        <input name="location" required maxLength={300} />
      </Field>
      <Field title="Description (optional)">
        <textarea name="description" maxLength={6000} rows={2} />
      </Field>
      <fieldset className="w-choice">
        <legend>Evidence source</legend>
        <label>
          <input
            type="radio"
            name="intake_mode"
            checked={mode === 'file'}
            onChange={() => setMode('file')}
          />{' '}
          Upload a file
        </label>
        <label>
          <input
            type="radio"
            name="intake_mode"
            checked={mode === 'reference'}
            onChange={() => setMode('reference')}
          />{' '}
          External reference
        </label>
      </fieldset>
      {mode === 'file' ? (
        <Field title="Evidence file" hint="Up to 10 MiB. A SHA-256 digest is recorded at intake.">
          <input name="file" type="file" required />
        </Field>
      ) : (
        <p className="w-notice">
          This registers the item and its storage location. Hash verification requires a stored file.
        </p>
      )}
    </FormModal>
  );
}
export function AddNote({ record, ...props }) {
  return (
    <FormModal
      {...props}
      title="Add investigation note"
      submitText="Save note"
      onSave={(f) => post('/cases/' + record.id + '/notes', fromForm(f))}
    >
      <Field title="Note">
        <textarea name="body" rows={5} required autoFocus maxLength={6000} />
      </Field>
    </FormModal>
  );
}
export function ChangeStatus({ record, ...props }) {
  return (
    <FormModal
      {...props}
      title="Change case status"
      submitText="Update status"
      onSave={(f) => api('/cases/' + record.id, { method: 'PATCH', body: fromForm(f) })}
    >
      <Field
        title="Status"
        hint="Closed cases keep their files, reports and integrity checks available. Reopen a case to add evidence or document changes."
      >
        <select name="status" defaultValue={record.status}>
          {options(statuses)}
        </select>
      </Field>
    </FormModal>
  );
}
export function AddMember({ record, ...props }) {
  const directory = useResource('/directory');
  const excluded = new Set([record.owner_id, ...record.members.map((m) => m.id)]);
  const eligible = (directory.data || []).filter((u) => !excluded.has(u.id) && u.role !== 'admin');
  return (
    <FormModal
      {...props}
      title="Assign a case member"
      submitText="Assign member"
      submitDisabled={!eligible.length}
      onSave={(f) => post('/cases/' + record.id + '/members', fromForm(f))}
    >
      <Pending resource={directory}>
        {() =>
          eligible.length ? (
            <Field title="Member" hint="This person will gain access to the case and its evidence.">
              <select name="user_id" required defaultValue="">
                <option value="" disabled>
                  Select a team member
                </option>
                {peopleOptions(eligible)}
              </select>
            </Field>
          ) : (
            <p className="w-notice">
              All eligible team members already have access. Administrators have workspace-wide access.
            </p>
          )
        }
      </Pending>
    </FormModal>
  );
}
export function Transfer({ item, caseRecord, ...props }) {
  const directory = useResource('/directory');
  const [accepted, setAccepted] = useState(false);
  const members = new Set([caseRecord.owner_id, ...caseRecord.members.map((m) => m.id)]);
  const eligible = (directory.data || []).filter(
    (u) => u.id !== item.custodian_id && (u.role === 'admin' || members.has(u.id)),
  );
  return (
    <FormModal
      {...props}
      title="Transfer custody"
      submitText="Record transfer"
      submitDisabled={!eligible.length || !accepted}
      onSave={(f) => post('/evidence/' + item.id + '/custody', fromForm(f))}
    >
      <p className="w-notice">
        Current custodian · <strong>{item.custodian_name}</strong>
      </p>
      <Pending resource={directory}>
        {() =>
          eligible.length ? (
            <Field title="Receiving custodian">
              <select name="to_user_id" required defaultValue="">
                <option value="" disabled>
                  Select a custodian
                </option>
                {peopleOptions(eligible)}
              </select>
            </Field>
          ) : (
            <p className="w-notice">
              Assign another active team member to this case to transfer custody.
            </p>
          )
        }
      </Pending>
      <Field title="Receiving location">
        <input name="location" required maxLength={300} />
      </Field>
      <Field title="Reason for transfer">
        <textarea name="reason" required rows={3} maxLength={6000} />
      </Field>
      <label className="w-confirm">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /> I
        confirm the handoff details for {item.code}.
      </label>
    </FormModal>
  );
}
export function AddRelationship({ item, caseRecord, ...props }) {
  const candidates = caseRecord.evidence.filter((e) => e.id !== item.id);
  return (
    <FormModal
      {...props}
      title="Link evidence"
      submitText="Create relationship"
      submitDisabled={!candidates.length}
      onSave={(f) => post('/evidence/' + item.id + '/relationships', fromForm(f))}
    >
      <p className="w-notice">
        Source ·{' '}
        <strong>
          {item.code} — {item.title}
        </strong>
      </p>
      <Field title="Relationship">
        <select name="kind" defaultValue="related_to">
          {options(['related_to', 'derived_from', 'corroborates'])}
        </select>
      </Field>
      <Field title="Target evidence">
        <select name="target_id" required defaultValue="">
          <option value="" disabled>
            Select evidence from this case
          </option>
          {candidates.map((e) => (
            <option key={e.id} value={e.id}>
              {e.code} · {e.title}
            </option>
          ))}
        </select>
      </Field>
      {!candidates.length && (
        <p className="w-notice">Register a second evidence item in this case to create a link.</p>
      )}
    </FormModal>
  );
}
export function AddUser(props) {
  return (
    <FormModal
      {...props}
      title="Create team account"
      submitText="Create account"
      onSave={(f) => post('/users', fromForm(f))}
    >
      <Field title="Full name">
        <input name="name" autoComplete="off" required maxLength={160} autoFocus />
      </Field>
      <Field title="Email address">
        <input name="email" type="email" autoComplete="off" required maxLength={254} />
      </Field>
      <Field
        title="Password"
        hint="Use at least 12 characters. Provide this password to the account holder through a private channel."
      >
        <input
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </Field>
      <Field
        title="Role"
        hint="Viewers read assigned cases. Investigators can manage evidence. Administrators manage all cases and accounts."
      >
        <select name="role" defaultValue="viewer">
          {options(['viewer', 'investigator', 'admin'])}
        </select>
      </Field>
    </FormModal>
  );
}
export function AccountStatus({ person, ...props }) {
  return (
    <FormModal
      {...props}
      title={person.active ? 'Deactivate account' : 'Reactivate account'}
      submitText={person.active ? 'Deactivate' : 'Reactivate'}
      onSave={() => api('/users/' + person.id, { method: 'PATCH', body: { active: !person.active } })}
    >
      <p className="w-notice">
        <strong>{person.name}</strong> ({person.email}){' '}
        {person.active ? 'will lose access to this workspace.' : 'will regain access to this workspace.'}
      </p>
    </FormModal>
  );
}
