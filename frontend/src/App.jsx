import { useEffect, useMemo, useState } from "react";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function App() {
  const [email, setEmail] = useState("");
  const [file, setFile] = useState(null);
  const [comparisonFile, setComparisonFile] = useState(null);
  const [summaryStyle, setSummaryStyle] = useState("executive");
  const [explainInsights, setExplainInsights] = useState(true);
  const [styleOptions, setStyleOptions] = useState({});
  const [status, setStatus] = useState({
    type: "idle",
    message: "Upload one or two sales files to generate a detailed intelligence report."
  });
  const [report, setReport] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${apiBaseUrl}/summary-styles`)
      .then((response) => response.json())
      .then((payload) => setStyleOptions(payload))
      .catch(() => {
        setStyleOptions({
          executive: { label: "Executive brief" },
          strategic: { label: "Strategic insight" },
          marketing: { label: "Marketing insight" },
          operational: { label: "Operational report" }
        });
      });
  }, []);

  useEffect(() => {
    async function loadPreview() {
      if (!file) {
        setPreview(null);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      if (comparisonFile) {
        formData.append("comparisonFile", comparisonFile);
      }

      setPreviewLoading(true);
      try {
        const response = await fetch(`${apiBaseUrl}/preview`, {
          method: "POST",
          body: formData
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || "Preview failed");
        }

        setPreview(payload);
        setStatus({
          type: "idle",
          message: "Dataset preview is ready. Review the quality notes before generating the report."
        });
      } catch (error) {
        setPreview(null);
        setStatus({
          type: "error",
          message: error.message || "Could not preview the dataset."
        });
      } finally {
        setPreviewLoading(false);
      }
    }

    loadPreview();
  }, [file, comparisonFile]);

  const canSubmit = useMemo(
    () => Boolean(email.trim() && file && !submitting),
    [email, file, submitting]
  );

  async function handleSubmit(event) {
    event.preventDefault();

    if (!file) {
      setStatus({ type: "error", message: "Select a CSV or XLSX file." });
      return;
    }

    const formData = new FormData();
    formData.append("email", email.trim());
    formData.append("file", file);
    formData.append("summaryStyle", summaryStyle);
    formData.append("explainInsights", String(explainInsights));
    if (comparisonFile) {
      formData.append("comparisonFile", comparisonFile);
    }

    setSubmitting(true);
    setReport(null);
    setStatus({
      type: "loading",
      message: "Running analytics, generating the executive report, and sending the email."
    });

    try {
      const response = await fetch(`${apiBaseUrl}/upload`, {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Request failed");
      }

      setReport(payload.report || null);
      setStatus({
        type: "success",
        message: payload.message || "Detailed report sent successfully."
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Something went wrong."
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(event, kind) {
    const selectedFile = event.target.files?.[0] || null;

    if (!selectedFile) {
      if (kind === "primary") {
        setFile(null);
      } else {
        setComparisonFile(null);
      }
      return;
    }

    const isValidType =
      selectedFile.name.endsWith(".csv") || selectedFile.name.endsWith(".xlsx");

    if (!isValidType) {
      setStatus({
        type: "error",
        message: "Only .csv and .xlsx files are accepted."
      });
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setStatus({
        type: "error",
        message: "Each file must be 5MB or less."
      });
      return;
    }

    if (kind === "primary") {
      setFile(selectedFile);
    } else {
      setComparisonFile(selectedFile);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <p className="eyebrow">Sales Intelligence Generator</p>
        <h1>Go beyond summary and generate a sales report with signals, quality checks, and executive framing.</h1>
        <p className="lede">
          The backend now extracts trends, anomalies, dominance patterns, confidence, and cost estimates before the AI writes the narrative.
        </p>
      </section>

      <section className="form-panel">
        <form className="upload-form" onSubmit={handleSubmit}>
          <label>
            Recipient email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ops@example.com"
              required
            />
          </label>

          <div className="field-grid">
            <label>
              Primary sales file
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => handleFileChange(event, "primary")}
                required
              />
            </label>

            <label>
              Comparison file
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => handleFileChange(event, "comparison")}
              />
            </label>
          </div>

          <div className="field-grid">
            <label>
              Summary style
              <select
                value={summaryStyle}
                onChange={(event) => setSummaryStyle(event.target.value)}
              >
                {Object.entries(styleOptions).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="toggle-field">
              Explain insights
              <button
                type="button"
                className={`toggle-button ${explainInsights ? "toggle-on" : ""}`}
                onClick={() => setExplainInsights((current) => !current)}
              >
                {explainInsights ? "On" : "Off"}
              </button>
            </label>
          </div>

          <button type="submit" disabled={!canSubmit}>
            {submitting ? "Generating..." : "Generate Detailed Report"}
          </button>
        </form>

        <div className={`status-card status-${status.type}`}>
          <span className="status-label">
            {status.type === "loading" ? "Processing" : "Status"}
          </span>
          <p>{status.message}</p>
        </div>

        {previewLoading ? (
          <div className="preview-card">
            <h2>Dataset Preview</h2>
            <p>Scanning dataset structure and quality.</p>
          </div>
        ) : null}

        {preview ? (
          <section className="preview-card">
            <h2>Smart Dataset Preview</h2>
            <div className="metric-grid">
              <article>
                <span>Rows</span>
                <strong>{preview.preview.rows}</strong>
              </article>
              <article>
                <span>Columns Detected</span>
                <strong>{preview.preview.columnsDetected}</strong>
              </article>
              <article>
                <span>Revenue Column</span>
                <strong>{preview.preview.revenueColumnDetected ? "Detected" : "Missing"}</strong>
              </article>
              <article>
                <span>Time Range</span>
                <strong>{preview.preview.timeRange}</strong>
              </article>
            </div>

            <div className="stacked-card">
              <h3>Confidence</h3>
              <p>{preview.confidence.score}% confidence in dataset-driven insights.</p>
              {preview.confidence.reasons.map((reason) => (
                <p key={reason} className="subdued-line">
                  {reason}
                </p>
              ))}
            </div>

            <div className="stacked-card">
              <h3>Dataset Quality</h3>
              {preview.quality.warnings.length ? (
                <ul>
                  {preview.quality.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p>No material data quality warnings detected.</p>
              )}
            </div>

            {preview.comparisonPreview ? (
              <div className="stacked-card accent-card">
                <h3>Comparison Mode Ready</h3>
                <p>
                  Secondary dataset: {preview.comparisonPreview.fileName}
                </p>
                <p className="subdued-line">
                  {preview.comparisonPreview.rows} rows, time range {preview.comparisonPreview.timeRange}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {report ? (
          <article className="summary-card">
            <h2>Generated Report</h2>
            <div className="metric-grid">
              <article>
                <span>Style</span>
                <strong>{report.summaryStyle}</strong>
              </article>
              <article>
                <span>Confidence</span>
                <strong>{report.analysis.confidence.score}%</strong>
              </article>
              <article>
                <span>Total Revenue</span>
                <strong>{formatCurrency(report.analysis.metrics.totalRevenue)}</strong>
              </article>
              <article>
                <span>Estimated AI Cost</span>
                <strong>${report.analysis.tokenEstimate.estimatedCostUsd.toFixed(4)}</strong>
              </article>
            </div>

            <div className="stacked-card">
              <h3>Automated Insights</h3>
              <ul>
                <li>{report.analysis.metrics.revenueGrowth.detail}</li>
                <li>{report.analysis.metrics.regionDominance}</li>
                <li>{report.analysis.metrics.productTrend}</li>
                <li>{report.analysis.metrics.anomalyDetection.detail}</li>
              </ul>
            </div>

            <div className="stacked-card">
              <h3>Executive Narrative</h3>
              <pre>{report.summary}</pre>
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

export default App;
