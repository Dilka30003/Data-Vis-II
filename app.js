/* Data story renderer. All statistical charts are Vega-Lite specifications. */
const charts = new Map();
let siteRows = [], stateRows = [], inclusionRows = [], renders = 0;
const controls = [
  ['device-view', 'device-trend', 'deviceMode'],
  ['operator', 'network-choropleth', 'operatorChoice'],
  ['operator', 'network-symbols', 'operatorChoice'],
  ['operator', 'network-trajectory', 'operatorChoice'],
  ['site-filter', 'victoria-sites', 'siteFilter'],
  ['site-filter', 'victoria-hexbins', 'hexTechnology'],
  ['hex-filter', 'victoria-hexbins', 'hexTechnology'],
  ['hex-filter', 'victoria-sites', 'siteFilter'],
  ['inclusion-measure', 'inclusion-scores', 'inclusionDimension'],
  ['platform-focus', 'platform-bump', 'platformFocus'],
  ['profile-state', 'inclusion-parallel', 'profileState'],
  ['tile-measure', 'inclusion-tiles', 'tileDimension']
];
async function getJSON(url) {
  const response = await fetch(`${url}?v=20261025-hosted`); if (!response.ok) throw new Error(`${url}: ${response.status}`); return response.json();
}
async function getCSV(url) {
  const response = await fetch(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); return vega.read(await response.text(), { type: 'csv', parse: 'auto' });
}
function updateStateTable() {
  const op = document.getElementById('operator').value;
  const rows = stateRows.filter(d => d.year === 2026 && d.operator === op && d.longitude != null);
  document.getElementById('network-table').replaceChildren(...rows.map(d => {
    const tr = document.createElement('tr');
    for (const value of [d.state, d.total_sites.toLocaleString(), d.five_g_sites?.toLocaleString() ?? 'Not published', d.five_g_site_share == null ? 'Not published' : d.five_g_site_share.toFixed(1) + '%', d.black_spot_sites == null ? 'Not published' : d.black_spot_sites.toLocaleString()]) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    return tr;
  }));
  const published = rows.filter(d => Number.isFinite(d.five_g_site_share));
  if (!published.length) {
    setInsight('network-insight', `${op}:`, 'No state-level 5G site shares are published for this selection.');
    return;
  }
  const high = Math.max(...published.map(d => d.five_g_site_share));
  const low = Math.min(...published.map(d => d.five_g_site_share));
  const list = values => new Intl.ListFormat('en-AU', { style: 'long', type: 'conjunction' }).format(values);
  const highNames = list(published.filter(d => d.five_g_site_share === high).map(d => d.state_name));
  const lowNames = list(published.filter(d => d.five_g_site_share === low).map(d => d.state_name));
  setInsight('network-insight', `${op}, 2026:`, high === low
    ? `Published state shares are all ${high.toFixed(1)}%. This measures site records, not residents’ coverage.`
    : `${highNames} ${published.filter(d => d.five_g_site_share === high).length > 1 ? 'share' : 'has'} the highest published 5G site share (${high.toFixed(1)}%); ${lowNames} ${published.filter(d => d.five_g_site_share === low).length > 1 ? 'share' : 'has'} the lowest (${low.toFixed(1)}%).`);
}
function setInsight(id, lead, message) {
  const node = document.getElementById(id);
  if (!node) return;
  const strong = document.createElement('strong'); strong.textContent = lead;
  node.replaceChildren(strong, document.createTextNode(` ${message}`));
}
function updateInclusionInsights() {
  const dimension = document.getElementById('tile-measure').value;
  const rows = inclusionRows.filter(d => d.measure === dimension && Number.isFinite(d.score));
  if (rows.length) {
    const high = Math.max(...rows.map(d => d.score)), low = Math.min(...rows.map(d => d.score));
    const names = score => new Intl.ListFormat('en-AU', { type: 'conjunction' }).format(rows.filter(d => d.score === score).map(d => d.state_name));
    setInsight('inclusion-insight', `${dimension}, 2024 data:`,
      `${names(high)}: ${high.toFixed(1)}; ${names(low)}: ${low.toFixed(1)}. The highest and lowest state/territory scores are ${(high - low).toFixed(1)} points apart. This is digital inclusion, not smartphone usage.`);
  }
  const state = document.getElementById('profile-state').value;
  const components = inclusionRows.filter(d => d.state === state && d.measure !== 'Index' && Number.isFinite(d.score));
  if (components.length) {
    const low = Math.min(...components.map(d => d.score));
    const weakest = components.filter(d => d.score === low).map(d => d.measure.toLowerCase()).join(' and ');
    setInsight('profile-insight', `${components[0].state_name}:`,
      `${weakest.charAt(0).toUpperCase() + weakest.slice(1)} ${components.filter(d => d.score === low).length > 1 ? 'are the lowest-scoring components' : 'is the lowest-scoring component'} (${low.toFixed(1)} out of 100). The profile compares dimensions, not causes.`);
  }
}
function updateSiteCount() {
  const filter = document.getElementById('site-filter').value;
  const count = siteRows.filter(d => filter === 'all' || (filter === '5g' && d.five_g_present === 1) || (filter === 'other' && d.five_g_present === 0)).length;
  document.getElementById('site-count').textContent = `${count.toLocaleString()} source records shown`;
}
async function renderChart(item) {
  const node = document.getElementById(item.id);
  try {
    charts.get(item.id)?.finalize();
    let spec = await getJSON(`specs/${item.file}`);
    const mobile = window.innerWidth < 700;
    if (mobile && ['network-choropleth', 'network-symbols'].includes(item.id)) spec.height = 280;
    if (mobile && item.id === 'victoria-sites') spec.height = 260;
    if (mobile && item.id === 'victoria-hexbins') spec.height = 300;
    if (item.id === 'inclusion-tiles') {
      const available = Math.max(220, node.clientWidth - 24);
      const [national, inset] = spec.hconcat;
      if (mobile) {
        national.width = available; national.height = 270;
        inset.width = available; inset.height = 120;
        spec.vconcat = [national, inset]; delete spec.hconcat;
      } else {
        national.width = Math.floor(available * .75);
        national.height = Math.min(440, national.width * .76);
        inset.width = Math.floor(available * .19); inset.height = 155;
      }
    }
    if (mobile && item.id === 'device-trend') spec.height = 290;
    if (mobile) {
      spec.config.axis.labelFontSize = 12;
      spec.config.legend.columns = 1;
      spec.config.legend.labelLimit = 210;
      if (item.id === 'remoteness') { spec.encoding.x.axis.labelAngle = -40; spec.encoding.x.axis.labelAlign = 'left'; }
      if (item.id === 'platform-heatmap') { spec.encoding.x.axis.labelAngle = -45; spec.encoding.x.axis.labelAlign = 'left'; spec.layer[0].encoding.color.legend.gradientLength = 120; }
      if (item.id === 'communication-change') { spec.encoding.color.legend.columns = 1; spec.encoding.color.legend.labelLimit = 250; }
      if (item.id === 'platform-bump') { spec.height = 350; spec.encoding.x.scale.domain = [2021, 2027.4]; }
      if (item.id === 'inclusion-parallel') { spec.height = 300; spec.encoding.x.axis.labelAngle = -25; spec.encoding.x.axis.labelAlign = 'right'; spec.encoding.x.axis.labelLimit = 100; }
      if (item.id === 'network-trajectory') { spec.height = 310; spec.encoding.x.axis.tickCount = 4; spec.encoding.y.axis.tickCount = 5; }
    }
    const result = await vegaEmbed(node, spec, { actions: false, renderer: 'svg', tooltip: { theme: 'light' }, defaultStyle: false });
    charts.set(item.id, result.view);
    node.dataset.chartLayout = mobile ? 'mobile' : 'desktop';
    node.setAttribute('aria-label', item.id === 'hero-waffle' ? '97 filled squares out of 100, rounded from 97.1 percent' : node.closest('article')?.querySelector('h3')?.textContent || item.id);
    for (const [control, id, signal] of controls) if (id === item.id) await result.view.signal(signal, document.getElementById(control).value).runAsync();
    renders = charts.size;
  } catch (error) {
    console.error(item.id, error);
    node.textContent = '';
    const message = document.createElement('p'); message.className = 'chart-error'; message.textContent = 'This chart could not load. Original data sources and methodology are linked in Data & sources.'; node.append(message);
  }
}
async function start() {
  const manifest = await getJSON('specs/manifest.json');
  await Promise.all(manifest.map(renderChart));
  [stateRows, siteRows, inclusionRows] = await Promise.all([getCSV('data/network_states.csv'), getCSV('data/telstra_sites_victoria_2026.csv'), getCSV('data/adii_state_scores.csv')]);
  updateStateTable(); updateSiteCount(); updateInclusionInsights();
  for (const [control, id, signal] of controls) {
    document.getElementById(control).addEventListener('change', async event => {
      try {
        const value = event.target.value;
        if (control === 'site-filter' || control === 'hex-filter') {
          document.getElementById('site-filter').value = value;
          document.getElementById('hex-filter').value = value;
        }
        await charts.get(id)?.signal(signal, value).runAsync();
        if (control === 'operator') updateStateTable();
        if (control === 'site-filter' || control === 'hex-filter') updateSiteCount();
        if (control === 'tile-measure' || control === 'profile-state') updateInclusionInsights();
      }
      catch (error) { console.error(error); document.getElementById('app-status').textContent = 'The chart filter could not update. Please reload the page.'; }
    });
  }
  document.getElementById('app-status').textContent = `${renders} charts loaded. Original data sources are linked below.`;
  document.documentElement.dataset.chartsReady = String(renders);
  window.storyViews = charts;
  window.storyData = { stateRows, siteRows, inclusionRows };
  let timer;
  let mobileLayout = window.innerWidth < 700;
  window.addEventListener('resize', () => {
    clearTimeout(timer); timer = setTimeout(async () => {
      const nextMobile = window.innerWidth < 700;
      if (nextMobile !== mobileLayout) {
        mobileLayout = nextMobile;
        await Promise.all(manifest.map(renderChart));
      } else {
        for (const item of manifest) {
          if (item.id === 'inclusion-tiles') await renderChart(item);
          else {
            const view = charts.get(item.id);
            const width = document.getElementById(item.id).clientWidth;
            if (view) await view.width(width).resize().runAsync();
          }
        }
      }
    }, 200);
  });
}
start();
