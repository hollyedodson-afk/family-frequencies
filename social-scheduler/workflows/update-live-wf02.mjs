import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");

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

const env = parseEnv(readFileSync(join(projectRoot, ".env"), "utf8"));
const baseUrl = (env.N8N_RAILWAY_URL || env.N8N_URL || "").replace(/\/$/, "");
const apiKey = env.N8N_RAILWAY_API || env.N8N_API;
const instagramAccountId = env.FF_INSTAGRAM_ACCOUNT_ID;
const instagramAppToken = env.FF_INSTAGRAM_APP_TOKEN;

if (!baseUrl || !apiKey) {
  throw new Error("Missing N8N_RAILWAY_URL/N8N_URL or N8N_RAILWAY_API/N8N_API in project .env");
}

if (!instagramAccountId || !instagramAppToken) {
  throw new Error("Missing FF_INSTAGRAM_ACCOUNT_ID or FF_INSTAGRAM_APP_TOKEN in project .env");
}

function workflowForLiveImport(workflow) {
  const liveWorkflow = JSON.parse(JSON.stringify(workflow));
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

const patchedWorkflow = JSON.parse(readFileSync(join(__dirname, "02-scheduler.json"), "utf8"));
const dryRun = globalThis.process?.argv?.includes("--dry-run") || false;
const liveImportWorkflow = workflowForLiveImport(patchedWorkflow);

const workflowsResponse = await request(baseUrl, apiKey, "/api/v1/workflows?limit=100");
const workflows = workflowsResponse.data || workflowsResponse;
const liveWorkflow = workflows.find((workflow) => workflow.name === patchedWorkflow.name);

if (!liveWorkflow) {
  throw new Error(`Could not find live workflow named "${patchedWorkflow.name}"`);
}

const current = await request(baseUrl, apiKey, `/api/v1/workflows/${liveWorkflow.id}`);
const payload = {
  name: current.name,
  nodes: liveImportWorkflow.nodes,
  connections: liveImportWorkflow.connections,
  settings: liveImportWorkflow.settings || current.settings || {},
  staticData: current.staticData || null,
};

console.log(`Target: ${baseUrl}`);
console.log(`Workflow: ${current.name} (${current.id})`);
console.log(`Active before update: ${current.active}`);
console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
console.log("Live image-story HTTP nodes will use literal Instagram values from .env, not $env expressions.");

if (dryRun) {
  console.log("Dry run complete. Re-run without --dry-run to update live WF02.");
  process.exit(0);
}

await request(baseUrl, apiKey, `/api/v1/workflows/${current.id}`, {
  method: "PUT",
  body: JSON.stringify(payload),
});

if (current.active) {
  await request(baseUrl, apiKey, `/api/v1/workflows/${current.id}/activate`, { method: "POST" });
}

console.log("Live WF02 updated. PNG/JPG/WebP stories now use image_url with literal Instagram values; MP4/MOV stories keep the video path.");
