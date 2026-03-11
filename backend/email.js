import nodemailer from "nodemailer";

export async function sendSummaryEmail({ recipient, report }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    subject: "Sales Insight Summary",
    text: buildPlainTextReport(report),
    html: buildSummaryEmail(report)
  });
}

function buildSummaryEmail(report) {
  const {
    summary,
    analysis,
    comparisonAnalysis,
    summaryStyle,
    explainInsights
  } = report;

  return `
    <html>
      <body style="margin:0;padding:0;background:#f5efe5;font-family:'Trebuchet MS',Arial,sans-serif;color:#1f2937;">
        <div style="padding:32px 16px;background:linear-gradient(135deg,#fff6ea 0%,#e9f5f2 45%,#e7edf9 100%);">
          <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.14);">
            <div style="padding:34px;background:linear-gradient(135deg,#0f766e 0%,#1d4ed8 100%);color:#ffffff;">
              <p style="margin:0 0 10px;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.84;">Sales Intelligence Report</p>
              <h1 style="margin:0;font-size:32px;line-height:1.08;">${escapeHtml(summary.split("\n")[0] || "Sales Summary")}</h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.7;max-width:50ch;opacity:0.94;">
                Detailed narrative, KPI extraction, confidence scoring, and dataset quality checks generated from your uploaded sales data.
              </p>
            </div>

            <div style="padding:28px;">
              <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:24px;">
                ${renderStatCard("Report Style", summaryStyle)}
                ${renderStatCard("Confidence", `${analysis.confidence.score}%`)}
                ${renderStatCard("Total Revenue", formatCurrency(analysis.metrics.totalRevenue))}
                ${renderStatCard("Estimated AI Cost", `$${analysis.tokenEstimate.estimatedCostUsd.toFixed(4)}`)}
              </div>

              <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:16px;margin-bottom:24px;">
                <div style="padding:20px;border-radius:20px;background:#f8fbff;border:1px solid #dbeafe;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8;">Executive Narrative</p>
                  <div style="white-space:pre-wrap;line-height:1.8;color:#334155;">${escapeHtml(summary)}</div>
                </div>
                <div style="padding:20px;border-radius:20px;background:#f9fafb;border:1px solid #e5e7eb;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0f766e;">Dataset Snapshot</p>
                  <div style="display:grid;gap:10px;font-size:14px;color:#334155;">
                    <div><strong>Rows:</strong> ${analysis.rowCount}</div>
                    <div><strong>Columns:</strong> ${analysis.columnCount}</div>
                    <div><strong>Time Range:</strong> ${escapeHtml(analysis.preview.timeRange)}</div>
                    <div><strong>Top Region:</strong> ${escapeHtml(analysis.metrics.topRegion?.name || "Not detected")}</div>
                    <div><strong>Top Category:</strong> ${escapeHtml(analysis.metrics.topCategory?.name || "Not detected")}</div>
                    <div><strong>Explain Mode:</strong> ${explainInsights ? "Enabled" : "Disabled"}</div>
                  </div>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:24px;">
                ${renderChartCard("Revenue by Region", analysis.charts.regionRevenue)}
                ${renderChartCard("Revenue by Category", analysis.charts.categoryRevenue)}
              </div>

              <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:24px;">
                <div style="padding:20px;border-radius:20px;background:#fff8ef;border:1px solid #f3d7a3;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#b45309;">Automated Insights</p>
                  <ul style="margin:0;padding-left:20px;color:#334155;line-height:1.8;">
                    <li>${escapeHtml(analysis.metrics.revenueGrowth.detail)}</li>
                    <li>${escapeHtml(analysis.metrics.regionDominance)}</li>
                    <li>${escapeHtml(analysis.metrics.productTrend)}</li>
                    <li>${escapeHtml(analysis.metrics.anomalyDetection.detail)}</li>
                  </ul>
                </div>
                <div style="padding:20px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;">
                  <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0f766e;">Dataset Quality</p>
                  <ul style="margin:0;padding-left:20px;color:#334155;line-height:1.8;">
                    ${renderWarnings(analysis.quality.warnings)}
                  </ul>
                </div>
              </div>

              <div style="padding:20px;border-radius:20px;background:#f6fdf9;border:1px solid #ccebdc;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#047857;">Confidence Notes</p>
                <ul style="margin:0;padding-left:20px;color:#334155;line-height:1.8;">
                  ${analysis.confidence.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
                </ul>
                ${
                  comparisonAnalysis
                    ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid #d1fae5;color:#334155;line-height:1.7;">
                        <strong>Comparison Mode:</strong> ${escapeHtml(comparisonAnalysis.comparisonLabel)}<br />
                        <strong>Revenue Delta:</strong> ${formatSignedCurrency(comparisonAnalysis.revenueDelta)}<br />
                        <strong>Revenue Growth:</strong> ${comparisonAnalysis.revenueGrowthPct === null ? "Not available" : `${comparisonAnalysis.revenueGrowthPct.toFixed(1)}%`}<br />
                        <strong>Top Region Shift:</strong> ${escapeHtml(comparisonAnalysis.topRegionShift || "Not detected")}<br />
                        <strong>Top Category Shift:</strong> ${escapeHtml(comparisonAnalysis.topCategoryShift || "Not detected")}
                      </div>`
                    : ""
                }
              </div>
            </div>

            <div style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;">
              Sent automatically by Sales Insight Automator.
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildPlainTextReport(report) {
  const { summary, analysis, comparisonAnalysis, summaryStyle } = report;

  return [
    "Sales Intelligence Report",
    `Style: ${summaryStyle}`,
    `Confidence: ${analysis.confidence.score}%`,
    `Total Revenue: ${formatCurrency(analysis.metrics.totalRevenue)}`,
    `Top Region: ${analysis.metrics.topRegion?.name || "Not detected"}`,
    `Top Category: ${analysis.metrics.topCategory?.name || "Not detected"}`,
    `Warnings: ${
      analysis.quality.warnings.length
        ? analysis.quality.warnings.join(" | ")
        : "No material warnings"
    }`,
    `Estimated AI Cost: $${analysis.tokenEstimate.estimatedCostUsd.toFixed(4)}`,
    comparisonAnalysis
      ? `Comparison Revenue Delta: ${formatSignedCurrency(comparisonAnalysis.revenueDelta)}`
      : null,
    "",
    summary
  ]
    .filter(Boolean)
    .join("\n");
}

function renderStatCard(label, value) {
  return `<div style="padding:18px 20px;border-radius:18px;background:#ffffff;border:1px solid #d9e6f2;box-shadow:0 10px 22px rgba(15,23,42,0.06);">
    <div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0f766e;margin-bottom:8px;">${escapeHtml(label)}</div>
    <div style="font-size:22px;font-weight:700;color:#111827;">${escapeHtml(value)}</div>
  </div>`;
}

function renderChartCard(title, series) {
  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const content = series.length
    ? series
        .map(
          (item) => `<div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;color:#334155;margin-bottom:5px;">
                <span>${escapeHtml(item.name)}</span>
                <strong>${formatCurrency(item.value)}</strong>
              </div>
              <div style="height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden;">
                <div style="height:100%;width:${Math.max((item.value / maxValue) * 100, 6)}%;background:linear-gradient(135deg,#0f766e,#1d4ed8);"></div>
              </div>
            </div>`
        )
        .join("")
    : `<p style="margin:0;color:#64748b;">Insufficient data for this chart.</p>`;

  return `<div style="padding:20px;border-radius:20px;background:#ffffff;border:1px solid #e2e8f0;">
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#0f766e;">${escapeHtml(title)}</p>
    ${content}
  </div>`;
}

function renderWarnings(warnings) {
  if (!warnings.length) {
    return "<li>No material data quality warnings detected.</li>";
  }

  return warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatSignedCurrency(value) {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(value || 0))}`;
}
