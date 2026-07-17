import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");

const WORKFLOW_FILES = [
  "01-submit-post.json",
  "02-scheduler.json",
  "06-update-post.json",
  "08-telegram-reply.json",
];

function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, "");
  }
  return env;
}

async function request(baseUrl, apiKey, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "X-N8N-API-KEY": apiKey,
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body).slice(0, 800)}`);
  }
  return body;
}

function workflowForLiveImport(workflow, env) {
  const liveWorkflow = JSON.parse(JSON.stringify(workflow));
  if (workflow.name !== "FF Social - 02 Scheduler") return liveWorkflow;

  const instagramAccountId = env.FF_INSTAGRAM_ACCOUNT_ID;
  const instagramAppToken = env.FF_INSTAGRAM_APP_TOKEN;
  if (!instagramAccountId || !instagramAppToken) {
    throw new Error("Missing FF_INSTAGRAM_ACCOUNT_ID or FF_INSTAGRAM_APP_TOKEN in project .env");
  }

  for (const node of liveWorkflow.nodes) {
    if (node.name === "Create Story Image Container") {
      node.parameters.url = `https://graph.facebook.com/v21.0/${instagramAccountId}/media`;
      const tokenParam = node.parameters.bodyParameters.parameters.find(
        (parameter) => parameter.name === "access_token",
      );
      if (tokenParam) tokenParam.value = instagramAppToken;
    }
    if (node.name === "Publish Story Image") {
      node.parameters.url = `https://graph.facebook.com/v21.0/${instagramAccountId}/media_publish`;
      const tokenParam = node.parameters.bodyParameters.parameters.find(
        (parameter) => parameter.name === "access_token",
      );
      if (tokenParam) tokenParam.value = instagramAppToken;
    }
  }
  return liveWorkflow;
}

async function updateWorkflow({ baseUrl, apiKey, env, workflow, dryRun }) {
  const workflowsResponse = await request(baseUrl, apiKey, "/api/v1/workflows?limit=100");
  const workflows = workflowsResponse.data || workflowsResponse;
  const liveWorkflowSummary = workflows.find((item) => item.name === workflow.name);
  if (!liveWorkflowSummary) throw new Error(`Could not find live workflow named "${workflow.name}"`);

  const current = await request(baseUrl, apiKey, `/api/v1/workflows/${liveWorkflowSummary.id}`);
  const liveImportWorkflow = workflowForLiveImport(workflow, env);
  const payload = {
    name: current.name,
    nodes: liveImportWorkflow.nodes,
    connections: liveImportWorkflow.connections,
    settings: liveImportWorkflow.settings || current.settings || {},
    staticData: current.staticData || null,
  };

  console.log(`Workflow: ${current.name} (${current.id})`);
  console.log(`Active before update: ${current.active}`);
  if (dryRun) return;

  await request(baseUrl, apiKey, `/api/v1/workflows/${current.id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  if (current.active) {
    await request(baseUrl, apiKey, `/api/v1/workflows/${current.id}/activate`, { method: "POST" });
  }
  console.log("Updated.");
}

async function main() {
  const env = parseEnv(readFileSync(join(projectRoot, ".env"), "utf8"));
  const baseUrl = (env.N8N_RAILWAY_URL || env.N8N_URL || "").replace(/\/$/, "");
  const apiKey = env.N8N_RAILWAY_API || env.N8N_API;
  const dryRun = globalThis.process?.argv?.includes("--dry-run") || false;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing N8N_RAILWAY_URL/N8N_URL or N8N_RAILWAY_API/N8N_API in project .env");
  }

  console.log(`Target: ${baseUrl}`);
  console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
  console.log("Updating manual-post scheduler workflows.");

  for (const file of WORKFLOW_FILES) {
    const workflow = JSON.parse(readFileSync(join(__dirname, file), "utf8"));
    await updateWorkflow({ baseUrl, apiKey, env, workflow, dryRun });
  }

  console.log(
    dryRun
      ? "Dry run complete. Re-run without --dry-run to update live workflows."
      : "Manual post workflow update complete.",
  );
}

const isDirectRun =
  globalThis.process?.argv?.[1] &&
  import.meta.url === pathToFileURL(globalThis.process.argv[1]).href;

if (isDirectRun) {
  await main();
}
