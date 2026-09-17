import { promises as fs } from "node:fs";
import path from "node:path";
import { diagnoseWorkspace } from "../../packages/persistence/diagnostics";
import {
  applyReconciliation,
  type ReconciliationPlan,
} from "../../packages/persistence/reconciliation";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const root = path.resolve(
  option("--data-dir") ??
    process.env.LOTION_DATA_DIR ??
    process.env.YESTION_DATA_DIR ??
    "data",
);
const applyFile = option("--apply");
const planFile = option("--write-plan");

if (applyFile) {
  const plan: ReconciliationPlan = JSON.parse(
    await fs.readFile(path.resolve(applyFile), "utf8"),
  );
  const result = await applyReconciliation(root, plan);
  console.log(`Reconciliation applied. Recovery metadata: ${result.backup}`);
  console.log(
    `Remaining issues: ${result.report.summary.blockers} blocker(s), ${result.report.summary.warnings} warning(s).`,
  );
  process.exitCode = result.report.summary.blockers ? 2 : 0;
} else {
  const report = await diagnoseWorkspace(root);
  if (process.argv.includes("--json"))
    console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Workspace: ${report.root}`);
    console.log(`Report token: ${report.token}`);
    console.log(
      `${report.summary.blockers} blocker(s), ${report.summary.warnings} warning(s), ${report.summary.validSnapshots} valid snapshot(s).`,
    );
    for (const issue of report.issues) {
      const target = issue.documentId
        ? ` ${issue.documentId}${issue.revision ? `@${issue.revision}` : ""}`
        : "";
      const candidates = issue.candidates?.length
        ? ` Candidates: ${issue.candidates.join(", ")}.`
        : "";
      console.log(
        `[${issue.severity}] ${issue.code}${target}: ${issue.message}${candidates}`,
      );
    }
  }
  if (planFile) {
    const template: ReconciliationPlan = {
      reportToken: report.token,
      actions: [],
    };
    await fs.writeFile(
      path.resolve(planFile),
      `${JSON.stringify(template, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    console.log(`Empty reviewed plan written to ${path.resolve(planFile)}.`);
  }
  process.exitCode = report.summary.blockers ? 2 : 0;
}
