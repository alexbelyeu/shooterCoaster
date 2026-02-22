#!/usr/bin/env node
/**
 * Parse Chrome heap snapshot and report:
 * - Total self size by node type
 * - Top constructor names by total self size
 * - Largest individual nodes (self_size)
 * Node format: [type, name_idx, id, self_size, edge_count, detachedness] per node, 6 entries each.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotPath = process.argv[2] || path.join(__dirname, '../../Downloads/shootercoaster-Heap-20260222T170835.heapsnapshot');

const TYPES = ['hidden','array','string','object','code','closure','regexp','number','native','synthetic','concatenated string','sliced string','symbol','bigint','object shape'];
const NODE_FIELDS = 6; // type, name, id, self_size, edge_count, detachedness

console.error('Reading snapshot (this may use a lot of memory)...');
const raw = fs.readFileSync(snapshotPath, 'utf8');
console.error('Parsing JSON...');
const data = JSON.parse(raw);

const meta = data.snapshot.meta;
const nodes = data.nodes;
const strings = data.strings || [];
const nodeCount = data.snapshot.node_count || (nodes.length / NODE_FIELDS);

console.error(`Nodes: ${nodeCount}, Strings: ${strings.length}`);

// Aggregate by type
const byType = {};
const byName = {};
let totalSelf = 0;
const bigNodes = [];

for (let i = 0; i < nodes.length; i += NODE_FIELDS) {
  const type = nodes[i];
  const nameIdx = nodes[i + 1];
  const id = nodes[i + 2];
  const self_size = nodes[i + 3];
  const edge_count = nodes[i + 4];

  totalSelf += self_size;

  const typeName = TYPES[type] || 'type_' + type;
  byType[typeName] = (byType[typeName] || 0) + self_size;

  const name = strings[nameIdx];
  if (name !== undefined && name !== '' && name !== '<dummy>') {
    const key = name.length > 80 ? name.slice(0, 77) + '...' : name;
    byName[key] = (byName[key] || 0) + self_size;
  }

  if (self_size >= 10000) {
    bigNodes.push({ id, type: typeName, name: (strings[nameIdx] || '').slice(0, 60), self_size, edge_count });
  }
}

// Sort and report
console.log('\n=== SELF SIZE BY NODE TYPE ===');
Object.entries(byType)
  .sort((a, b) => b[1] - a[1])
  .forEach(([t, s]) => console.log(`${t}: ${(s / 1024).toFixed(1)} KB (${((s/totalSelf)*100).toFixed(1)}%)`));

console.log('\n=== TOP 50 CONSTRUCTOR / NAME BY SELF SIZE ===');
Object.entries(byName)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 50)
  .forEach(([n, s]) => console.log(`${(s/1024).toFixed(1)} KB  ${n}`));

console.log('\n=== LARGEST INDIVIDUAL NODES (self_size >= 10KB) ===');
bigNodes.sort((a, b) => b.self_size - a.self_size).slice(0, 40).forEach(n => {
  console.log(`${(n.self_size/1024).toFixed(1)} KB  [${n.type}] ${n.name || '(no name)'}`);
});

console.log('\n=== TOTAL SELF SIZE ===');
console.log(`${(totalSelf / 1024 / 1024).toFixed(2)} MB`);
