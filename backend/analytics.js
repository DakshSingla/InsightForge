const SUMMARY_STYLES = {
  executive: {
    label: "Executive brief",
    instruction:
      "Prioritise headline business performance, major risks, and immediate decisions for leadership."
  },
  strategic: {
    label: "Strategic insight",
    instruction:
      "Emphasise long-term direction, market opportunities, and strategic implications."
  },
  marketing: {
    label: "Marketing insight",
    instruction:
      "Focus on customer demand patterns, product popularity, and campaign or positioning implications."
  },
  operational: {
    label: "Operational report",
    instruction:
      "Focus on execution quality, process bottlenecks, anomalies, and actions for operations teams."
  }
};

export function getSummaryStyles() {
  return SUMMARY_STYLES;
}

export function analyzeDataset({ rows, headers, fileName }) {
  const schema = detectSchema(headers);
  const normalizedRows = rows.map((row, index) =>
    normaliseRow(row, schema, index + 2)
  );
  const nonEmptyRows = normalizedRows.filter(
    (row) => Object.values(row.raw).some((value) => String(value).trim() !== "")
  );
  const quality = assessQuality(nonEmptyRows, schema);
  const metrics = computeMetrics(nonEmptyRows);
  const preview = buildPreview(nonEmptyRows, schema, fileName);
  const confidence = computeConfidence({
    rowCount: nonEmptyRows.length,
    quality,
    schema
  });
  const tokenEstimate = estimateTokenCost({
    rowCount: nonEmptyRows.length,
    columnCount: headers.length
  });
  const charts = buildCharts(metrics);

  return {
    fileName,
    rowCount: nonEmptyRows.length,
    columnCount: headers.length,
    headers,
    schema,
    preview,
    metrics,
    quality,
    confidence,
    tokenEstimate,
    charts,
    sampleRows: nonEmptyRows.slice(0, 8).map((row) => row.raw)
  };
}

export function compareDatasets(primary, comparison) {
  const primaryRevenue = primary.metrics.totalRevenue || 0;
  const comparisonRevenue = comparison.metrics.totalRevenue || 0;
  const revenueDelta = primaryRevenue - comparisonRevenue;
  const revenueGrowthPct =
    comparisonRevenue > 0 ? (revenueDelta / comparisonRevenue) * 100 : null;

  return {
    comparisonLabel: `${comparison.fileName} -> ${primary.fileName}`,
    revenueDelta,
    revenueGrowthPct,
    topRegionShift:
      primary.metrics.topRegion?.name && comparison.metrics.topRegion?.name
        ? `${comparison.metrics.topRegion.name} -> ${primary.metrics.topRegion.name}`
        : null,
    topCategoryShift:
      primary.metrics.topCategory?.name && comparison.metrics.topCategory?.name
        ? `${comparison.metrics.topCategory.name} -> ${primary.metrics.topCategory.name}`
        : null,
    rowDelta: primary.rowCount - comparison.rowCount
  };
}

function detectSchema(headers) {
  const match = (patterns) =>
    headers.find((header) =>
      patterns.some((pattern) => pattern.test(String(header)))
    ) || null;

  return {
    revenue: match([/revenue/i, /sales/i, /amount/i, /total/i]),
    region: match([/region/i, /territory/i, /area/i]),
    category: match([/category/i, /product/i, /segment/i]),
    status: match([/status/i, /order status/i]),
    quantity: match([/quantity/i, /units?/i, /volume/i]),
    date: match([/date/i, /month/i, /period/i, /quarter/i]),
    customer: match([/customer/i, /account/i, /client/i]),
    orderId: match([/order.?id/i, /invoice/i, /transaction/i])
  };
}

function normaliseRow(raw, schema, rowNumber) {
  return {
    rowNumber,
    raw,
    revenue: schema.revenue ? normaliseNumber(raw[schema.revenue]) : null,
    region: schema.region ? cleanValue(raw[schema.region]) : null,
    category: schema.category ? cleanValue(raw[schema.category]) : null,
    status: schema.status ? cleanValue(raw[schema.status]) : null,
    quantity: schema.quantity ? normaliseNumber(raw[schema.quantity]) : null,
    date: schema.date ? normaliseDate(raw[schema.date]) : null,
    customer: schema.customer ? cleanValue(raw[schema.customer]) : null,
    orderId: schema.orderId ? cleanValue(raw[schema.orderId]) : null
  };
}

function assessQuality(rows, schema) {
  const missingColumns = Object.entries(schema)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
  const duplicateTracker = new Set();
  let duplicateRows = 0;
  let missingRevenueRows = 0;
  let invalidRevenueRows = 0;
  let emptyCells = 0;
  let cancelledOrders = 0;

  for (const row of rows) {
    const signature = JSON.stringify(row.raw);
    if (duplicateTracker.has(signature)) {
      duplicateRows += 1;
    } else {
      duplicateTracker.add(signature);
    }

    const values = Object.values(row.raw);
    emptyCells += values.filter((value) => String(value).trim() === "").length;

    if (schema.revenue) {
      const rawValue = row.raw[schema.revenue];
      if (String(rawValue).trim() === "") {
        missingRevenueRows += 1;
      } else if (!Number.isFinite(row.revenue)) {
        invalidRevenueRows += 1;
      }
    }

    if (schema.status && /cancel/i.test(row.status || "")) {
      cancelledOrders += 1;
    }
  }

  const warnings = [];
  if (!schema.revenue) {
    warnings.push("Revenue column was not detected. Revenue-based insights are limited.");
  }
  if (missingRevenueRows > 0) {
    warnings.push(`${missingRevenueRows} rows are missing revenue values.`);
  }
  if (invalidRevenueRows > 0) {
    warnings.push(`${invalidRevenueRows} rows contain non-numeric revenue values.`);
  }
  if (duplicateRows > 0) {
    warnings.push(`${duplicateRows} duplicate rows were detected.`);
  }
  if (emptyCells > 0) {
    warnings.push(`${emptyCells} empty cells were detected across the dataset.`);
  }

  return {
    missingColumns,
    duplicateRows,
    emptyCells,
    missingRevenueRows,
    invalidRevenueRows,
    cancelledOrders,
    warnings
  };
}

function computeMetrics(rows) {
  const totalRevenue = rows.reduce(
    (sum, row) => sum + (Number.isFinite(row.revenue) ? row.revenue : 0),
    0
  );
  const totalQuantity = rows.reduce(
    (sum, row) => sum + (Number.isFinite(row.quantity) ? row.quantity : 0),
    0
  );
  const regionMap = aggregateBy(rows, "region");
  const categoryMap = aggregateBy(rows, "category");
  const monthlyRevenue = aggregateByMonth(rows);
  const revenueSeries = [...monthlyRevenue.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const revenueGrowth = calculateGrowth(revenueSeries);
  const topRegion = topEntry(regionMap);
  const topCategory = topEntry(categoryMap);
  const anomalies = detectAnomalies(rows);

  return {
    totalRevenue,
    totalQuantity,
    averageOrderValue: rows.length ? totalRevenue / rows.length : 0,
    topRegion,
    topCategory,
    regionBreakdown: toSortedArray(regionMap),
    categoryBreakdown: toSortedArray(categoryMap),
    monthlyRevenue: revenueSeries.map(([label, value]) => ({ label, value })),
    revenueGrowth,
    productTrend:
      revenueGrowth && revenueGrowth.direction === "positive"
        ? "Demand is strengthening in the most recent periods."
        : revenueGrowth && revenueGrowth.direction === "negative"
          ? "Demand softened in the most recent periods."
          : "Trend is stable or insufficient data is available.",
    anomalyDetection: anomalies,
    regionDominance: topRegion
      ? `${topRegion.name} contributes ${topRegion.share.toFixed(1)}% of detected revenue.`
      : "Region dominance could not be inferred."
  };
}

function buildPreview(rows, schema, fileName) {
  const dates = rows
    .map((row) => row.date)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return {
    fileName,
    rows: rows.length,
    columnsDetected: Object.values(schema).filter(Boolean).length,
    revenueColumnDetected: Boolean(schema.revenue),
    timeRange:
      dates.length > 1 ? `${dates[0]} to ${dates[dates.length - 1]}` : dates[0] || "Not detected"
  };
}

function computeConfidence({ rowCount, quality, schema }) {
  let score = 100;
  score -= Math.min(quality.emptyCells * 0.3, 18);
  score -= Math.min(quality.duplicateRows * 3, 15);
  score -= Math.min(quality.missingRevenueRows * 4, 20);
  score -= Math.min(quality.invalidRevenueRows * 4, 15);
  score -= quality.missingColumns.length * 4;

  if (rowCount < 5) {
    score -= 12;
  } else if (rowCount < 15) {
    score -= 6;
  }

  if (!schema.region || !schema.category || !schema.date) {
    score -= 4;
  }

  const clamped = Math.max(35, Math.min(99, Math.round(score)));
  const reasons = [];
  if (quality.warnings.length) {
    reasons.push(...quality.warnings.slice(0, 2));
  }
  if (rowCount < 5) {
    reasons.push("Very small dataset size reduces confidence in trend detection.");
  }
  if (!reasons.length) {
    reasons.push("Core revenue fields are present and dataset quality appears consistent.");
  }

  return {
    score: clamped,
    reasons
  };
}

function estimateTokenCost({ rowCount, columnCount }) {
  const estimatedPromptTokens = 450 + rowCount * 18 + columnCount * 12;
  const estimatedOutputTokens = 320;
  const estimatedCostUsd =
    (estimatedPromptTokens / 1_000_000) * 0.3 +
    (estimatedOutputTokens / 1_000_000) * 2.5;

  return {
    estimatedPromptTokens,
    estimatedOutputTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4))
  };
}

function buildCharts(metrics) {
  return {
    regionRevenue: metrics.regionBreakdown.slice(0, 5),
    categoryRevenue: metrics.categoryBreakdown.slice(0, 5)
  };
}

function aggregateBy(rows, key) {
  const map = new Map();

  for (const row of rows) {
    const label = row[key] || "Unknown";
    const current = map.get(label) || 0;
    map.set(label, current + (Number.isFinite(row.revenue) ? row.revenue : 0));
  }

  return map;
}

function aggregateByMonth(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row.date) {
      continue;
    }

    const monthKey = row.date.slice(0, 7);
    const current = map.get(monthKey) || 0;
    map.set(monthKey, current + (Number.isFinite(row.revenue) ? row.revenue : 0));
  }

  return map;
}

function calculateGrowth(series) {
  if (series.length < 2) {
    return {
      direction: "stable",
      percentage: null,
      detail: "Not enough dated records to determine a growth trend."
    };
  }

  const previous = series[series.length - 2][1];
  const current = series[series.length - 1][1];
  const percentage = previous > 0 ? ((current - previous) / previous) * 100 : null;
  const direction =
    percentage === null
      ? "stable"
      : percentage > 2
        ? "positive"
        : percentage < -2
          ? "negative"
          : "stable";

  return {
    direction,
    percentage: percentage === null ? null : Number(percentage.toFixed(1)),
    detail:
      percentage === null
        ? "Previous period revenue was zero, so growth rate could not be computed."
        : `${series[series.length - 2][0]} to ${series[series.length - 1][0]} revenue changed by ${percentage.toFixed(1)}%.`
  };
}

function detectAnomalies(rows) {
  const revenueValues = rows
    .map((row) => row.revenue)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!revenueValues.length) {
    return {
      count: 0,
      detail: "No positive revenue values were available for anomaly detection."
    };
  }

  const average =
    revenueValues.reduce((sum, value) => sum + value, 0) / revenueValues.length;
  const threshold = average * 1.8;
  const anomalyRows = rows.filter(
    (row) => Number.isFinite(row.revenue) && row.revenue > threshold
  );

  return {
    count: anomalyRows.length,
    detail:
      anomalyRows.length > 0
        ? `${anomalyRows.length} high-value rows exceed the anomaly threshold of ${formatCurrency(threshold)}.`
        : "No revenue anomalies exceeded the detection threshold."
  };
}

function topEntry(map) {
  const sorted = toSortedArray(map);
  const top = sorted[0];
  const total = sorted.reduce((sum, entry) => sum + entry.value, 0);

  return top
    ? {
        ...top,
        share: total > 0 ? (top.value / total) * 100 : 0
      }
    : null;
}

function toSortedArray(map) {
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((left, right) => right.value - left.value);
}

function cleanValue(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normaliseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normaliseDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}
