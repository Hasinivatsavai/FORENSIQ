import streamlit as st
from datetime import datetime
import hashlib

# -----------------------------
# PAGE CONFIGURATION
# -----------------------------
st.set_page_config(
    page_title="FORENSIQ",
    page_icon="🔎",
    layout="wide"
)

# -----------------------------
# CUSTOM CSS
# -----------------------------
st.markdown("""
<style>
    .main-title {
        font-size: 42px;
        font-weight: 700;
        margin-bottom: 0px;
    }

    .subtitle {
        font-size: 18px;
        color: #777;
        margin-bottom: 30px;
    }

    .metric-box {
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #ddd;
        background-color: #fafafa;
    }

    .case-card {
        padding: 18px;
        border-radius: 12px;
        border: 1px solid #ddd;
        margin-bottom: 12px;
    }

    .high {
        color: #d32f2f;
        font-weight: bold;
    }

    .medium {
        color: #ef6c00;
        font-weight: bold;
    }

    .low {
        color: #388e3c;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# -----------------------------
# SIDEBAR
# -----------------------------
st.sidebar.title("🔎 FORENSIQ")
st.sidebar.caption("Digital Evidence Intelligence")

page = st.sidebar.radio(
    "Navigation",
    [
        "Dashboard",
        "Cases",
        "Evidence Vault",
        "AI Analysis",
        "Chain of Custody"
    ]
)

st.sidebar.divider()

st.sidebar.info(
    "AI-Assisted Smart Digital Forensics "
    "Evidence Management System"
)

# -----------------------------
# DASHBOARD
# -----------------------------
if page == "Dashboard":

    st.markdown(
        '<div class="main-title">FORENSIQ</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="subtitle">'
        'AI-Assisted Digital Forensics Evidence Management'
        '</div>',
        unsafe_allow_html=True
    )

    # Metrics
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Total Cases", "12")

    with col2:
        st.metric("Evidence Items", "47")

    with col3:
        st.metric("High Risk", "8")

    with col4:
        st.metric("Integrity Verified", "45 / 47")

    st.divider()

    st.subheader("Recent Investigations")

    cases = [
        ("CASE-2026-001", "Phishing Investigation", "8", "HIGH", "ACTIVE"),
        ("CASE-2026-002", "Unauthorized Access", "12", "MEDIUM", "ACTIVE"),
        ("CASE-2026-003", "Data Theft Investigation", "15", "CRITICAL", "REVIEW"),
        ("CASE-2026-004", "Suspicious Email", "12", "LOW", "CLOSED")
    ]

    for case_id, case_name, evidence, risk, status in cases:

        col1, col2, col3, col4, col5 = st.columns(
            [1.5, 3, 1, 1.2, 1.2]
        )

        with col1:
            st.write(f"**{case_id}**")

        with col2:
            st.write(case_name)

        with col3:
            st.write(f"{evidence} items")

        with col4:
            if risk in ["HIGH", "CRITICAL"]:
                st.markdown(
                    f'<span class="high">🔴 {risk}</span>',
                    unsafe_allow_html=True
                )
            elif risk == "MEDIUM":
                st.markdown(
                    f'<span class="medium">🟠 {risk}</span>',
                    unsafe_allow_html=True
                )
            else:
                st.markdown(
                    f'<span class="low">🟢 {risk}</span>',
                    unsafe_allow_html=True
                )

        with col5:
            st.write(status)

        st.divider()

# -----------------------------
# CASES
# -----------------------------
elif page == "Cases":

    st.title("📁 Case Management")

    st.write(
        "Create and manage digital forensic investigations."
    )

    st.subheader("Active Cases")

    cases = [
        {
            "id": "CASE-2026-001",
            "name": "Corporate Phishing Investigation",
            "investigator": "Forensic Analyst",
            "evidence": 8,
            "status": "ACTIVE"
        },
        {
            "id": "CASE-2026-002",
            "name": "Unauthorized System Access",
            "investigator": "Forensic Analyst",
            "evidence": 12,
            "status": "ACTIVE"
        },
        {
            "id": "CASE-2026-003",
            "name": "Potential Data Theft",
            "investigator": "Forensic Analyst",
            "evidence": 15,
            "status": "UNDER REVIEW"
        }
    ]

    for case in cases:

        st.markdown(
            f"""
            <div class="case-card">
                <h3>{case["id"]}</h3>
                <p><b>Investigation:</b> {case["name"]}</p>
                <p><b>Investigator:</b> {case["investigator"]}</p>
                <p><b>Evidence:</b> {case["evidence"]} items</p>
                <p><b>Status:</b> {case["status"]}</p>
            </div>
            """,
            unsafe_allow_html=True
        )

    st.subheader("Create New Case")

    case_name = st.text_input(
        "Investigation Name"
    )

    if st.button("Create Case"):

        if case_name:

            st.success(
                f"Case created successfully: {case_name}"
            )

        else:

            st.warning(
                "Please enter an investigation name."
            )

# -----------------------------
# EVIDENCE VAULT
# -----------------------------
elif page == "Evidence Vault":

    st.title("🗄️ Evidence Vault")

    st.write(
        "Upload digital evidence and generate a cryptographic "
        "fingerprint using SHA-256."
    )

    uploaded_file = st.file_uploader(
        "Upload Evidence",
        type=None
    )

    if uploaded_file:

        file_bytes = uploaded_file.getvalue()

        file_hash = hashlib.sha256(
            file_bytes
        ).hexdigest()

        file_size = len(file_bytes)

        st.success("Evidence successfully received.")

        st.subheader("Evidence Information")

        col1, col2 = st.columns(2)

        with col1:

            st.write("**Filename**")
            st.code(uploaded_file.name)

            st.write("**File Size**")
            st.write(f"{file_size:,} bytes")

            st.write("**Evidence Type**")
            st.write(
                uploaded_file.type
                if uploaded_file.type
                else "Unknown"
            )

        with col2:

            st.write("**SHA-256 Evidence Hash**")

            st.code(
                file_hash,
                language="text"
            )

            st.write("**Collection Timestamp**")

            st.write(
                datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S"
                )
            )

            st.success(
                "✓ Integrity fingerprint generated"
            )

# -----------------------------
# AI ANALYSIS
# -----------------------------
elif page == "AI Analysis":

    st.title("🤖 AI Evidence Analysis")

    st.write(
        "AI-assisted analysis of digital evidence."
    )

    evidence_type = st.selectbox(
        "Select Evidence Type",
        [
            "Suspicious Email",
            "Document",
            "System Log",
            "Network Artifact",
            "Image",
            "Unknown"
        ]
    )

    if st.button("Analyze Evidence"):

        st.subheader("Analysis Result")

        st.write(
            f"**Evidence Type:** {evidence_type}"
        )

        st.write("**Risk Level:** 🔴 HIGH")

        st.write("### Detected Indicators")

        indicators = [
            "Suspicious activity pattern",
            "Potential external communication",
            "Unusual metadata",
            "Requires further investigation"
        ]

        for indicator in indicators:
            st.write(f"✓ {indicator}")

        st.info(
            "AI-assisted classification indicates that "
            "this evidence requires further forensic review."
        )

        st.metric(
            "Analysis Confidence",
            "91%"
        )

# -----------------------------
# CHAIN OF CUSTODY
# -----------------------------
elif page == "Chain of Custody":

    st.title("🔗 Chain of Custody")

    st.write(
        "Track the lifecycle of digital evidence "
        "from collection to analysis."
    )

    st.subheader("Evidence ID: EVD-001")

    events = [
        ("07 Sep 2026 10:31", "Evidence collected"),
        ("07 Sep 2026 10:36", "Evidence uploaded"),
        ("07 Sep 2026 10:38", "SHA-256 hash generated"),
        ("07 Sep 2026 10:42", "AI analysis performed"),
        ("07 Sep 2026 11:05", "Analyst review")
    ]

    for timestamp, action in events:

        st.markdown(
            f"""
            **{timestamp}**

            🔹 {action}

            ↓
            """
        )

    st.success(
        "Evidence lifecycle successfully recorded."
    )
