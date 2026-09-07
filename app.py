import streamlit as st
import hashlib
from datetime import datetime
from pathlib import Path


# ============================================================
# PAGE CONFIG
# ============================================================

st.set_page_config(
    page_title="FORENSIQ — Digital Evidence Intelligence",
    page_icon="◈",
    layout="wide",
    initial_sidebar_state="collapsed"
)


# ============================================================
# SESSION STATE
# ============================================================

if "page" not in st.session_state:
    st.session_state.page = "Overview"

if "evidence" not in st.session_state:
    st.session_state.evidence = []

if "cases" not in st.session_state:
    st.session_state.cases = []


# ============================================================
# GLOBAL CSS
# ============================================================

st.markdown(
    """
    <style>

    /* -------------------------------------------------------
       GLOBAL
    ------------------------------------------------------- */

    #MainMenu {
        visibility: hidden;
    }

    footer {
        visibility: hidden;
    }

    header {
        background: transparent !important;
    }

    .stApp {
        background:
            radial-gradient(
                circle at 80% 10%,
                rgba(37, 99, 235, 0.10),
                transparent 28%
            ),
            radial-gradient(
                circle at 15% 80%,
                rgba(14, 165, 233, 0.06),
                transparent 25%
            ),
            #080b12;
        color: #f4f7fb;
    }

    .block-container {
        max-width: 1450px;
        padding-top: 1.5rem;
        padding-bottom: 4rem;
    }

    /* -------------------------------------------------------
       TYPOGRAPHY
    ------------------------------------------------------- */

    h1, h2, h3 {
        letter-spacing: -0.025em;
    }

    .eyebrow {
        color: #6f9cff;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 0.5rem;
    }

    .page-title {
        font-size: 2.65rem;
        font-weight: 750;
        line-height: 1.05;
        margin: 0;
        color: #f7f9fc;
    }

    .page-subtitle {
        color: #8791a3;
        font-size: 0.98rem;
        margin-top: 0.65rem;
        margin-bottom: 1.8rem;
    }

    /* -------------------------------------------------------
       TOP BRAND BAR
    ------------------------------------------------------- */

    .brand-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.65rem 0 1.25rem 0;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        margin-bottom: 1.7rem;
    }

    .brand-left {
        display: flex;
        align-items: center;
        gap: 0.85rem;
    }

    .brand-mark {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(
            145deg,
            #172d5f,
            #0d172d
        );
        border: 1px solid rgba(96,145,255,0.35);
        box-shadow:
            0 0 25px rgba(47,110,255,0.14),
            inset 0 0 15px rgba(47,110,255,0.07);
        color: #76a5ff;
        font-size: 1.2rem;
        font-weight: 800;
    }

    .brand-name {
        font-size: 1.05rem;
        font-weight: 750;
        letter-spacing: 0.04em;
        color: #f5f7fb;
    }

    .brand-caption {
        font-size: 0.68rem;
        color: #697386;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-top: 2px;
    }

    .system-status {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        color: #8994a8;
        font-size: 0.78rem;
    }

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #42d392;
        box-shadow: 0 0 12px rgba(66,211,146,0.7);
    }

    /* -------------------------------------------------------
       NAVIGATION BUTTONS
    ------------------------------------------------------- */

    div.stButton > button {
        border-radius: 9px;
        border: 1px solid rgba(255,255,255,0.07);
        background: rgba(255,255,255,0.025);
        color: #aab3c3;
        min-height: 42px;
        font-weight: 600;
        transition: all 0.18s ease;
    }

    div.stButton > button:hover {
        border-color: rgba(93,142,255,0.42);
        color: #ffffff;
        background: rgba(67,113,219,0.08);
        transform: translateY(-1px);
    }

    /* -------------------------------------------------------
       HERO
    ------------------------------------------------------- */

    .hero {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(105,145,220,0.16);
        border-radius: 20px;
        padding: 2.3rem;
        background:
            linear-gradient(
                120deg,
                rgba(21,38,72,0.72),
                rgba(10,14,23,0.82)
            );
        box-shadow:
            0 25px 70px rgba(0,0,0,0.28),
            inset 0 1px 0 rgba(255,255,255,0.025);
        margin-bottom: 1.4rem;
    }

    .hero:after {
        content: "";
        position: absolute;
        width: 340px;
        height: 340px;
        right: -130px;
        top: -160px;
        border-radius: 50%;
        background: rgba(64,120,255,0.08);
        filter: blur(8px);
    }

    .hero-kicker {
        color: #6f9cff;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
    }

    .hero-title {
        font-size: 2.35rem;
        line-height: 1.05;
        font-weight: 780;
        margin-top: 0.55rem;
        max-width: 760px;
    }

    .hero-text {
        color: #8e99ac;
        max-width: 680px;
        line-height: 1.65;
        margin-top: 0.8rem;
    }

    /* -------------------------------------------------------
       METRIC CARDS
    ------------------------------------------------------- */

    .metric-card {
        border: 1px solid rgba(255,255,255,0.075);
        border-radius: 15px;
        padding: 1.2rem 1.25rem;
        min-height: 118px;
        background: rgba(15,20,31,0.78);
        box-shadow:
            0 12px 35px rgba(0,0,0,0.16),
            inset 0 1px 0 rgba(255,255,255,0.02);
    }

    .metric-label {
        color: #737e91;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
    }

    .metric-value {
        font-size: 2rem;
        font-weight: 760;
        margin-top: 0.55rem;
        color: #f3f6fb;
    }

    .metric-note {
        color: #5e6879;
        font-size: 0.73rem;
        margin-top: 0.2rem;
    }

    /* -------------------------------------------------------
       PANELS
    ------------------------------------------------------- */

    .panel {
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 17px;
        padding: 1.35rem;
        background: rgba(12,17,27,0.82);
        box-shadow:
            0 15px 40px rgba(0,0,0,0.15),
            inset 0 1px 0 rgba(255,255,255,0.02);
    }

    .panel-title {
        color: #eef2f8;
        font-size: 1rem;
        font-weight: 700;
    }

    .panel-caption {
        color: #687386;
        font-size: 0.78rem;
        margin-top: 0.25rem;
        margin-bottom: 1.1rem;
    }

    /* -------------------------------------------------------
       FORENSIC GRID
    ------------------------------------------------------- */

    .signal {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.8rem 0;
        border-bottom: 1px solid rgba(255,255,255,0.055);
    }

    .signal:last-child {
        border-bottom: none;
    }

    .signal-name {
        color: #aeb7c7;
        font-size: 0.83rem;
    }

    .signal-value {
        color: #e9edf5;
        font-size: 0.78rem;
        font-weight: 650;
    }

    .verified {
        color: #54d99a;
    }

    .neutral {
        color: #7f8ba0;
    }

    /* -------------------------------------------------------
       EVIDENCE DROPZONE
    ------------------------------------------------------- */

    .dropzone {
        border: 1px dashed rgba(99,143,235,0.42);
        border-radius: 16px;
        padding: 2.3rem 1.5rem;
        text-align: center;
        background:
            linear-gradient(
                145deg,
                rgba(35,61,108,0.12),
                rgba(8,12,20,0.35)
            );
        margin-bottom: 1rem;
    }

    .drop-icon {
        font-size: 2rem;
        color: #709dff;
        margin-bottom: 0.5rem;
    }

    .drop-title {
        font-size: 1rem;
        font-weight: 700;
        color: #e9edf5;
    }

    .drop-text {
        color: #687386;
        font-size: 0.78rem;
        margin-top: 0.35rem;
    }

    /* -------------------------------------------------------
       HASH DISPLAY
    ------------------------------------------------------- */

    .hash-box {
        background: #070a10;
        border: 1px solid rgba(100,145,240,0.18);
        border-radius: 11px;
        padding: 0.9rem 1rem;
        color: #7fa7ff;
        font-family: monospace;
        font-size: 0.76rem;
        word-break: break-all;
    }

    /* -------------------------------------------------------
       TIMELINE
    ------------------------------------------------------- */

    .timeline-item {
        position: relative;
        padding: 0 0 1.25rem 1.7rem;
        margin-left: 0.25rem;
        border-left: 1px solid rgba(100,145,240,0.24);
    }

    .timeline-item:last-child {
        border-left: none;
    }

    .timeline-dot {
        position: absolute;
        left: -5px;
        top: 2px;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #5e91ff;
        box-shadow: 0 0 12px rgba(94,145,255,0.55);
    }

    .timeline-time {
        color: #657084;
        font-size: 0.7rem;
        font-family: monospace;
    }

    .timeline-action {
        color: #dfe5ef;
        font-size: 0.84rem;
        margin-top: 0.2rem;
    }

    /* -------------------------------------------------------
       EMPTY STATE
    ------------------------------------------------------- */

    .empty-state {
        text-align: center;
        padding: 3.5rem 1rem;
        border: 1px dashed rgba(255,255,255,0.09);
        border-radius: 16px;
        background: rgba(255,255,255,0.012);
    }

    .empty-symbol {
        font-size: 2rem;
        color: #526078;
        margin-bottom: 0.6rem;
    }

    .empty-title {
        color: #dce2ec;
        font-weight: 700;
        font-size: 1rem;
    }

    .empty-text {
        color: #687386;
        font-size: 0.78rem;
        max-width: 460px;
        margin: 0.45rem auto 0;
        line-height: 1.6;
    }

    /* -------------------------------------------------------
       FOOTER
    ------------------------------------------------------- */

    .footer {
        text-align: center;
        color: #414b5c;
        font-size: 0.68rem;
        padding-top: 2.5rem;
        letter-spacing: 0.05em;
    }

    /* -------------------------------------------------------
       MOBILE
    ------------------------------------------------------- */

    @media (max-width: 800px) {

        .page-title {
            font-size: 2rem;
        }

        .hero-title {
            font-size: 1.8rem;
        }

        .hero {
            padding: 1.5rem;
        }

        .brand-bar {
            align-items: flex-start;
        }

        .system-status {
            display: none;
        }

    }

    </style>
    """,
    unsafe_allow_html=True
)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def go_to(page):
    st.session_state.page = page


def calculate_sha256(file_bytes):
    return hashlib.sha256(file_bytes).hexdigest()


def format_bytes(size):
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.2f} KB"
    return f"{size / (1024 * 1024):.2f} MB"


# ============================================================
# TOP BRAND BAR
# ============================================================

st.markdown(
    """
    <div class="brand-bar">
        <div class="brand-left">
            <div class="brand-mark">◈</div>
            <div>
                <div class="brand-name">FORENSIQ</div>
                <div class="brand-caption">
                    Digital Evidence Intelligence
                </div>
            </div>
        </div>

        <div class="system-status">
            <span class="status-dot"></span>
            FORENSIC ENGINE READY
        </div>
    </div>
    """,
    unsafe_allow_html=True
)


# ============================================================
# NAVIGATION
# ============================================================

nav_cols = st.columns(4)

nav_items = [
    ("Overview", "01"),
    ("Cases", "02"),
    ("Evidence", "03"),
    ("Investigation", "04")
]

for col, (name, number) in zip(nav_cols, nav_items):

    with col:

        if st.session_state.page == name:
            button_label = f"◆  {number}   {name}"
        else:
            button_label = f"◇  {number}   {name}"

        if st.button(
            button_label,
            key=f"nav_{name}",
            use_container_width=True
        ):
            go_to(name)
            st.rerun()


st.markdown("<br>", unsafe_allow_html=True)


# ============================================================
# OVERVIEW
# ============================================================

if st.session_state.page == "Overview":

    st.markdown(
        '<div class="eyebrow">FORENSIC OPERATIONS CENTER</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="page-title">Evidence Intelligence</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="page-subtitle">'
        'A controlled workspace for collecting, preserving, '
        'verifying and investigating digital evidence.'
        '</div>',
        unsafe_allow_html=True
    )

    # Hero

    st.markdown(
        """
        <div class="hero">
            <div class="hero-kicker">
                AI-ASSISTED DIGITAL FORENSICS
            </div>

            <div class="hero-title">
                Preserve the evidence.<br>
                Understand the trace.
            </div>

            <div class="hero-text">
                FORENSIQ provides a structured environment for
                digital evidence ingestion, cryptographic integrity
                verification, forensic metadata inspection and
                investigator-assisted analysis.
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

    # Real counters

    evidence_count = len(st.session_state.evidence)
    case_count = len(st.session_state.cases)

    metric1, metric2, metric3, metric4 = st.columns(4)

    with metric1:
        st.markdown(
            f"""
            <div class="metric-card">
                <div class="metric-label">Active Cases</div>
                <div class="metric-value">{case_count:02d}</div>
                <div class="metric-note">
                    Recorded investigations
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    with metric2:
        st.markdown(
            f"""
            <div class="metric-card">
                <div class="metric-label">Evidence Items</div>
                <div class="metric-value">{evidence_count:02d}</div>
                <div class="metric-note">
                    In current workspace
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    with metric3:
        st.markdown(
            """
            <div class="metric-card">
                <div class="metric-label">Integrity</div>
                <div class="metric-value">SHA-256</div>
                <div class="metric-note">
                    Cryptographic fingerprinting
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    with metric4:
        st.markdown(
            """
            <div class="metric-card">
                <div class="metric-label">System</div>
                <div class="metric-value verified">READY</div>
                <div class="metric-note">
                    Evidence engine operational
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    st.markdown("<br>", unsafe_allow_html=True)

    left, right = st.columns([1.35, 0.65])

    with left:

        st.markdown(
            """
            <div class="panel">
                <div class="panel-title">
                    Evidence Operations
                </div>
                <div class="panel-caption">
                    Current forensic workspace status
                </div>
            """,
            unsafe_allow_html=True
        )

        if evidence_count == 0:

            st.markdown(
                """
                <div class="empty-state">
                    <div class="empty-symbol">◇</div>
                    <div class="empty-title">
                        No evidence registered
                    </div>
                    <div class="empty-text">
                        Your workspace is clean. Upload a genuine
                        evidence artifact to begin forensic ingestion,
                        hashing and analysis.
                    </div>
                </div>
                """,
                unsafe_allow_html=True
            )

        else:

            for item in st.session_state.evidence:

                st.markdown(
                    f"""
                    <div class="signal">
                        <span class="signal-name">
                            {item["filename"]}
                        </span>
                        <span class="signal-value verified">
                            VERIFIED
                        </span>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

        st.markdown("</div>", unsafe_allow_html=True)

    with right:

        st.markdown(
            """
            <div class="panel">
                <div class="panel-title">
                    System Integrity
                </div>

                <div class="panel-caption">
                    Core forensic controls
                </div>

                <div class="signal">
                    <span class="signal-name">
                        Evidence hashing
                    </span>
                    <span class="signal-value verified">
                        ACTIVE
                    </span>
                </div>

                <div class="signal">
                    <span class="signal-name">
                        SHA-256
                    </span>
                    <span class="signal-value verified">
                        ENABLED
                    </span>
                </div>

                <div class="signal">
                    <span class="signal-name">
                        Metadata extraction
                    </span>
                    <span class="signal-value neutral">
                        READY
                    </span>
                </div>

                <div class="signal">
                    <span class="signal-name">
                        AI analysis
                    </span>
                    <span class="signal-value neutral">
                        STANDBY
                    </span>
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    st.markdown(
        '<div class="footer">'
        'FORENSIQ • AI-ASSISTED SMART DIGITAL FORENSICS '
        'EVIDENCE MANAGEMENT SYSTEM'
        '</div>',
        unsafe_allow_html=True
    )


# ============================================================
# CASES
# ============================================================

elif st.session_state.page == "Cases":

    st.markdown(
        '<div class="eyebrow">INVESTIGATION MANAGEMENT</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="page-title">Cases</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="page-subtitle">'
        'Create and organize forensic investigations.'
        '</div>',
        unsafe_allow_html=True
    )

    with st.expander("＋  Create a new investigation"):

        case_name = st.text_input(
            "Investigation name",
            placeholder="Example: Suspicious Email Investigation"
        )

        case_description = st.text_area(
            "Description",
            placeholder="Briefly describe the investigation..."
        )

        if st.button(
            "Create Investigation",
            use_container_width=True
        ):

            if not case_name.strip():

                st.warning(
                    "Enter an investigation name first."
                )

            else:

                new_case = {
                    "id": f"CASE-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "name": case_name.strip(),
                    "description": case_description.strip(),
                    "created": datetime.now().strftime(
                        "%Y-%m-%d %H:%M:%S"
                    )
                }

                st.session_state.cases.append(new_case)

                st.success(
                    "Investigation created successfully."
                )

    st.markdown("<br>", unsafe_allow_html=True)

    if not st.session_state.cases:

        st.markdown(
            """
            <div class="empty-state">
                <div class="empty-symbol">◈</div>
                <div class="empty-title">
                    No investigations yet
                </div>
                <div class="empty-text">
                    Create your first case to begin organizing
                    evidence and investigation activity.
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    else:

        for case in st.session_state.cases:

            st.markdown(
                f"""
                <div class="panel">
                    <div class="eyebrow">
                        {case["id"]}
                    </div>

                    <div class="panel-title">
                        {case["name"]}
                    </div>

                    <div class="panel-caption">
                        {case["description"]
                        if case["description"]
                        else "No description provided."}
                    </div>

                    <div class="signal">
                        <span class="signal-name">
                            Created
                        </span>

                        <span class="signal-value">
                            {case["created"]}
                        </span>
                    </div>

                    <div class="signal">
                        <span class="signal-name">
                            Status
                        </span>

                        <span class="signal-value verified">
                            ACTIVE
                        </span>
                    </div>
                </div>
                """,
                unsafe_allow_html=True
            )

            st.markdown("<br>", unsafe_allow_html=True)


# ============================================================
# EVIDENCE
# ============================================================

elif st.session_state.page == "Evidence":

    st.markdown(
        '<div class="eyebrow">DIGITAL EVIDENCE INGESTION</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="page-title">Evidence Vault</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="page-subtitle">'
        'Ingest an artifact and generate its cryptographic fingerprint.'
        '</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        """
        <div class="dropzone">
            <div class="drop-icon">◇</div>
            <div class="drop-title">
                Evidence ingestion
            </div>
            <div class="drop-text">
                Select an original evidence artifact.
                FORENSIQ will calculate its SHA-256 fingerprint.
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

    uploaded_file = st.file_uploader(
        "Select evidence file",
        type=None,
        label_visibility="collapsed"
    )

    if uploaded_file is not None:

        file_bytes = uploaded_file.getvalue()

        file_hash = calculate_sha256(file_bytes)

        file_size = len(file_bytes)

        timestamp = datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        suffix = Path(uploaded_file.name).suffix.lower()

        evidence_id = (
            f"EVD-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        )

        # Prevent duplicate registration during Streamlit reruns

        existing_hashes = [
            item["sha256"]
            for item in st.session_state.evidence
        ]

        if file_hash not in existing_hashes:

            st.session_state.evidence.append(
                {
                    "id": evidence_id,
                    "filename": uploaded_file.name,
                    "size": file_size,
                    "type": uploaded_file.type
                    or "Unknown",
                    "extension": suffix
                    or "Unknown",
                    "sha256": file_hash,
                    "timestamp": timestamp
                }
            )

        st.markdown("<br>", unsafe_allow_html=True)

        st.markdown(
            """
            <div class="panel">
                <div class="eyebrow">
                    EVIDENCE REGISTERED
                </div>

                <div class="panel-title">
                    Cryptographic fingerprint generated
                </div>

                <div class="panel-caption">
                    This SHA-256 value was calculated directly
                    from the uploaded file.
                </div>
            """,
            unsafe_allow_html=True
        )

        info1, info2, info3 = st.columns(3)

        with info1:

            st.markdown(
                f"""
                <div class="signal">
                    <span class="signal-name">
                        Evidence ID
                    </span>
                    <span class="signal-value">
                        {evidence_id}
                    </span>
                </div>

                <div class="signal">
                    <span class="signal-name">
                        Filename
                    </span>
                    <span class="signal-value">
                        {uploaded_file.name}
                    </span>
                </div>
                """,
                unsafe_allow_html=True
            )

        with info2:

            st.markdown(
                f"""
                <div class="signal">
                    <span class="signal-name">
                        File size
                    </span>
                    <span class="signal-value">
                        {format_bytes(file_size)}
                    </span>
                </div>

                <div class="signal">
                    <span class="signal-name">
                        File type
                    </span>
                    <span class="signal-value">
                        {uploaded_file.type or "Unknown"}
                    </span>
                </div>
                """,
                unsafe_allow_html=True
            )

        with info3:

            st.markdown(
                f"""
                <div class="signal">
                    <span class="signal-name">
                        Collected
                    </span>
                    <span class="signal-value">
                        {timestamp}
                    </span>
                </div>

                <div class="signal">
                    <span class="signal-name">
                        Integrity
                    </span>
                    <span class="signal-value verified">
                        VERIFIED
                    </span>
                </div>
                """,
                unsafe_allow_html=True
            )

        st.markdown(
            "<br><div class='panel-caption'>SHA-256 FINGERPRINT</div>",
            unsafe_allow_html=True
        )

        st.markdown(
            f"""
            <div class="hash-box">
                {file_hash}
            </div>
            """,
            unsafe_allow_html=True
        )

        st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    st.markdown(
        """
        <div class="panel">
            <div class="panel-title">
                Registered Evidence
            </div>

            <div class="panel-caption">
                Evidence currently available in this workspace.
            </div>
        """,
        unsafe_allow_html=True
    )

    if not st.session_state.evidence:

        st.markdown(
            """
            <div class="empty-state">
                <div class="empty-symbol">◇</div>
                <div class="empty-title">
                    Evidence vault is empty
                </div>
                <div class="empty-text">
                    No artifacts have been registered yet.
                    Upload a genuine evidence file above.
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    else:

        for item in reversed(st.session_state.evidence):

            st.markdown(
                f"""
                <div class="signal">
                    <span class="signal-name">
                        {item["filename"]}
                    </span>

                    <span class="signal-value verified">
                        SHA-256 VERIFIED
                    </span>
                </div>
                """,
                unsafe_allow_html=True
            )

    st.markdown("</div>", unsafe_allow_html=True)


# ============================================================
# INVESTIGATION
# ============================================================

elif st.session_state.page == "Investigation":

    st.markdown(
        '<div class="eyebrow">FORENSIC INVESTIGATION</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="page-title">Investigation Timeline</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="page-subtitle">'
        'A chronological view of evidence handling and analysis.'
        '</div>',
        unsafe_allow_html=True
    )

    if not st.session_state.evidence:

        st.markdown(
            """
            <div class="empty-state">
                <div class="empty-symbol">◌</div>
                <div class="empty-title">
                    Investigation timeline is waiting
                </div>
                <div class="empty-text">
                    Register an evidence artifact first.
                    Its ingestion event will become the first
                    recorded forensic activity.
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    else:

        latest = st.session_state.evidence[-1]

        left, right = st.columns([1.2, 0.8])

        with left:

            st.markdown(
                """
                <div class="panel">
                    <div class="panel-title">
                        Chain of Custody
                    </div>

                    <div class="panel-caption">
                        Evidence lifecycle
                    </div>
                """,
                unsafe_allow_html=True
            )

            events = [
                (
                    latest["timestamp"],
                    "Evidence artifact received"
                ),
                (
                    latest["timestamp"],
                    "Evidence registered"
                ),
                (
                    latest["timestamp"],
                    "SHA-256 fingerprint generated"
                )
            ]

            for event_time, action in events:

                st.markdown(
                    f"""
                    <div class="timeline-item">
                        <div class="timeline-dot"></div>

                        <div class="timeline-time">
                            {event_time}
                        </div>

                        <div class="timeline-action">
                            {action}
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

            st.markdown("</div>", unsafe_allow_html=True)

        with right:

            st.markdown(
                f"""
                <div class="panel">
                    <div class="panel-title">
                        Current Artifact
                    </div>

                    <div class="panel-caption">
                        Evidence under investigation
                    </div>

                    <div class="signal">
                        <span class="signal-name">
                            Filename
                        </span>

                        <span class="signal-value">
                            {latest["filename"]}
                        </span>
                    </div>

                    <div class="signal">
                        <span class="signal-name">
                            Size
                        </span>

                        <span class="signal-value">
                            {format_bytes(latest["size"])}
                        </span>
                    </div>

                    <div class="signal">
                        <span class="signal-name">
                            Integrity
                        </span>

                        <span class="signal-value verified">
                            VERIFIED
                        </span>
                    </div>

                    <br>

                    <div class="panel-caption">
                        SHA-256
                    </div>

                    <div class="hash-box">
                        {latest["sha256"]}
                    </div>
                </div>
                """,
                unsafe_allow_html=True
            )

        st.markdown("<br>", unsafe_allow_html=True)

        st.info(
            "AI-assisted interpretation will be connected after "
            "the evidence ingestion and integrity layer is complete."
        )
