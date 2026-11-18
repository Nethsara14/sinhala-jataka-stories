// Usage:  node tools/build-index.js
// Data/*.json (1.json, 2.json ...) scan karala Data/index.json hadanawa.
// Aluth jathaka katha add kalama meka nawatha run karanna.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'Data');
const files = fs.readdirSync(dir).filter((f) => /^\d+\.json$/.test(f));
const items = [];

for (const f of files) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const id = parseInt(f, 10);
    items.push([id, String(s.title || '').trim(), Array.isArray(s.tags) ? s.tags : []]);
  } catch (e) {
    console.warn('SKIP (bad json):', f, e.message);
  }
}

items.sort((a, b) => a[0] - b[0]);
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(items));
console.log('index.json ready: ' + items.length + ' stories');

const ids = new Set(items.map((i) => i[0]));
const gaps = [];
const maxId = items.length ? items[items.length - 1][0] : 0;
for (let i = 1; i <= maxId; i++) if (!ids.has(i)) gaps.push(i);
if (gaps.length) console.log('Data folder eke naththe: ' + gaps.join(', ') + '.json');
