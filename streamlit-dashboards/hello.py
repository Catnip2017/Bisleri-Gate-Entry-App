import streamlit as st

st.set_page_config(
    page_title="Bisleri Dashboards",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Minimal inline CSS to match Bisleri brand colours ──────────────────────
st.markdown(
    """
    <style>
        body, .stApp { background-color: #E0F7FA; }
        h1 { color: #1a365d; }
        p  { color: #4a5568; font-size: 1.1rem; }
        .coming-soon-box {
            background: #ffffff;
            border-radius: 12px;
            border-top: 4px solid #00BCD4;
            padding: 2rem 2.5rem;
            max-width: 480px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
    </style>
    """,
    unsafe_allow_html=True,
)

# ── Header ──────────────────────────────────────────────────────────────────
col_logo, col_title = st.columns([1, 5])
with col_logo:
    st.markdown("## 📊")
with col_title:
    st.markdown("# Bisleri Dashboards")

st.divider()

# ── Placeholder content ─────────────────────────────────────────────────────
st.markdown(
    """
    <div class="coming-soon-box">
        <h2 style="color:#2b6cb0; margin-bottom: 0.5rem;">Hello! 👋</h2>
        <p>This is the <strong>Bisleri Dashboards</strong> placeholder page.</p>
        <p style="margin-top:1rem; color:#718096; font-size:0.95rem;">
            Live dashboards and analytics will be available here soon.
        </p>
    </div>
    """,
    unsafe_allow_html=True,
)
