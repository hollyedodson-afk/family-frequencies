import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflow = JSON.parse(readFileSync(join(__dirname, "08-telegram-reply.json"), "utf8"));

const nodeByName = new Map(workflow.nodes.map((node) => [node.name, node]));
const connections = workflow.connections;

function requireNode(name, type) {
  const node = nodeByName.get(name);
  assert.ok(node, `Expected workflow to include node "${name}"`);
  if (type) assert.equal(node.type, type, `"${name}" should be a ${type} node`);
  return node;
}

function connected(from, outputIndex, to) {
  return Boolean(
    connections[from]?.main?.[outputIndex]?.some((connection) => connection.node === to),
  );
}

const trigger = requireNode("Telegram Trigger", "n8n-nodes-base.telegramTrigger");
const isCallback = requireNode("Is Callback?", "n8n-nodes-base.if");
const extractCallback = requireNode("Extract Callback", "n8n-nodes-base.set");
const isManualPosted = requireNode("Is Manual Posted?", "n8n-nodes-base.if");
const markManualPosted = requireNode("Mark Manual Posted", "n8n-nodes-base.googleSheets");
requireNode("Confirm Manual Posted", "n8n-nodes-base.telegram");

assert.ok(trigger.parameters.updates.includes("message"), "Existing text replies should still be received");
assert.ok(trigger.parameters.updates.includes("callback_query"), "Telegram buttons should be received");

assert.equal(
  isCallback.parameters.conditions.conditions[0].leftValue,
  "={{ $json.callback_query ? 'yes' : 'no' }}",
);
assert.equal(
  extractCallback.parameters.assignments.assignments.find((assignment) => assignment.name === "row_id")?.value,
  "={{ $json.callback_query.data.split(':')[1] }}",
);
assert.equal(
  isManualPosted.parameters.conditions.conditions[0].leftValue,
  "={{ $json.callback_data.startsWith('manual_posted:') }}",
);
assert.equal(
  markManualPosted.parameters.columns.value.id,
  "={{ $json.row_id }}",
);
assert.equal(markManualPosted.parameters.columns.value.status, "posted");
assert.equal(markManualPosted.parameters.columns.matchingColumns[0], "id");

assert.ok(connected("Telegram Trigger", 0, "Is Callback?"));
assert.ok(connected("Is Callback?", 0, "Extract Callback"));
assert.ok(connected("Is Callback?", 1, "Is Reply?"));
assert.ok(connected("Extract Callback", 0, "Is Manual Posted?"));
assert.ok(connected("Is Manual Posted?", 0, "Mark Manual Posted"));
assert.ok(connected("Mark Manual Posted", 0, "Confirm Manual Posted"));

console.log("WF08 handles manual-post Telegram Posted buttons.");
