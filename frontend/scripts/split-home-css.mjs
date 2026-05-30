/**
 * One-time splitter: home.css → component CSS modules + slim home-layout.css
 * Run: node frontend/scripts/split-home-css.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'src');
const homePath = path.join(root, '01_Home', 'home.css');
const lines = fs.readFileSync(homePath, 'utf8').split('\n');

function extract(ranges) {
  const out = [];
  for (const [a, b] of ranges) {
    for (let i = a - 1; i < b && i < lines.length; i++) {
      out.push(lines[i]);
    }
    if (out.length && out[out.length - 1] !== '') out.push('');
  }
  return out.join('\n').trim() + '\n';
}

const animations = extract([
  [10, 22],
  [37, 47],
  [154, 164],
  [484, 492],
  [1135, 1147],
  [1782, 1792],
  [2202, 2206],
]);

const homeLayout = extract([
  [413, 422],
  [533, 589],
  [629, 666],
  [1569, 1573],
  [1576, 1600],
  [2079, 2175],
  [2195, 2198],
  [1420, 1439],
  [1441, 1457],
  [1459, 1464],
  [1437, 1438],
]);

const adminHeader = extract([
  [424, 531],
  [2781, 2837],
  [2867, 2875],
]);

const dashboardShared = extract([
  [209, 219],
  [271, 325],
  [590, 627],
  [827, 846],
  [2840, 2853],
  [2881, 2922],
]);

const dashboardCards = extract([
  [1592, 1600],
  [1609, 1615],
  [1664, 1670],
  [1693, 1699],
  [2048, 2175],
  [2169, 2175],
]);

const featureSwitches = extract([
  [706, 711],
  [917, 931],
  [1617, 1658],
  [2859, 2865],
]);

const packageConfig = extract([
  [769, 903],
  [1672, 1687],
  [2240, 2356],
  [2877, 2879],
  [1472, 1480],
  [1488, 1491],
]);

const vipSupporters = extract([
  [984, 1116],
  [1701, 2046],
  [1794, 1798],
  [1800, 1968],
  [1970, 1983],
  [2925, 2931],
  [1503, 1510],
]);

const dashboardModals = [
  extract([[1149, 1254]]),
  extract([[2602, 2739]]), /* btn-perk-* (active; old perk-modal names are dead) */
  extract([[2934, 3344]]),
].join('\n');

const dashboardModalsExtras = `
.section-divider {
  height: 1px;
  background: rgba(148, 163, 184, 0.2);
  margin: 16px 0;
}

.qr-loading-text {
  text-align: center;
  color: #64748b;
  padding: 24px;
}
`;

const dashboardModalsFull = dashboardModals + dashboardModalsExtras;

const out = (rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `/* Auto-split from home.css — ${path.basename(p)} */\n\n${content}`);
  console.log('Wrote', p, `(${content.split('\n').length} lines)`);
};

out('components/dashboard/AdminHeader.css', adminHeader);
out('components/dashboard/DashboardShared.css', dashboardShared);
out('components/dashboard/DashboardCards.css', dashboardCards);
out('components/dashboard/FeatureSwitches.css', featureSwitches);
out('components/dashboard/PackageConfig.css', packageConfig);
out('components/dashboard/VipSupporters.css', vipSupporters);
out('components/dashboard/DashboardModals.css', dashboardModalsFull);

// Backup monolith once
const backupPath = path.join(root, '01_Home', 'home.css.backup');
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(homePath, backupPath);
  console.log('Backup → home.css.backup');
}

// Slim home.css = layout + animations only
const slimHome = `/**
 * Home page — global layout shell (3-column grid, system status, drag wrappers).
 * Component styles: import from each dashboard/*.css file.
 */
${animations}
${homeLayout}
`;
fs.writeFileSync(homePath, slimHome);
console.log('Wrote slim home.css');
