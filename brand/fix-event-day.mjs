import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 2400, height: 3000 }, deviceScaleFactor: 5 });
const page = await ctx.newPage();
await page.goto('file:///Users/hollyread/Documents/holly-workspace/projects/family-frequencies/brand/daylight-disco-posts.html');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);

const box = await page.evaluate(() => {
  const els = [...document.querySelectorAll('p')];
  const label = els.find(el => el.textContent.trim() === 'Event day · Doors open');
  if (!label) return null;
  let sib = label.nextElementSibling;
  while (sib && sib.tagName !== 'DIV') sib = sib.nextElementSibling;
  return sib ? sib.getBoundingClientRect() : null;
});

if (!box) { console.log('Label not found'); }
else {
  const shot = await page.screenshot({ clip: { x: box.x, y: box.y, width: 216, height: 384 }, scale: 'device' });
  writeFileSync('/Users/hollyread/Documents/holly-workspace/projects/family-frequencies/brand/export/stories/S-event-day.png', shot);
  console.log('✓ S-event-day.png saved');
}
await browser.close();
