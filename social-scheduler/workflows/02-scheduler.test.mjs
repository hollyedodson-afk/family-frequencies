import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflow = JSON.parse(readFileSync(join(__dirname, "02-scheduler.json"), "utf8"));

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

requireNode("Is Story Image?", "n8n-nodes-base.if");
const isManualPost = requireNode("Is Manual Post?", "n8n-nodes-base.if");
const telegramManualPost = requireNode("Telegram - Manual Post", "n8n-nodes-base.telegram");
requireNode("Mark manual_sent", "n8n-nodes-base.googleSheets");
const needsMusic = requireNode("Needs Music?", "n8n-nodes-base.if");
const createImageContainer = requireNode("Create Story Image Container", "n8n-nodes-base.httpRequest");
const publishImageStory = requireNode("Publish Story Image", "n8n-nodes-base.httpRequest");

assert.equal(
  isManualPost.parameters.conditions.conditions[0].leftValue,
  "={{ String($json.manual_post).toLowerCase() }}",
  "Is Manual Post? should handle boolean true as well as string TRUE",
);
assert.equal(isManualPost.parameters.conditions.conditions[0].rightValue, "true");
assert.match(
  telegramManualPost.parameters.text,
  /Manual post due/,
  "Manual Telegram should be clearly labelled",
);
assert.match(
  JSON.stringify(telegramManualPost.parameters.additionalFields),
  /manual_posted:/,
  "Manual Telegram should include a Posted callback button",
);

assert.equal(
  needsMusic.parameters.conditions.conditions[0].leftValue,
  "={{ String($json.needs_music).toLowerCase() }}",
  "Needs Music? should handle boolean false as well as string FALSE",
);
assert.equal(needsMusic.parameters.conditions.conditions[0].rightValue, "true");

assert.equal(
  createImageContainer.parameters.url,
  "={{ `https://graph.facebook.com/v21.0/${$env.FF_INSTAGRAM_ACCOUNT_ID}/media` }}",
);
assert.equal(
  createImageContainer.parameters.bodyParameters.parameters.find((param) => param.name === "image_url")
    ?.value,
  "={{ $json.media_url }}",
);
assert.equal(
  createImageContainer.parameters.bodyParameters.parameters.find((param) => param.name === "media_type")
    ?.value,
  "STORIES",
);
assert.equal(
  publishImageStory.parameters.url,
  "={{ `https://graph.facebook.com/v21.0/${$env.FF_INSTAGRAM_ACCOUNT_ID}/media_publish` }}",
);

assert.ok(connected("Is Story?", 0, "Is Story Image?"), "Story branch should route to image/video split");
assert.ok(connected("Has Caption?", 0, "Is Manual Post?"), "Caption-safe posts should check manual mode first");
assert.ok(connected("Is Manual Post?", 0, "Telegram - Manual Post"), "Manual posts should notify Telegram");
assert.ok(connected("Is Manual Post?", 1, "Needs Music?"), "Non-manual posts should continue to auto-post checks");
assert.ok(connected("Telegram - Manual Post", 0, "Mark manual_sent"), "Manual notifications should be recorded");
assert.ok(connected("Is Story Image?", 0, "Create Story Image Container"), "Image stories should use image_url");
assert.ok(connected("Is Story Image?", 1, "Post Story"), "Video stories should keep the existing video node");
assert.ok(connected("Create Story Image Container", 0, "Publish Story Image"));
assert.ok(connected("Publish Story Image", 0, "Mark Story Posted"));

console.log("WF02 story media routing is configured for PNG/JPG and MP4/MOV stories.");
