import { createReadStream } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = resolve(__dirname, 'export/video');
const CLOUD_NAME  = 'dxh9cnlqu';
const UPLOAD_PRESET = 'ml_default';
const SUBMIT_URL  = 'http://localhost:5678/webhook/ff-submit-post';

const POSTS = [
  { file: 'S-cd-5.mp4',        scheduled_at: '2026-06-29 19:00:00', notes: 'Countdown — 5 sleeps to go' },
  { file: 'S-cd-4.mp4',        scheduled_at: '2026-06-30 19:00:00', notes: 'Countdown — 4 sleeps to go' },
  { file: 'S-cd-3.mp4',        scheduled_at: '2026-07-01 19:00:00', notes: 'Countdown — 3 sleeps to go' },
  { file: 'S-cd-2.mp4',        scheduled_at: '2026-07-02 19:00:00', notes: 'Countdown — 2 sleeps to go' },
  { file: 'S-cd-tomorrow.mp4', scheduled_at: '2026-07-03 19:00:00', notes: 'Countdown — tomorrow' },
  { file: 'S-event-day.mp4',   scheduled_at: '2026-07-04 09:00:00', notes: 'Event day — doors open at 12' },
];

async function uploadToCloudinary(filePath) {
  const form = new FormData();
  const blob = new Blob([await import('fs').then(fs => fs.promises.readFile(filePath))]);
  form.append('file', blob, filePath.split('/').pop());
  form.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
    { method: 'POST', body: form }
  );
  if (!res.ok) throw new Error(`Cloudinary ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.secure_url;
}

async function submitPost(mediaUrl, scheduledAt, notes) {
  const res = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'story',
      caption: '',
      media_url: mediaUrl,
      scheduled_at: scheduledAt,
      needs_music: false,
      notes,
      status: 'draft',
    }),
  });
  if (!res.ok) throw new Error(`Submit ${res.status}: ${await res.text()}`);
}

console.log('\n🎬 Uploading & scheduling countdown stories...\n');

for (const { file, scheduled_at, notes } of POSTS) {
  const filePath = `${EXPORT_DIR}/${file}`;
  process.stdout.write(`  ${file} → ${scheduled_at}  `);
  try {
    const url = await uploadToCloudinary(filePath);
    await submitPost(url, scheduled_at, notes);
    console.log('✓');
  } catch (err) {
    console.log(`✗  ${err.message}`);
  }
}

console.log('\n✅ Done — check the scheduler UI to confirm.\n');
