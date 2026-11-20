-- All UUIDs use canonical text. The application validates input and binds them as parameters.
CREATE TABLE code_counters (
    prefix TEXT PRIMARY KEY NOT NULL CHECK (prefix IN ('CS','EV')),
    last_value INTEGER NOT NULL CHECK (last_value >= 0)
);
INSERT INTO code_counters(prefix,last_value) VALUES ('CS',0),('EV',0);
CREATE TABLE users (
    id UUID TEXT PRIMARY KEY NOT NULL,
    email text NOT NULL UNIQUE CHECK (email = lower(email)),
    name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin','investigator','viewer')),
    active BOOLEAN NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY NOT NULL CHECK(length(token_hash)=64),
    user_id UUID TEXT NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE login_limits (
    bucket TEXT PRIMARY KEY NOT NULL CHECK(length(bucket)=64),
    attempts integer NOT NULL,
    window_start INTEGER NOT NULL
);
CREATE INDEX login_limits_age ON login_limits(window_start);
CREATE TABLE cases (
    id UUID TEXT PRIMARY KEY NOT NULL,
    code text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    priority text NOT NULL CHECK (priority IN ('low','medium','high','critical')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','closed')),
    owner_id UUID TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX cases_owner ON cases(owner_id);
CREATE INDEX cases_date ON cases(created_at DESC);
CREATE TABLE case_members (
    case_id UUID TEXT NOT NULL REFERENCES cases(id),
    user_id UUID TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY (case_id,user_id)
);
CREATE INDEX case_members_user ON case_members(user_id,case_id);
CREATE TABLE notes (
    id UUID TEXT PRIMARY KEY NOT NULL,
    case_id UUID TEXT NOT NULL REFERENCES cases(id),
    author_id UUID TEXT NOT NULL REFERENCES users(id),
    body text NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX notes_case ON notes(case_id,created_at DESC);
CREATE TABLE evidence (
    id UUID TEXT PRIMARY KEY NOT NULL,
    code text NOT NULL UNIQUE,
    case_id UUID TEXT NOT NULL REFERENCES cases(id),
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    classification text NOT NULL CHECK (classification IN ('document','image','video','audio','device','archive','other')),
    location text NOT NULL,
    custodian_id UUID TEXT NOT NULL REFERENCES users(id),
    status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','transferred')),
    integrity text NOT NULL CHECK (integrity IN ('recorded','hashed','verified','mismatch')),
    filename text,
    size_bytes integer,
    sha256 TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    verified_at TEXT,
    UNIQUE(case_id,id),
    CHECK ((integrity='recorded' AND filename IS NULL AND size_bytes IS NULL AND sha256 IS NULL)
        OR (integrity<>'recorded' AND filename IS NOT NULL AND size_bytes IS NOT NULL AND size_bytes BETWEEN 0 AND 10485760 AND sha256 IS NOT NULL))
);
CREATE INDEX evidence_case ON evidence(case_id,created_at DESC);
CREATE INDEX evidence_custodian ON evidence(custodian_id);
CREATE TABLE evidence_files (
    evidence_id UUID TEXT PRIMARY KEY NOT NULL REFERENCES evidence(id),
    content BLOB NOT NULL CHECK (typeof(content)='blob' AND length(content) <= 10485760)
);
CREATE TABLE custody (
    id UUID TEXT PRIMARY KEY NOT NULL,
    evidence_id UUID TEXT NOT NULL REFERENCES evidence(id),
    from_id UUID TEXT REFERENCES users(id),
    to_id UUID TEXT NOT NULL REFERENCES users(id),
    actor_id UUID TEXT NOT NULL REFERENCES users(id),
    location text NOT NULL,
    reason text NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX custody_evidence ON custody(evidence_id,created_at DESC);
CREATE TABLE relationships (
    id UUID TEXT PRIMARY KEY NOT NULL,
    case_id UUID TEXT NOT NULL REFERENCES cases(id),
    source_id UUID TEXT NOT NULL,
    target_id UUID TEXT NOT NULL,
    kind text NOT NULL CHECK (kind IN ('related_to','derived_from','corroborates')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (source_id <> target_id),
    FOREIGN KEY (case_id,source_id) REFERENCES evidence(case_id,id),
    FOREIGN KEY (case_id,target_id) REFERENCES evidence(case_id,id)
);
CREATE UNIQUE INDEX relationships_symmetric ON relationships(min(source_id,target_id),max(source_id,target_id),kind);
CREATE INDEX relationships_case ON relationships(case_id);
CREATE TABLE integrity_checks (
    id UUID TEXT PRIMARY KEY NOT NULL,
    evidence_id UUID TEXT NOT NULL REFERENCES evidence(id),
    actor_id UUID TEXT NOT NULL REFERENCES users(id),
    digest TEXT NOT NULL,
    matches BOOLEAN NOT NULL CHECK (matches IN (0,1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX checks_evidence ON integrity_checks(evidence_id,created_at DESC);
CREATE TABLE audit (
    id UUID TEXT PRIMARY KEY NOT NULL,
    action text NOT NULL,
    subject_id UUID TEXT REFERENCES users(id),
    actor_id UUID TEXT REFERENCES users(id),
    case_id UUID TEXT REFERENCES cases(id),
    evidence_id UUID TEXT REFERENCES evidence(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX audit_case_date ON audit(case_id,created_at DESC);
CREATE INDEX audit_date ON audit(created_at DESC);
CREATE INDEX audit_evidence_date ON audit(evidence_id,created_at DESC);
CREATE TABLE session_signing_key (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    secret TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit
BEGIN
    SELECT RAISE(ABORT, 'Records in audit are append-only');
END;

CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit
BEGIN
    SELECT RAISE(ABORT, 'Records in audit are append-only');
END;

CREATE TRIGGER custody_no_update BEFORE UPDATE ON custody
BEGIN
    SELECT RAISE(ABORT, 'Records in custody are append-only');
END;

CREATE TRIGGER custody_no_delete BEFORE DELETE ON custody
BEGIN
    SELECT RAISE(ABORT, 'Records in custody are append-only');
END;

CREATE TRIGGER checks_no_update BEFORE UPDATE ON integrity_checks
BEGIN
    SELECT RAISE(ABORT, 'Records in integrity_checks are append-only');
END;

CREATE TRIGGER checks_no_delete BEFORE DELETE ON integrity_checks
BEGIN
    SELECT RAISE(ABORT, 'Records in integrity_checks are append-only');
END;

CREATE TRIGGER file_no_update BEFORE UPDATE ON evidence_files
BEGIN
    SELECT RAISE(ABORT, 'Records in evidence_files are append-only');
END;

CREATE TRIGGER file_no_delete BEFORE DELETE ON evidence_files
BEGIN
    SELECT RAISE(ABORT, 'Records in evidence_files are append-only');
END;

CREATE TRIGGER note_no_update BEFORE UPDATE ON notes
BEGIN
    SELECT RAISE(ABORT, 'Records in notes are append-only');
END;

CREATE TRIGGER note_no_delete BEFORE DELETE ON notes
BEGIN
    SELECT RAISE(ABORT, 'Records in notes are append-only');
END;

CREATE TRIGGER evidence_baseline_immutable BEFORE UPDATE ON evidence
WHEN (OLD.id, OLD.code, OLD.case_id, OLD.title, OLD.description, OLD.classification,
      OLD.filename, OLD.size_bytes, OLD.sha256, OLD.created_at) IS NOT
     (NEW.id, NEW.code, NEW.case_id, NEW.title, NEW.description, NEW.classification,
      NEW.filename, NEW.size_bytes, NEW.sha256, NEW.created_at)
BEGIN
    SELECT RAISE(ABORT, 'Original evidence registration is immutable');
END;
CREATE TRIGGER evidence_no_delete BEFORE DELETE ON evidence
BEGIN
    SELECT RAISE(ABORT, 'Original evidence registration is immutable');
END;
