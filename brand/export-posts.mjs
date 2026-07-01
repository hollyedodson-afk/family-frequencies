import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_FILE = resolve(__dirname, 'daylight-disco-posts.html');
const EXPORT_DIR = resolve(__dirname, 'export');

mkdirSync(`${EXPORT_DIR}/feed`, { recursive: true });
mkdirSync(`${EXPORT_DIR}/stories`, { recursive: true });
mkdirSync(`${EXPORT_DIR}/video-frames`, { recursive: true });

// Feed posts: 360×450 at 3× = 1080×1350
const FEED_POSTS = [
  { selector: 'text="01 · Poster announcement"', label: '04-announcement', fallback: null },
  { selector: null, label: '04-announcement' },
];

// We'll find posts by their label text and screenshot the sibling card
const FEED_LABELS = [
  { label: '04-announcement',    text: '04 · Announcement' },
  { label: '05-what-to-expect',  text: '05 · What to expect' },
  { label: '06-reminder',        text: '06 · Reminder · This Saturday' },
  { label: '07-good-to-know',    text: '07 · Good to know' },
  { label: '08-meet-djs',        text: '08 · Meet the DJs' },
  { label: '09-thats-a-wrap',    text: "09 · That's a wrap · Post-event" },
  { label: '10-tag-a-parent',    text: '10 · Tag a parent · Engagement' },
];

const STORY_LABELS = [
  { label: 'S2-announcement',    text: 'Announcement' },
  { label: 'S3-reminder',        text: 'Reminder · Day before' },
  { label: 'S4-countdown-tmpl',  text: 'Countdown · swap the number' },
  { label: 'S5-tag-parent',      text: 'Engagement · share & tag' },
  { label: 'S-event-day',        text: 'Event day · Doors open' },
  { label: 'S-cd-5',             text: '5 sleeps to go · Countdown' },
  { label: 'S-cd-4',             text: '4 sleeps to go · Countdown' },
  { label: 'S-cd-3',             text: '3 sleeps to go · Countdown' },
  { label: 'S-cd-2',             text: '2 sleeps to go · Countdown' },
  { label: 'S-cd-tomorrow',       text: 'Tomorrow · Night before' },
];

// All posts with animations — feed (360×450 @ 3×) and stories (216×384 @ 5×)
const ANIMATED_POSTS = [
  { label: '04-announcement',   selector_hint: '04 · Announcement',               isStory: false },
  { label: '06-reminder',       selector_hint: '06 · Reminder · This Saturday',    isStory: false },
  { label: 'S2-announcement',   selector_hint: 'Announcement',                     isStory: true  },
  { label: 'S3-reminder',       selector_hint: 'Reminder · Day before',            isStory: true  },
  { label: 'S4-countdown-tmpl', selector_hint: 'Countdown · swap the number',      isStory: true  },
  { label: 'S-cd-5',            selector_hint: '5 sleeps to go · Countdown',       isStory: true  },
  { label: 'S-cd-4',            selector_hint: '4 sleeps to go · Countdown',       isStory: true  },
  { label: 'S-cd-3',            selector_hint: '3 sleeps to go · Countdown',       isStory: true  },
  { label: 'S-cd-2',            selector_hint: '2 sleeps to go · Countdown',       isStory: true  },
  { label: 'S-cd-tomorrow',      selector_hint: 'Tomorrow · Night before',           isStory: true  },
  { label: 'S-event-day',       selector_hint: 'Event day · Doors open',           isStory: true  },
];

async function exportPost(page, labelText, outputPath, cardW, cardH, scaleFactor) {
  // Find the label element, then get the next sibling card div
  const cardHandle = await page.evaluateHandle((txt) => {
    const els = [...document.querySelectorAll('p')];
    const label = els.find(el => el.textContent.trim() === txt);
    if (!label) return null;
    // The card is the next sibling div
    let sib = label.nextElementSibling;
    while (sib && sib.tagName !== 'DIV') sib = sib.nextElementSibling;
    return sib;
  }, labelText);

  if (!cardHandle || !(await cardHandle.evaluate(el => el !== null))) {
    console.warn(`  ⚠ Could not find card for: "${labelText}"`);
    return false;
  }

  const box = await cardHandle.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });

  const screenshot = await page.screenshot({
    clip: {
      x: box.x,
      y: box.y,
      width: cardW,
      height: cardH,
    },
    scale: 'device', // use deviceScaleFactor
  });

  writeFileSync(outputPath, screenshot);
  return true;
}

async function captureFrames(page, labelText, outDir, cardW, cardH, fps = 30, duration = 3) {
  const cardHandle = await page.evaluateHandle((txt) => {
    const els = [...document.querySelectorAll('p')];
    const label = els.find(el => el.textContent.trim() === txt);
    if (!label) return null;
    let sib = label.nextElementSibling;
    while (sib && sib.tagName !== 'DIV') sib = sib.nextElementSibling;
    return sib;
  }, labelText);

  if (!cardHandle || !(await cardHandle.evaluate(el => el !== null))) {
    console.warn(`  ⚠ Could not find card for: "${labelText}"`);
    return 0;
  }

  const box = await cardHandle.evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });

  const totalFrames = fps * duration;
  const frameInterval = 1000 / fps;

  mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < totalFrames; i++) {
    await page.waitForTimeout(frameInterval);
    const frame = await page.screenshot({
      clip: { x: box.x, y: box.y, width: cardW, height: cardH },
      scale: 'device',
    });
    const padded = String(i).padStart(4, '0');
    writeFileSync(`${outDir}/frame-${padded}.png`, frame);
  }
  return totalFrames;
}

// ─── FEED POSTS at 3× (1080×1350) ───────────────────────────────────────────
console.log('\n📸 Exporting feed posts at 3× (1080×1350)...');
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 5000, height: 4000 },
    deviceScaleFactor: 3,
  });
  const page = await ctx.newPage();
  await page.goto(`file://${HTML_FILE}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // let fonts + animations settle

  for (const { label, text } of FEED_LABELS) {
    process.stdout.write(`  ${label}... `);
    const ok = await exportPost(page, text, `${EXPORT_DIR}/feed/${label}.png`, 360, 450, 3);
    console.log(ok ? '✓' : '✗');
  }

  await browser.close();
}

// ─── STORIES at 5× (1080×1920) ───────────────────────────────────────────────
console.log('\n📸 Exporting stories at 5× (1080×1920)...');
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 6000, height: 4000 },
    deviceScaleFactor: 5,
  });
  const page = await ctx.newPage();
  await page.goto(`file://${HTML_FILE}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  for (const { label, text } of STORY_LABELS) {
    process.stdout.write(`  ${label}... `);
    const ok = await exportPost(page, text, `${EXPORT_DIR}/stories/${label}.png`, 216, 384, 5);
    console.log(ok ? '✓' : '✗');
  }

  await browser.close();
}

// ─── VIDEO FRAMES for animated posts ─────────────────────────────────────────
console.log('\n🎬 Capturing video frames (3s @ 25fps)...');
{
  const browser = await chromium.launch();

  for (const { label, selector_hint, isStory } of ANIMATED_POSTS) {
    const scaleFactor = isStory ? 5 : 3;
    const cardW = isStory ? 216 : 360;
    const cardH = isStory ? 384 : 450;
    const vpW = isStory ? 6000 : 5000;
    const vpH = isStory ? 4000 : 4000;

    const ctx = await browser.newContext({
      viewport: { width: vpW, height: vpH },
      deviceScaleFactor: scaleFactor,
    });
    const page = await ctx.newPage();
    await page.goto(`file://${HTML_FILE}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const outDir = `${EXPORT_DIR}/video-frames/${label}`;
    process.stdout.write(`  ${label} frames... `);
    const n = await captureFrames(page, selector_hint, outDir, cardW, cardH, 25, 6);
    console.log(`✓ (${n} frames)`);

    await ctx.close();
  }

  await browser.close();
}

console.log(`\n✅ Done! Exports in: ${EXPORT_DIR}`);
console.log('\nTo make MP4s from frames (once ffmpeg is installed):');
for (const { label } of ANIMATED_POSTS) {
  console.log(`  ffmpeg -r 25 -i ${EXPORT_DIR}/video-frames/${label}/frame-%04d.png -c:v libx264 -pix_fmt yuv420p -loop 0 ${EXPORT_DIR}/video/${label}.mp4`);
}
