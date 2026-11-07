#!/usr/bin/env node
// The PDF is the published source. Replace all derived pages as a unit.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.resolve(process.env.CYBAZAAR_SLIDES_OUTPUT || path.join(web, 'public/cybazaar/slides'));
const source = path.resolve(process.argv[2] || path.join(output, 'source.pdf'));
const pdfinfo = process.env.PDFINFO_BIN || 'pdfinfo';
const pdftoppm = process.env.PDFTOPPM_BIN || 'pdftoppm';
let stage, backup, replaced = false;
try {
  const bytes = await fs.readFile(source);
  if (bytes.length > 100 * 1024 * 1024 || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Expected a PDF smaller than 100 MiB');
  const info = execFileSync(pdfinfo, [source], { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  const count = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (!Number.isInteger(count) || count < 1 || count > 150) throw new Error('Expected 1-150 PDF pages');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const current = await fs.readFile(path.join(output, 'manifest.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (current?.sha256 === sha256 && current.pageCount === count && current.pages?.length === count) {
    const present = await Promise.all(current.pages.map(p => fs.access(path.join(output, p.file)).then(() => true, () => false)));
    const published = await fs.readFile(path.join(output, 'source.pdf')).catch(() => Buffer.alloc(0));
    if (present.every(Boolean) && createHash('sha256').update(published).digest('hex') === sha256) {
      console.log(`Cybazaar slides unchanged: ${count} pages (${sha256.slice(0, 12)})`); process.exit(0);
    }
  }
  await fs.mkdir(path.dirname(output), { recursive: true });
  stage = await fs.mkdtemp(path.join(path.dirname(output), '.cybazaar-slides-'));
  await fs.writeFile(path.join(stage, 'source.pdf'), bytes);
  execFileSync(pdftoppm, ['-jpeg', '-jpegopt', 'quality=88', '-scale-to', '1600', path.join(stage, 'source.pdf'), path.join(stage, 'render')], { timeout: 240000, maxBuffer: 1024 * 1024 });
  const rendered = (await fs.readdir(stage)).filter(f => /^render-\d+\.jpg$/.test(f)).sort((a,b) => Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
  if (rendered.length !== count) throw new Error(`Rendered ${rendered.length} pages, expected ${count}`);
  const pages = [];
  for (let i=0;i<count;i++) {
    const file = `slide-${String(i+1).padStart(3,'0')}.jpg`;
    await fs.rename(path.join(stage, rendered[i]), path.join(stage, file));
    if ((await fs.stat(path.join(stage, file))).size === 0) throw new Error('Empty rendered slide');
    pages.push({ number: i+1, file });
  }
  await fs.writeFile(path.join(stage, 'manifest.json'), JSON.stringify({ title: 'Cybazaar: Meet Akira', pageCount: count, sha256, updatedAt: new Date().toISOString(), pdf: 'source.pdf', pages }, null, 2)+'\n');
  backup = output + '.previous-' + process.pid;
  try { await fs.rename(output, backup); replaced = true; } catch(e) { if(e.code !== 'ENOENT') throw e; }
  try { await fs.rename(stage, output); stage = null; } catch(e) { if(replaced) { await fs.rename(backup, output); replaced=false; } throw e; }
  if(replaced) { await fs.rm(backup, { recursive:true }); replaced=false; }
  console.log(`Cybazaar slides updated: ${count} pages (${sha256.slice(0, 12)})`);
} catch(error) {
  console.error(`Cybazaar slides: ${error.message}`); process.exitCode = 1;
} finally { if(stage) await fs.rm(stage, { recursive:true, force:true }); }
