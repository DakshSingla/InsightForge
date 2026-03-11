import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import path from "path";
import swaggerUi from "swagger-ui-express";
import XLSX from "xlsx";
import { fileURLToPath } from "url";
import {
  analyzeDataset,
  compareDatasets,
  getSummaryStyles
} from "./analytics.js";
import { generateSalesSummary } from "./ai.js";
import { writePromptAuditLog } from "./audit.js";
import { sendSummaryEmail } from "./email.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const port = Number(process.env.PORT || 5000);
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((value) => value.trim());
const allowedMimeTypes = new Set([
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);
const allowedExtensions = new Set([".csv", ".xlsx"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    const extension = file.originalname
      .slice(file.originalname.lastIndexOf("."))
      .toLowerCase();
    const isAllowed =
      allowedMimeTypes.has(file.mimetype) || allowedExtensions.has(extension);

    if (!isAllowed) {
      callback(new Error("Only CSV and XLSX files are allowed"));
      return;
    }

    callback(null, true);
  }
});

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Sales Insight Automator API",
    version: "2.0.0",
    description:
      "Upload one or two sales files, generate a detailed AI report, and email it to the requested recipient."
  },
  servers: [{ url: "http://localhost:5000" }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: { 200: { description: "API is healthy" } }
      }
    },
    "/summary-styles": {
      get: {
        summary: "Available summary styles",
        responses: { 200: { description: "Summary style options" } }
      }
    },
    "/preview": {
      post: {
        summary: "Preview dataset analytics before generating the report",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary" },
                  comparisonFile: { type: "string", format: "binary" }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Dataset preview generated" } }
      }
    },
    "/upload": {
      post: {
        summary: "Upload sales data, generate report, and email it",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file", "email"],
                properties: {
                  file: { type: "string", format: "binary" },
                  comparisonFile: { type: "string", format: "binary" },
                  email: { type: "string", format: "email" },
                  summaryStyle: {
                    type: "string",
                    enum: ["executive", "strategic", "marketing", "operational"]
                  },
                  explainInsights: {
                    type: "string",
                    enum: ["true", "false"]
                  }
                }
              }
            }
          }
        },
        responses: { 200: { description: "Detailed report generated and emailed" } }
      }
    }
  }
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    }
  })
);
app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/summary-styles", (_req, res) => {
  res.json(getSummaryStyles());
});

app.post(
  "/preview",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "comparisonFile", maxCount: 1 }
  ]),
  (req, res, next) => {
    try {
      const primaryFile = req.files?.file?.[0];
      const comparisonFile = req.files?.comparisonFile?.[0];

      if (!primaryFile) {
        res.status(400).json({ message: "File is required" });
        return;
      }

      const primaryDataset = parseWorkbook(primaryFile.buffer);
      const primaryAnalysis = analyzeDataset({
        rows: primaryDataset.rows,
        headers: primaryDataset.headers,
        fileName: primaryFile.originalname
      });

      let comparisonPreview = null;
      if (comparisonFile) {
        const comparisonDataset = parseWorkbook(comparisonFile.buffer);
        comparisonPreview = analyzeDataset({
          rows: comparisonDataset.rows,
          headers: comparisonDataset.headers,
          fileName: comparisonFile.originalname
        }).preview;
      }

      res.json({
        preview: primaryAnalysis.preview,
        confidence: primaryAnalysis.confidence,
        quality: primaryAnalysis.quality,
        comparisonPreview
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "comparisonFile", maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      const email = req.body?.email?.trim();
      const summaryStyle = req.body?.summaryStyle || "executive";
      const explainInsights = req.body?.explainInsights === "true";
      const primaryFile = req.files?.file?.[0];
      const comparisonFile = req.files?.comparisonFile?.[0];

      if (!email) {
        res.status(400).json({ message: "Email is required" });
        return;
      }

      if (!primaryFile) {
        res.status(400).json({ message: "File is required" });
        return;
      }

      const primaryDataset = parseWorkbook(primaryFile.buffer);
      const analysis = analyzeDataset({
        rows: primaryDataset.rows,
        headers: primaryDataset.headers,
        fileName: primaryFile.originalname
      });

      if (!analysis.rowCount) {
        res.status(400).json({
          message: "Uploaded file does not contain usable rows"
        });
        return;
      }

      let comparisonAnalysis = null;
      let comparisonSummary = null;
      if (comparisonFile) {
        const comparisonDataset = parseWorkbook(comparisonFile.buffer);
        comparisonAnalysis = analyzeDataset({
          rows: comparisonDataset.rows,
          headers: comparisonDataset.headers,
          fileName: comparisonFile.originalname
        });
        comparisonSummary = compareDatasets(analysis, comparisonAnalysis);
      }

      const summary = await generateSalesSummary({
        fileName: primaryFile.originalname,
        analysis,
        comparisonAnalysis: comparisonSummary,
        summaryStyle,
        explainInsights
      });

      await writePromptAuditLog({
        fileName: primaryFile.originalname,
        summaryStyle,
        explainInsights,
        datasetSize: analysis.rowCount,
        comparisonFileName: comparisonFile?.originalname || null,
        promptModel: process.env.GEMINI_MODEL || "gemini-2.5-flash"
      });

      const report = {
        summary,
        summaryStyle: getSummaryStyles()[summaryStyle]?.label || summaryStyle,
        explainInsights,
        analysis,
        comparisonAnalysis: comparisonSummary
      };

      await sendSummaryEmail({
        recipient: email,
        report
      });

      res.json({
        message: "Detailed sales report sent successfully",
        summary,
        report
      });
    } catch (error) {
      next(error);
    }
  }
);

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ message: "File exceeds the 5MB limit" });
    return;
  }

  res.status(400).json({
    message: error.message || "Request failed"
  });
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, {
    defval: "",
    raw: false
  });
  const headers = rows.length ? Object.keys(rows[0]) : [];

  return {
    rowCount: rows.length,
    headers,
    rows
  };
}
