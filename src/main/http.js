// Małe helpery HTTP oparte o wbudowany fetch (Node 18+ / Electron 28+).
const fs = require('fs');
const path = require('path');
const { once } = require('events');

const UA = 'FreshClient/3.0 (Minecraft launcher)';

class HttpError extends Error {
  constructor(status, url, body) {
    super(`HTTP ${status} – ${url}`);
    this.status = status;
    this.body = body;
  }
}

async function request(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    body,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new HttpError(res.status, url, data);
  return data;
}

const getJson = (url, headers) => request(url, { headers });

const postJson = (url, payload, headers = {}) =>
  request(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json', ...headers }
  });

const postForm = (url, fields) =>
  request(url, {
    method: 'POST',
    body: new URLSearchParams(fields).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

/** Pobiera plik strumieniowo do `dest`, raportując postęp (bajty). */
async function download(url, dest, onProgress) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) throw new HttpError(res.status, url, null);

  const total = Number(res.headers.get('content-length')) || 0;
  const tmp = `${dest}.part`;
  const out = fs.createWriteStream(tmp);
  let current = 0;

  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      current += value.length;
      if (!out.write(value)) await once(out, 'drain');
      if (onProgress) onProgress(current, total);
    }
    out.end();
    await once(out, 'finish');
    await fs.promises.rename(tmp, dest);
  } catch (err) {
    out.destroy();
    await fs.promises.rm(tmp, { force: true });
    throw err;
  }
  return dest;
}

/** Pobiera obraz i zwraca go jako data: URL (omija CORS w WebGL / canvas). */
async function fetchDataUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new HttpError(res.status, url, null);
  const type = res.headers.get('content-type') || 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${buf.toString('base64')}`;
}

module.exports = { HttpError, request, getJson, postJson, postForm, download, fetchDataUrl, UA };
