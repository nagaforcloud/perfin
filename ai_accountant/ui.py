"""
Streamlit UI for AI Accountant.

Provides a web-based interface for:
- Uploading bank statement PDFs
- Running the processing pipeline
- Viewing financial summaries
- Downloading reports

SECURITY IMPROVEMENTS APPLIED:
- File size limits (10MB max)
- Path traversal protection
- PDF MIME validation
- Secure temporary file handling
- Input validation
"""

import streamlit as st
import pandas as pd
from pathlib import Path
import sys
import time
import tempfile
import hashlib
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from core.config import Config
from core.ledger import Ledger
from core.pipeline import AIPipeline
from scripts.financial_summary import FinancialAnalyzer
from scripts.export_excel import ExcelReportGenerator, ReportConfig

# Security constants
MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_MIME_TYPES = ['application/pdf']
ALLOWED_EXTENSIONS = ['.pdf']


def init_session_state():
    """Initialize session state variables."""
    if 'config' not in st.session_state:
        st.session_state.config = Config()
    if 'ledger' not in st.session_state:
        st.session_state.ledger = Ledger(st.session_state.config)
    if 'pipeline' not in st.session_state:
        st.session_state.pipeline = None
    if 'last_refresh' not in st.session_state:
        st.session_state.last_refresh = None


def get_ledger_summary():
    """Get summary statistics from the ledger."""
    ledger = st.session_state.ledger
    total = ledger.get_transaction_count()
    uncategorized = len(ledger.get_uncategorized_transactions())
    date_range = ledger.get_date_range()

    return {
        'total': total,
        'uncategorized': uncategorized,
        'categorized': total - uncategorized,
        'date_range': date_range,
        'source_files': ledger.get_source_files()
    }


def validate_pdf_file(uploaded_file) -> tuple[bool, str]:
    """
    Validate uploaded PDF file for security.
    
    Checks:
    - File size within limits
    - Valid PDF extension
    - Valid MIME type
    - File is not empty
    
    Args:
        uploaded_file: Streamlit uploaded file object
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check file size
    if uploaded_file.size > MAX_FILE_SIZE_BYTES:
        return False, f"File too large. Maximum size is {MAX_FILE_SIZE_MB}MB"
    
    if uploaded_file.size == 0:
        return False, "File is empty"
    
    # Check extension
    file_ext = Path(uploaded_file.name).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        return False, f"Invalid file type. Only PDF files are allowed"
    
    # Check MIME type
    if uploaded_file.type not in ALLOWED_MIME_TYPES:
        return False, f"Invalid MIME type: {uploaded_file.type}"
    
    # Basic PDF header check (first 4 bytes should be %PDF)
    file_header = uploaded_file.read(4)
    uploaded_file.seek(0)  # Reset file pointer
    
    if not file_header.startswith(b'%PDF'):
        return False, "File does not appear to be a valid PDF"
    
    return True, ""


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal and other attacks.
    
    Args:
        filename: Original filename
        
    Returns:
        Sanitized filename safe for storage
    """
    # Remove path components
    filename = Path(filename).name
    
    # Remove any remaining dangerous characters
    # Keep only alphanumeric, dots, hyphens, and underscores
    sanitized = ''.join(
        c for c in filename 
        if c.isalnum() or c in '._-'
    )
    
    # Ensure it's not empty
    if not sanitized:
        sanitized = f"unnamed_{int(time.time())}.pdf"
    
    # Limit length
    if len(sanitized) > 200:
        name, ext = Path(sanitized).stem, Path(sanitized).suffix
        sanitized = f"{name[:195-len(ext)]}{ext}"
    
    return sanitized


def render_sidebar():
    """Render the sidebar navigation."""
    st.sidebar.title("📊 AI Accountant")
    st.sidebar.markdown("---")

    menu = st.sidebar.radio(
        "Navigation",
        ["Dashboard", "Upload PDFs", "Transactions", "Reports", "Settings"],
        index=0
    )

    st.sidebar.markdown("---")

    # Quick stats
    summary = get_ledger_summary()
    st.sidebar.metric("Total Transactions", summary['total'])
    st.sidebar.metric("Categorized", summary['categorized'])
    st.sidebar.metric("Needs Review", summary['uncategorized'])

    # LLM status
    col1, col2 = st.sidebar.columns(2)
    with col1:
        st.caption("LLM Server")
    with col2:
        # Simple health check
        import requests
        try:
            requests.get("http://localhost:8080", timeout=1)
            st.success("✅")
        except:
            st.error("❌")

    return menu


def render_dashboard():
    """Render the main dashboard."""
    st.title("📊 Financial Dashboard")

    # Get financial summary
    analyzer = FinancialAnalyzer(st.session_state.config, st.session_state.ledger)
    summary = analyzer.generate_summary()
    health = analyzer.get_financial_health_score()

    # Key metrics row
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            "Total Income",
            f"${summary.total_income:,.2f}",
            delta=None
        )

    with col2:
        st.metric(
            "Total Expenses",
            f"${summary.total_expenses:,.2f}",
            delta=None,
            delta_color="inverse"
        )

    with col3:
        st.metric(
            "Net Savings",
            f"${summary.net_savings:,.2f}",
            delta=f"{summary.savings_rate}%" if summary.savings_rate > 0 else None
        )

    with col4:
        st.metric(
            "Health Score",
            f"{health['total_score']}/100",
            delta=health['rating']
        )

    st.markdown("---")

    # Charts row
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("📁 Category Breakdown")

        # Prepare category data
        expense_categories = {
            cat: abs(data['total'])
            for cat, data in summary.category_breakdown.items()
            if data['total'] < 0 and cat != 'Needs Review'
        }

        if expense_categories:
            category_df = pd.DataFrame({
                'Category': list(expense_categories.keys()),
                'Amount': list(expense_categories.values())
            })
            category_df = category_df.sort_values('Amount', ascending=True)

            st.bar_chart(
                category_df.set_index('Category'),
                horizontal=True
            )
        else:
            st.info("No categorized expenses yet")

    with col2:
        st.subheader("📈 Monthly Trend")

        if summary.monthly_summary:
            monthly_df = pd.DataFrame(summary.monthly_summary)
            monthly_df = monthly_df.set_index('month')

            st.line_chart(
                monthly_df[['income', 'expenses']]
            )
        else:
            st.info("No monthly data yet")

    st.markdown("---")

    # Recent transactions
    st.subheader("📋 Recent Transactions")

    transactions = st.session_state.ledger.get_all_transactions(limit=10)

    if transactions:
        df = pd.DataFrame(transactions)

        # Format for display
        display_df = df[['date', 'description', 'category', 'amount']].copy()
        display_df.columns = ['Date', 'Description', 'Category', 'Amount']

        # Color code amounts
        def color_amount(val):
            color = '#d73027' if val < 0 else '#1a9850'
            return f'color: {color}'

        st.dataframe(
            display_df.style.map(color_amount, subset=['Amount']),
            use_container_width=True,
            hide_index=True
        )
    else:
        st.info("No transactions in ledger. Upload PDFs to get started.")


def render_upload():
    """Render the PDF upload page with security validations."""
    st.title("📤 Upload Bank Statements")

    st.markdown("""
    Upload your bank statement PDFs to process transactions.
    
    **Security Requirements:**
    - Maximum file size: 10MB per file
    - Only PDF files are accepted
    - Files are validated before processing

    **Supported formats:**
    - Table-based PDF statements
    - Text-based PDF statements
    - Multi-page statements
    """)

    # File uploader with validation
    uploaded_files = st.file_uploader(
        "Choose PDF files",
        type=['pdf'],
        accept_multiple_files=True,
        help="Select one or more bank statement PDFs (max 10MB each)"
    )

    if uploaded_files:
        # Validate all files first
        valid_files = []
        invalid_files = []
        
        for f in uploaded_files:
            is_valid, error_msg = validate_pdf_file(f)
            if is_valid:
                valid_files.append(f)
            else:
                invalid_files.append((f, error_msg))
        
        # Show validation results
        if invalid_files:
            st.error("⚠️ Some files failed validation:")
            for filename, error in invalid_files:
                st.error(f"  - {filename.name}: {error}")
        
        if valid_files:
            st.success(f"✅ {len(valid_files)} file(s) passed validation")
            
            # Show file list with sizes
            for f in valid_files:
                size_kb = f.size / 1024
                st.write(f"📄 {f.name} ({size_kb:.1f} KB)")

            # Processing options
            st.markdown("---")
            st.subheader("Processing Options")

            use_llm = st.checkbox(
                "Use AI categorization (recommended)",
                value=True,
                help="Use local LLM to categorize transactions that don't match rules"
            )

            generate_report = st.checkbox(
                "Generate Excel report",
                value=True,
                help="Create comprehensive Excel report after processing"
            )

            # Process button
            if st.button("🚀 Process PDFs", type="primary"):
                process_uploaded_files(
                    valid_files,
                    use_llm=use_llm,
                    generate_report=generate_report
                )

    # Show recent uploads
    st.markdown("---")
    st.subheader("📁 Processed Files")

    source_files = st.session_state.ledger.get_source_files()

    if source_files:
        for f in source_files[-5:]:  # Last 5 files
            st.write(f"✅ {f}")
    else:
        st.info("No files processed yet")


def process_uploaded_files(uploaded_files, use_llm=True, generate_report=True):
    """
    Process uploaded PDF files with secure file handling.
    
    Args:
        uploaded_files: List of validated uploaded files
        use_llm: Whether to use LLM categorization
        generate_report: Whether to generate Excel report
    """
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    try:
        # Save uploaded files securely
        pdf_paths = []
        config = st.session_state.config
        
        for i, uploaded_file in enumerate(uploaded_files):
            status_text.text(f"Saving file {i+1}/{len(uploaded_files)}...")
            
            # Sanitize filename
            safe_filename = sanitize_filename(uploaded_file.name)
            
            # Use secure temporary directory within pdf_dir
            pdf_path = config.pdf_dir / safe_filename
            
            # Check for path traversal (shouldn't happen after sanitization)
            try:
                pdf_path.resolve().relative_to(config.pdf_dir.resolve())
            except ValueError:
                st.error(f"Invalid file path: {safe_filename}")
                continue
            
            # Write file
            with open(pdf_path, 'wb') as f:
                f.write(uploaded_file.getvalue())
            
            pdf_paths.append(str(pdf_path))
            progress_bar.progress((i + 1) / len(uploaded_files) * 0.3)

        if not pdf_paths:
            st.error("No files were saved successfully")
            return

        # Run pipeline
        status_text.text("Processing transactions...")

        pipeline = AIPipeline(
            config=config,
            use_llm=use_llm
        )

        stats = pipeline.run(
            pdf_paths=pdf_paths,
            generate_report=generate_report
        )

        progress_bar.progress(0.8)

        # Update session state
        st.session_state.ledger = Ledger(config)
        st.session_state.last_refresh = datetime.now()

        progress_bar.progress(1.0)
        status_text.text("Complete!")

        # Show results
        st.success(f"✅ Processed {stats.transactions_extracted} transactions!")

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Categorized (Rules)", stats.transactions_categorized_rules)
        with col2:
            st.metric("Categorized (AI)", stats.transactions_categorized_llm)
        with col3:
            st.metric("Report", "Generated" if stats.report_generated else "Skipped")

        if stats.report_generated:
            st.info(f"📊 Report saved to: `{stats.report_generated}`")

        pipeline.close()

    except Exception as e:
        st.error(f"Error processing files: {str(e)}")
        progress_bar.empty()
        status_text.empty()


def render_transactions():
    """Render the transactions page."""
    st.title("📋 Transactions")

    # Filters
    col1, col2, col3 = st.columns(3)

    with col1:
        category_filter = st.selectbox(
            "Category",
            ["All"] + st.session_state.config.valid_categories
        )

    with col2:
        limit = st.number_input("Limit", min_value=10, max_value=1000, value=100)

    with col3:
        if st.button("🔄 Refresh"):
            st.session_state.ledger = Ledger(st.session_state.config)
            st.rerun()

    # Get transactions
    if category_filter == "All":
        transactions = st.session_state.ledger.get_all_transactions(limit=limit)
    else:
        transactions = st.session_state.ledger.get_all_transactions(
            category=category_filter,
            limit=limit
        )

    if transactions:
        df = pd.DataFrame(transactions)

        # Format for display
        display_cols = ['id', 'date', 'description', 'category', 'amount', 'account']
        display_df = df[[c for c in display_cols if c in df.columns]].copy()

        # Format amount
        def format_amount(val):
            return f"${val:,.2f}"

        # Color code
        def color_category(val):
            if val == 'Needs Review':
                return 'background-color: #fff3cd'
            return ''

        st.dataframe(
            display_df.style
            .map(color_category, subset=['category'])
            .format({'amount': format_amount}),
            use_container_width=True,
            hide_index=True
        )

        # Summary stats
        st.markdown("---")
        col1, col2 = st.columns(2)

        with col1:
            total = df['amount'].sum()
            st.metric("Total", f"${total:,.2f}")

        with col2:
            expenses = df[df['amount'] < 0]['amount'].abs().sum()
            st.metric("Expenses", f"${expenses:,.2f}")

    else:
        st.info("No transactions found. Upload PDFs to get started.")


def render_reports():
    """Render the reports page."""
    st.title("📊 Reports")

    # Generate new report
    st.subheader("Generate New Report")

    col1, col2 = st.columns(2)

    with col1:
        include_recurring = st.checkbox("Recurring Payments", value=True)
        include_anomalies = st.checkbox("Anomalies", value=True)

    with col2:
        include_health = st.checkbox("Financial Health", value=True)

    if st.button("📄 Generate Excel Report"):
        try:
            generator = ExcelReportGenerator(
                st.session_state.config,
                st.session_state.ledger
            )

            report_config = ReportConfig(
                include_all_transactions=True,
                include_category_summary=True,
                include_monthly_summary=True,
                include_recurring_payments=include_recurring,
                include_large_transactions=True,
                include_anomalies=include_anomalies,
                include_financial_health=include_health
            )

            report_path = generator.generate_report(report_config=report_config)

            st.success(f"Report generated: `{report_path}`")

            # Download button
            with open(report_path, 'rb') as f:
                st.download_button(
                    label="📥 Download Report",
                    data=f.read(),
                    file_name=report_path.name,
                    mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )

        except Exception as e:
            st.error(f"Error generating report: {str(e)}")

    # Show existing reports
    st.markdown("---")
    st.subheader("Existing Reports")

    reports_dir = st.session_state.config.reports_dir
    if reports_dir.exists():
        reports = list(reports_dir.glob("*.xlsx"))

        if reports:
            for report in sorted(reports, reverse=True)[:10]:
                size_kb = report.stat().st_size / 1024
                st.write(f"📄 {report.name} ({size_kb:.1f} KB)")
        else:
            st.info("No reports generated yet")


def render_settings():
    """Render the settings page."""
    st.title("⚙️ Settings")

    # Configuration
    st.subheader("Configuration")

    config = st.session_state.config

    st.write(f"**Project Root:** `{config.project_root}`")
    st.write(f"**Database:** `{config.database_path}`")
    st.write(f"**LLM Endpoint:** `{config.llm_endpoint}`")
    st.write(f"**Batch Size:** `{config.llm_batch_size}`")

    # Ledger management
    st.markdown("---")
    st.subheader("Ledger Management")

    summary = get_ledger_summary()

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total Transactions", summary['total'])
    with col2:
        st.metric("Categorized", summary['categorized'])
    with col3:
        st.metric("Uncategorized", summary['uncategorized'])

    st.markdown("---")
    st.subheader("Danger Zone")

    if st.button("🗑️ Clear All Transactions", type="secondary"):
        st.warning("This will delete ALL transactions. This cannot be undone.")

        if st.checkbox("I understand, delete all transactions"):
            st.session_state.ledger.clear_all()
            st.session_state.ledger = Ledger(config)
            st.success("All transactions cleared!")
            st.rerun()

    # LLM Configuration
    st.markdown("---")
    st.subheader("LLM Configuration")

    st.write("""
    **To use AI categorization, ensure llama.cpp server is running:**

    ```bash
    cd llama.cpp
    ./server -m models/your-model.gguf -c 4096 --port 8080
    ```
    """)

    # Test connection
    import requests
    try:
        response = requests.get("http://localhost:8080", timeout=2)
        st.success("✅ LLM server is running")
    except:
        st.error("❌ LLM server is not running. AI categorization will be unavailable.")


def main():
    """Main application."""
    init_session_state()

    menu = render_sidebar()

    if menu == "Dashboard":
        render_dashboard()
    elif menu == "Upload PDFs":
        render_upload()
    elif menu == "Transactions":
        render_transactions()
    elif menu == "Reports":
        render_reports()
    elif menu == "Settings":
        render_settings()


if __name__ == "__main__":
    main()
