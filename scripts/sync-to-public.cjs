#!/usr/bin/env node
/**
 * Copy Next.js static export (out/) → thư mục deploy admin (host riêng).
 * Không còn sync vào Laravel public/he-thong.
 *
 * ADMIN_PUBLIC_DIR=/www/wwwroot/admin.vitravel/out node scripts/sync-to-public.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const from = path.join(root, 'out');
const to = process.env.ADMIN_PUBLIC_DIR
  ? path.resolve(process.env.ADMIN_PUBLIC_DIR)
  : null;

if (!to) {
  console.error('Set ADMIN_PUBLIC_DIR to the admin site document root (e.g. .../out or .../public).');
  process.exit(1);
}

if (path.resolve(to) === path.resolve(from)) {
  console.log(`ADMIN_PUBLIC_DIR is already out/ (${to}) — nothing to copy.`);
  process.exit(0);
}

function rmrf(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(from)) {
  console.error('Missing admin/out — run `next build` first.');
  process.exit(1);
}

rmrf(to);
copyDir(from, to);
console.log(`Synced ${from} → ${to}`);
