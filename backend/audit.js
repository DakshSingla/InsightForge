import fs from "fs/promises";
import path from "path";

const auditFile = path.resolve(process.cwd(), "prompt-audit.log");

export async function writePromptAuditLog(entry) {
  const line = `${JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry
  })}\n`;

  await fs.appendFile(auditFile, line, "utf8");
}
