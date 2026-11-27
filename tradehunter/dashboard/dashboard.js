/* Trade Hunter HQ console. Reads and writes the shared store (../shared/store.js), so a job posted
   in the app, an application or a hire shows up here as it happens. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const I = (n, s, c) => TH_ICON(n, s, c);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = () => TH.get();

  const VIEWS = [
    { id: 'overview', label: 'Overview', icon: 'chart', lede: 'The marketplace right now, across the launch area.' },
    { id: 'verification', label: 'Verification', icon: 'shield', lede: 'Every trade passes ID, insurance and accreditation checks before they appear on the map.' },
    { id: 'jobs', label: 'Jobs', icon: 'briefcase', lede: 'Every job posted, who applied, who was hired and what was said.' },
    { id: 'trades', label: 'Trades', icon: 'hammer', lede: 'The verified trades on Trade Hunter and the ones waiting to join.' },
    { id: 'reports', label: 'Reports', icon: 'flag', lede: 'Trust and safety reports from customers and trades.' },
    { id: 'areas', label: 'Areas', icon: 'map', lede: 'Where jobs are coming from and where more trades are needed.' },
    { id: 'grow', label: 'Grow', icon: 'send', lede: 'Filling the map with verified trades early, so every job gets answered from day one.' },
  ];
  const STATUS = {
    open: ['Open', 'hi'], hired: ['Hired', 'lt'], onway: ['On the way', 'lt'], started: ['In progress', 'lt'],
    done: ['Complete', 'off'], cancelled: ['Cancelled', 'off'],
  };
  const FEED_ICON = { post: 'briefcase', apply: 'send', hire: 'check', review: 'star', signup: 'user', verify: 'shield', online: 'locate', start: 'van', done: 'check' };

  let view = 'overview';
  let map = null, markerLayer = null;
  const seenFeed = new Set();
  const lastKpi = {};
  const jobFilter = { q: '', status: 'all', trade: 'all', area: 'all', kind: 'all' };
  const KINDS = ['Homeowner', 'Landlord', 'Letting agent', 'Property manager', 'Trade'];
  const tradeFilter = { q: '', trade: 'all', status: 'all' };
  let verifySel = null, verifyDoc = 0;
  let drawer = null; // { kind: 'job'|'trader', id, tab }

  /* ---------- shared bits ---------- */
  const av = (t, cls) => `<div class="av ${cls || ''}" style="background:${t.tone || '#2B2E33'}">${esc(TH.initials(t.name))}</div>`;
  const state = (k) => { const s = STATUS[k] || [k, 'off']; return `<span class="state ${s[1]}">${s[0]}</span>`; };
  const traderState = (t) => t.status === 'pending' ? '<span class="state lt">Waiting verification</span>'
    : t.status === 'rejected' ? '<span class="state bad">Rejected</span>'
    : t.online ? '<span class="state hi">Online</span>' : '<span class="state off">Offline</span>';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const AGE = { Today: 0, Yesterday: 1 };
  const byOldest = (a, b) => (AGE[b.since] || 0) - (AGE[a.since] || 0);
  function joined(t) {
    const m = String(t.since).match(/^([A-Za-z]+) (\d{4})$/);
    if (m) return m[1].slice(0, 3) + ' ' + m[2];
    if (t.since in AGE) { const d = new Date(Date.now() - AGE[t.since] * 864e5); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
    let h = 7; for (const c of t.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const k = 2 + h % (t.jobsDone > 80 ? 7 : 16); // busy trades joined early (Mar to Sep 2025), the rest by Jun 2026
    return MONTHS[k % 12] + ' ' + (2025 + Math.floor(k / 12));
  }
  const ratingTxt = (t) => t.reviews ? `${t.rating.toFixed(1)} <span class="muted">(${t.reviews})</span>` : '<span class="muted">New</span>';
  function toast(msg) {
    const el = $('#toast'); el.innerHTML = I('check', 18) + esc(msg); el.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 3200);
  }
  const median = (a) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

  /* ---------- metrics ---------- */
  function metrics() {
    const s = S(), w = s.weeks, wk = w[w.length - 1], prev = w[w.length - 2];
    const liveJobs = s.jobs.filter((j) => j.postedAt > s.seededAt).length;
    let liveApps = 0; s.jobs.forEach((j) => j.applications.forEach((a) => { if (a.at > s.seededAt) liveApps++; }));
    let liveHires = 0; Object.values(s.threads).forEach((m) => m.forEach((x) => { if (x.from === 'sys' && x.at > s.seededAt && /^You hired/.test(x.text)) liveHires++; }));
    const posted = wk.posted + liveJobs, apps = wk.apps + liveApps, hires = wk.hires + liveHires;
    const firsts = s.jobs.filter((j) => j.applications.length).map((j) => (Math.min(...j.applications.map((a) => a.at)) - j.postedAt) / TH.MIN).filter((m) => m > 0 && m < 600);
    const verified = s.traders.filter((t) => t.status === 'verified');
    const pending = s.traders.filter((t) => t.status === 'pending');
    return {
      posted, apps, hires, prev, wk,
      hireRate: Math.round(hires / posted * 100), prevRate: Math.round(prev.hires / prev.posted * 100),
      firstApp: Math.round(median(firsts)),
      online: verified.filter((t) => t.online).length, verified: verified.length, pending,
      openJobs: s.jobs.filter((j) => j.status === 'open'),
      openReports: s.reports.filter((r) => r.status === 'open'),
    };
  }
  const pct = (a, b) => { const p = Math.round((a - b) / b * 100); return p >= 0 ? `<span class="up">+${p}%</span> on last week` : `${p}% on last week`; };

  /* ---------- nav and shell ---------- */
  function renderNav() {
    const m = metrics();
    const counts = { verification: [m.pending.length, m.pending.length > 0], jobs: [m.openJobs.length, false], reports: [m.openReports.length, m.openReports.length > 0] };
    $('#nav').innerHTML = VIEWS.map((v) => {
      const c = counts[v.id];
      return `<a href="#${v.id}" class="${v.id === view ? 'on' : ''}">${I(v.icon, 18)}<span class="lb">${v.label}</span>${c ? `<span class="count ${c[1] ? 'hot' : ''}">${c[0]}</span>` : ''}</a>`;
    }).join('');
  }
  function renderMeta() {
    const d = new Date();
    $('#meta').innerHTML = `<b>${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</b><br>Live, updated ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }

  /* ---------- overview ---------- */
  function overviewHTML() {
    return `
      <div class="kpis" id="kpis"></div>
      <div class="ov">
        <div>
          <div class="mapwrap"><div id="map"></div><div class="map-head" id="maphead"></div>
            <div class="map-key"><span><i class="mk-t"></i>Trades online</span><span><i class="mk-j"></i>Open jobs</span></div></div>
          <div class="chart-card">
            <div class="sec-head"><div><h2 class="h2">Last 12 weeks</h2><div class="sub">Jobs posted, applications sent and trades hired each week</div></div>
              <button class="linkbtn" id="tbltoggle">View as table</button></div>
            <div class="legend" style="margin-bottom:10px"><span><i style="background:#F5EC20"></i>Jobs posted</span><span><i style="background:#C9C5BB"></i>Applications</span><span><i class="dash"></i>Hires</span></div>
            <div class="chart-root" id="chart"></div>
          </div>
        </div>
        <div class="stack">
          <div><div class="sec-head"><h2 class="h2">Needs you</h2></div><div class="attn" id="attn"></div></div>
          <div><div class="sec-head"><h2 class="h2">Who's posting</h2><span class="sub">Share of jobs</span></div><div class="kinds" id="kinds"></div></div>
          <div><div class="sec-head"><h2 class="h2">Live activity</h2><span class="sub" id="feedcount"></span></div><ul class="feed" id="feed"></ul></div>
        </div>
      </div>
`;
  }
  function renderKpis() {
    const m = metrics();
    const k = [
      ['posted', 'Jobs posted this week', m.posted, pct(m.posted, m.prev.posted)],
      ['apps', 'Applications', m.apps, pct(m.apps, m.prev.apps)],
      ['rate', 'Hire rate', m.hireRate + '%', `${m.prevRate}% last week`],
      ['first', 'First application', m.firstApp + ' min', 'Median wait after posting'],
      ['online', 'Trades online', m.online, `of ${m.verified} verified`],
      ['pending', 'Waiting verification', m.pending.length, m.pending.length ? 'Oldest joined ' + m.pending.slice().sort(byOldest)[0].since.toLowerCase() : 'Queue clear'],
    ];
    $('#kpis').innerHTML = k.map(([id, l, v, d]) => {
      const flash = lastKpi[id] !== undefined && lastKpi[id] !== v; lastKpi[id] = v;
      return `<div class="kpi"><div class="l">${l}</div><div class="v num ${flash ? 'flash' : ''}">${v}</div><div class="d">${d}</div></div>`;
    }).join('');
  }
  function renderAttn() {
    const m = metrics();
    const quiet = m.openJobs.filter((j) => !j.applications.length);
    $('#attn').innerHTML = `
      <a href="#verification"><span class="n num">${m.pending.length}</span><span class="t">${m.pending.length === 1 ? 'trade' : 'trades'} waiting for verification</span>${I('next', 16)}</a>
      <a href="#reports"><span class="n num">${m.openReports.length}</span><span class="t">open ${m.openReports.length === 1 ? 'report' : 'reports'} to review</span>${I('next', 16)}</a>
      <a href="#jobs" data-quiet="1"><span class="n num">${quiet.length}</span><span class="t">open ${quiet.length === 1 ? 'job' : 'jobs'} with no applications yet</span>${I('next', 16)}</a>`;
    const q = $('#attn [data-quiet]'); if (q) q.onclick = () => { jobFilter.status = 'open'; jobFilter.q = ''; };
  }
  function renderFeed() {
    const s = S(), first = !seenFeed.size;
    const rows = s.activity.slice(0, 16);
    $('#feed').innerHTML = rows.map((a) => {
      const fresh = !first && !seenFeed.has(a.id); seenFeed.add(a.id);
      return `<li class="${fresh ? 'enter' : ''}">${I(FEED_ICON[a.type] || 'sparkle', 16)}<span>${esc(a.text)}</span><time>${TH.ago(a.at)}</time></li>`;
    }).join('');
    const today = s.activity.filter((a) => Date.now() - a.at < TH.DAY).length;
    $('#feedcount').textContent = today + ' events today';
  }
  function initMap() {
    if (typeof L === 'undefined') { $('#map').innerHTML = '<div class="empty">Map could not load.</div>'; return; }
    map = L.map('map', { zoomControl: false, attributionControl: true, scrollWheelZoom: false, zoomSnap: 0.25 }).setView(TH.CENTRE, 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, maxZoom: 18, className: 'tiles-base', attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors' }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, maxZoom: 18, className: 'tiles-ref' }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    const pts = S().traders.filter((t) => t.status === 'verified').map((t) => t.pos);
    map.fitBounds(pts, { padding: [16, 16], maxZoom: 13 });
    map.on('click', () => map.scrollWheelZoom.enable());
    renderMarkers();
  }
  function renderMarkers() {
    if (!map) return;
    const s = S(); markerLayer.clearLayers();
    s.traders.filter((t) => t.status === 'verified' && t.online).forEach((t) => {
      L.marker(t.pos, { icon: L.divIcon({ className: '', html: '<i class="mk-t"></i>', iconSize: [12, 12], iconAnchor: [6, 6] }), keyboard: false })
        .bindTooltip(`${esc(t.name)}<span>${esc(TH.trade(t.trade).name)}, ${esc(t.area)}</span>`, { className: 'tt', direction: 'top', offset: [0, -6] })
        .on('click', () => openDrawer('trader', t.id)).addTo(markerLayer);
    });
    s.jobs.filter((j) => j.status === 'open').forEach((j) => {
      const fresh = Date.now() - j.postedAt < 90000;
      L.marker(j.pos, { icon: L.divIcon({ className: '', html: `<i class="mk-j ${fresh ? 'new' : ''}"></i>`, iconSize: [12, 12], iconAnchor: [6, 6] }), zIndexOffset: 500, keyboard: false })
        .bindTooltip(`${esc(j.title)}<span>${esc(TH.trade(j.trade).name)}, ${esc(j.area)}, ${j.applications.length} applied</span>`, { className: 'tt', direction: 'top', offset: [0, -6] })
        .on('click', () => openDrawer('job', j.id)).addTo(markerLayer);
    });
    const m = metrics();
    $('#maphead').innerHTML = `<b class="num">${m.online}</b> trades online <span class="muted">and</span> <b class="num">${m.openJobs.length}</b> open jobs`;
  }

  /* ---------- 12-week chart ---------- */
  let showTable = false;
  function chartData() {
    const s = S(), m = metrics();
    return s.weeks.map((w, i) => i === s.weeks.length - 1 ? Object.assign({}, w, { posted: m.posted, apps: m.apps, hires: m.hires }) : w);
  }
  function renderChart() {
    const root = $('#chart'); if (!root) return;
    const data = chartData();
    const SER = [['posted', 'Jobs posted', '#F5EC20'], ['apps', 'Applications', '#C9C5BB'], ['hires', 'Hires', '#8E8A80']];
    if (showTable) {
      root.innerHTML = `<div class="tablewrap"><table style="min-width:420px"><thead><tr><th>Week of</th>${SER.map((x) => `<th class="r">${x[1]}</th>`).join('')}</tr></thead><tbody>${data.map((d) => `<tr style="cursor:default"><td>${d.label}</td><td class="r num">${d.posted}</td><td class="r num">${d.apps}</td><td class="r num">${d.hires}</td></tr>`).join('')}</tbody></table></div>`;
      return;
    }
    const W = Math.max(320, root.clientWidth), H = 260, pl = 40, pr = 118, pt = 12, pb = 28;
    const max = Math.max(...data.map((d) => d.apps));
    const step = max > 400 ? 200 : max > 200 ? 100 : 50, top = Math.ceil(max / step) * step;
    const x = (i) => pl + i * (W - pl - pr) / (data.length - 1), y = (v) => pt + (H - pt - pb) * (1 - v / top);
    let g = '';
    for (let v = 0; v <= top; v += step) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(242,239,232,${v ? .06 : .14})"/><text x="${pl - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    data.forEach((d, i) => { if ((data.length - 1 - i) % (W < 640 ? 4 : 2) === 0) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${i === data.length - 1 ? 'This week' : d.label}</text>`; });
    const last = data[data.length - 1];
    // direct labels, nudged apart so they never collide
    const lab = SER.map(([k, n]) => ({ k, n, y: y(last[k]) + 4 })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 15) lab[i].y = lab[i - 1].y + 15;
    const lines = SER.map(([k, n, c]) => {
      const d = data.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
      return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="ln ${k === 'hires' ? 'dash' : ''}"/>` +
        `<circle cx="${x(data.length - 1)}" cy="${y(last[k])}" r="4" fill="${c}" stroke="var(--ink)" stroke-width="2"/>`;
    }).join('');
    const labels = lab.map((l) => `<text class="dl" x="${W - pr + 12}" y="${l.y}">${l.n} <tspan fill="var(--text)" font-weight="500">${last[l.k]}</tspan></text>`).join('');
    root.innerHTML = `<svg class="chart-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly jobs posted, applications and hires over the last 12 weeks">${g}${lines}${labels}
      <line id="xh" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="rgba(242,239,232,.25)" stroke-dasharray="3 3" opacity="0"/>
      <g id="xdots"></g><rect id="hit" x="${pl}" y="0" width="${W - pl - pr}" height="${H - pb}" fill="transparent"/></svg><div class="tip" id="tip"></div>`;
    const hit = $('#hit', root), tip = $('#tip', root), xh = $('#xh', root), dots = $('#xdots', root);
    const move = (e) => {
      const r = root.getBoundingClientRect(), px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const i = Math.max(0, Math.min(data.length - 1, Math.round((px - pl) / ((W - pl - pr) / (data.length - 1)))));
      const d = data[i];
      xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.setAttribute('opacity', 1);
      dots.innerHTML = SER.map(([k, , c]) => `<circle cx="${x(i)}" cy="${y(d[k])}" r="4" fill="${c}" stroke="var(--ink)" stroke-width="2"/>`).join('');
      tip.innerHTML = `<b>${i === data.length - 1 ? 'This week' : 'Week of ' + d.label}</b>` + SER.map(([k, n, c]) => `<div><i style="background:${c}"></i>${n}<span>${d[k]}</span></div>`).join('');
      tip.style.opacity = 1;
      const tx = x(i) + 14 + 170 > W ? x(i) - 184 : x(i) + 14;
      tip.style.left = tx + 'px'; tip.style.top = '8px';
    };
    const leave = () => { tip.style.opacity = 0; xh.setAttribute('opacity', 0); dots.innerHTML = ''; };
    if (renderChart.drawn) $$('.ln.dash', root).forEach((p) => { p.style.strokeDasharray = '5 4'; });
    hit.addEventListener('mousemove', move); hit.addEventListener('touchmove', move, { passive: true }); hit.addEventListener('mouseleave', leave);
    // draw-in on first paint
    if (!renderChart.drawn) {
      renderChart.drawn = true;
      $$('.ln', root).forEach((p, i) => { const L0 = p.getTotalLength(); p.style.strokeDasharray = L0; p.style.strokeDashoffset = L0; p.getBoundingClientRect(); p.style.transition = `stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1) ${i * 0.12}s`; p.style.strokeDashoffset = 0; if (p.classList.contains('dash')) setTimeout(() => { p.style.transition = ''; p.style.strokeDasharray = '5 4'; }, 1700); });
    }
  }
  function renderKinds() {
    const s = S(), n = s.jobs.length;
    const rows = KINDS.map((k) => ({ k, c: s.jobs.filter((j) => TH.customer(j.customerId).kind === k).length })).filter((r) => r.c).sort((a, b) => b.c - a.c);
    const max = Math.max(...rows.map((r) => r.c));
    $('#kinds').innerHTML = rows.map((r) => `<a href="#jobs" data-kind="${r.k}"><span class="kl">${r.k === 'Trade' ? 'Trades hiring trades' : r.k + 's'}</span><span class="kb"><i style="width:${(r.c / max * 100).toFixed(1)}%"></i></span><span class="kv num">${Math.round(r.c / n * 100)}%</span></a>`).join('');
    $$('#kinds [data-kind]').forEach((a) => a.onclick = () => { Object.assign(jobFilter, { q: '', status: 'all', trade: 'all', area: 'all', kind: a.dataset.kind }); });
  }
  function updateOverview() { renderKpis(); renderAttn(); renderKinds(); renderFeed(); renderMarkers(); renderChart(); }

  /* ---------- jobs ---------- */
  function jobsHTML() {
    const s = S();
    const trades = [...new Set(s.jobs.map((j) => j.trade))].map(TH.trade).sort((a, b) => a.name.localeCompare(b.name));
    const areas = [...new Set(s.jobs.map((j) => j.area))].sort();
    const opt = (v, l, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;
    return `<div class="toolbar">
        <label class="search">${I('search', 16)}<input class="field" id="jq" placeholder="Search jobs, customers or references" value="${esc(jobFilter.q)}"></label>
        <select class="field" id="js">${[['all', 'All statuses'], ['open', 'Open'], ['hired', 'Hired'], ['onway', 'On the way'], ['started', 'In progress'], ['done', 'Complete']].map(([v, l]) => opt(v, l, jobFilter.status)).join('')}</select>
        <select class="field" id="jt">${opt('all', 'All trades', jobFilter.trade)}${trades.map((t) => opt(t.id, t.name, jobFilter.trade)).join('')}</select>
        <select class="field" id="ja">${opt('all', 'All areas', jobFilter.area)}${areas.map((a) => opt(a, a, jobFilter.area)).join('')}</select>
        <select class="field" id="jk">${opt('all', 'Posted by anyone', jobFilter.kind)}${KINDS.map((k) => opt(k, k === 'Trade' ? 'Trades hiring trades' : k + 's', jobFilter.kind)).join('')}</select>
        <span class="count" id="jcount"></span></div>
      <div class="tablewrap"><table><thead><tr><th>Job</th><th>Trade</th><th>Area</th><th>Posted</th><th>Price</th><th class="r">Applied</th><th>Status</th><th>Hired</th></tr></thead><tbody id="jbody"></tbody></table></div>`;
  }
  const seenJobs = new Set();
  function renderJobRows() {
    const s = S(), f = jobFilter, q = f.q.trim().toLowerCase();
    const rows = s.jobs.filter((j) => (f.status === 'all' || j.status === f.status) && (f.trade === 'all' || j.trade === f.trade) && (f.area === 'all' || j.area === f.area) && (f.kind === 'all' || TH.customer(j.customerId).kind === f.kind) &&
      (!q || [j.title, j.ref, j.area, j.postcode, TH.customer(j.customerId).name, TH.trade(j.trade).name].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => b.postedAt - a.postedAt);
    const first = !seenJobs.size;
    $('#jbody').innerHTML = rows.length ? rows.map((j) => {
      const c = TH.customer(j.customerId), h = j.hiredId && TH.trader(j.hiredId), fresh = !first && !seenJobs.has(j.id); seenJobs.add(j.id);
      return `<tr data-job="${j.id}" class="${fresh ? 'fresh' : ''}"><td><div class="t1">${esc(j.title)}</div><div class="t2">${j.ref}, ${esc(c.name)}${c.kind === 'Trade' ? ' <span class="kindtag">Trade</span>' : ''}</div></td>
        <td>${esc(TH.trade(j.trade).name)}</td><td>${esc(j.area)}<div class="t2">${esc(j.postcode)}</div></td><td class="num">${TH.ago(j.postedAt)}</td>
        <td>${esc(TH.priceLabel(j))}${j.duration ? `<div class="t2">${esc(j.duration)}</div>` : ''}</td><td class="r num">${j.applications.length}</td><td>${state(j.status)}</td>
        <td>${h ? `${esc(h.name)}<div class="t2 num">${TH.money(j.agreed)}</div>` : '<span class="muted">Not yet</span>'}</td></tr>`;
    }).join('') : `<tr><td colspan="8" class="empty">No jobs match those filters.</td></tr>`;
    s.jobs.forEach((j) => seenJobs.add(j.id));
    $('#jcount').textContent = rows.length + (rows.length === 1 ? ' job' : ' jobs');
    $$('#jbody tr[data-job]').forEach((tr) => tr.onclick = () => openDrawer('job', tr.dataset.job));
  }
  function bindJobs() {
    $('#jq').oninput = (e) => { jobFilter.q = e.target.value; renderJobRows(); };
    $('#js').onchange = (e) => { jobFilter.status = e.target.value; renderJobRows(); };
    $('#jt').onchange = (e) => { jobFilter.trade = e.target.value; renderJobRows(); };
    $('#ja').onchange = (e) => { jobFilter.area = e.target.value; renderJobRows(); };
    $('#jk').onchange = (e) => { jobFilter.kind = e.target.value; renderJobRows(); };
    renderJobRows();
  }

  /* ---------- trades ---------- */
  function tradesHTML() {
    const opt = (v, l, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;
    return `<div class="toolbar">
        <label class="search">${I('search', 16)}<input class="field" id="tq" placeholder="Search names, businesses or areas" value="${esc(tradeFilter.q)}"></label>
        <select class="field" id="tt">${opt('all', 'All trades', tradeFilter.trade)}${TH.TRADES.map((t) => opt(t.id, t.name, tradeFilter.trade)).join('')}</select>
        <select class="field" id="ts">${[['all', 'Everyone'], ['online', 'Online'], ['offline', 'Offline'], ['pending', 'Waiting verification']].map(([v, l]) => opt(v, l, tradeFilter.status)).join('')}</select>
        <span class="count" id="tcount"></span></div>
      <div class="tablewrap"><table><thead><tr><th>Trade</th><th>Type</th><th>Area</th><th>Rating</th><th class="r">Jobs done</th><th class="r">Replies in</th><th>Status</th><th>Joined</th></tr></thead><tbody id="tbody"></tbody></table></div>`;
  }
  function renderTradeRows() {
    const s = S(), f = tradeFilter, q = f.q.trim().toLowerCase();
    const st = (t) => t.status === 'pending' ? 'pending' : t.online ? 'online' : 'offline';
    const rows = s.traders.filter((t) => (f.trade === 'all' || t.trade === f.trade) && (f.status === 'all' || st(t) === f.status) &&
      (!q || [t.name, t.business, t.area, TH.trade(t.trade).name].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => (a.status === 'pending') - (b.status === 'pending') || b.jobsDone - a.jobsDone);
    $('#tbody').innerHTML = rows.length ? rows.map((t) => `<tr data-t="${t.id}"><td><div class="who-cell">${av(t)}<div><div class="t1">${esc(t.name)}</div><div class="t2">${esc(t.business)}</div></div></div></td>
      <td>${esc(TH.trade(t.trade).name)}</td><td>${esc(t.area)}</td><td class="num">${ratingTxt(t)}</td><td class="r num">${t.jobsDone || '<span class="muted">0</span>'}</td>
      <td class="r num">${t.status === 'verified' ? t.responseMins + ' min' : '<span class="muted">n/a</span>'}</td><td>${traderState(t)}</td><td class="muted">${joined(t)}</td></tr>`).join('')
      : `<tr><td colspan="8" class="empty">No trades match those filters.</td></tr>`;
    $('#tcount').textContent = rows.length + (rows.length === 1 ? ' trade' : ' trades');
    $$('#tbody tr[data-t]').forEach((tr) => tr.onclick = () => openDrawer('trader', tr.dataset.t));
  }
  function bindTrades() {
    $('#tq').oninput = (e) => { tradeFilter.q = e.target.value; renderTradeRows(); };
    $('#tt').onchange = (e) => { tradeFilter.trade = e.target.value; renderTradeRows(); };
    $('#ts').onchange = (e) => { tradeFilter.status = e.target.value; renderTradeRows(); };
    renderTradeRows();
  }

  /* ---------- verification ---------- */
  function hashNum(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
  function docChecks(t, d) {
    if (d.type === 'Photo ID') return [['Face match against selfie passed', 1], ['Name matches the account', 1], ['Address confirmed by credit file', t.id !== 't23']];
    if (d.type === 'Public liability insurance') return [['Cover of £2m or more', 1], ['Policy in date', 1], ['Business name matches the policy', t.id !== 't24']];
    return [['Register entry found and active', 1], ['Supervisor name matches the account', t.id !== 't25'], ['Scope covers domestic work', 1]];
  }
  function docPreview(t, d) {
    const [first, ...rest] = t.name.split(' '), last = rest.join(' ');
    const n = hashNum(t.id + d.type);
    if (d.type === 'Photo ID') return `<div class="idcard"><div class="top-row"><span>Driving licence</span><span>UK</span></div>
        <div class="idgrid"><div class="face">${esc(TH.initials(t.name))}</div>
        <div class="rows"><div><b>1.</b>${esc(last.toUpperCase())}</div><div><b>2.</b>${esc(first.toUpperCase())}</div>
        <div><b>3.</b><span class="blur">${String(10 + n % 18).padStart(2, '0')}.0${1 + n % 9}.19${80 + n % 19}</span></div><div><b>4a.</b><span class="blur">${String(1 + n % 27).padStart(2, '0')}.0${1 + (n >> 3) % 9}.20${17 + n % 6}</span></div>
        <div><b>5.</b><span>${esc(last.slice(0, 5).toUpperCase())}<span class="blur">${String(n).slice(0, 6)}${esc(first[0])}9AB</span></span></div>
        <div><b>8.</b><span class="blur">${10 + n % 80} Park Road, ${esc(t.area)}</span></div></div></div>
        <div class="sig">${esc(first[0] + '. ' + last)}</div></div>`;
    if (d.type === 'Public liability insurance') {
      const month = (d.detail.match(/renews (\w+) (\d{4})/) || [0, 'March', '2027']);
      return `<div class="cert"><h4>Certificate of public liability insurance</h4><div class="small">Issued to the policy holder named below</div><hr>
        <dl><dt>Policy holder</dt><dd>${esc(t.business)}</dd><dt>Trading as</dt><dd>${esc(t.name)}</dd><dt>Business activity</dt><dd>${esc(TH.trade(t.trade).name)}</dd>
        <dt>Limit of indemnity</dt><dd>£2,000,000 any one event</dd><dt>Period of cover</dt><dd>To 1 ${esc(month[1])} ${esc(month[2])}</dd><dt>Policy number</dt><dd class="num">PL-${String(n).slice(0, 4)}-${String(n).slice(4, 8)}</dd></dl>
        <div class="stamp"><span class="small">Authorised signatory</span><i>R. Hallam</i></div></div>`;
    }
    return `<div class="cert"><h4>${esc(t.accred || 'Trade accreditation')}</h4><div class="small">Register entry, checked against the public register</div><hr>
      <dl><dt>Registered business</dt><dd>${esc(t.business)}</dd><dt>Qualified person</dt><dd>${esc(t.name)}</dd><dt>Scope</dt><dd>${esc(TH.trade(t.trade).name)}, domestic</dd>
      <dt>Registration</dt><dd class="num">${String(n).slice(0, 6)}</dd><dt>Status</dt><dd>Active</dd></dl>
      <div class="stamp"><span class="small">Checked ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span><i>Register</i></div></div>`;
  }
  function verificationHTML() {
    const pend = S().traders.filter((t) => t.status === 'pending').sort(byOldest);
    if (!pend.length) return `<div class="done-state">${I('shield', 34)}<h2 class="h2" style="font-size:20px">Queue clear</h2><p class="muted" style="max-width:420px;margin:8px auto 18px">Every trade on the map has passed ID, insurance and accreditation checks.</p><a class="btn" href="#overview">Back to overview</a></div>`;
    if (!verifySel || !pend.some((t) => t.id === verifySel)) { verifySel = pend[0].id; verifyDoc = 0; }
    const t = TH.trader(verifySel), d = t.docs[verifyDoc] || t.docs[0];
    const checks = docChecks(t, d);
    return `<div class="vgrid">
      <div><div class="sec-head"><h2 class="h2">Queue</h2><span class="sub">${pend.length} waiting</span></div>
        <div class="queue">${pend.map((p) => `<button data-v="${p.id}" class="${p.id === verifySel ? 'on' : ''}">${av(p)}<div><div class="q1">${esc(p.name)}</div><div class="q2">${esc(TH.trade(p.trade).name)}, ${esc(p.area)}</div></div><span class="when">${esc(p.since)}</span></button>`).join('')}</div></div>
      <div>
        <div class="vhead">${av(t, 'lg')}<div><h2>${esc(t.name)}</h2><div class="sub">${esc(t.business)}, ${esc(TH.trade(t.trade).name)} in ${esc(t.area)}. ${t.years} years in the trade, joined ${esc(t.since.toLowerCase())}.</div></div>
          <div class="acts"><button class="btn ghost-bad" id="vreject">Reject</button><button class="btn primary" id="vapprove">${I('check', 16)}Approve and go live</button></div></div>
        <div class="vbody">
          <div><div class="docs">${t.docs.map((x, i) => `<button data-d="${i}" class="${i === verifyDoc ? 'on' : ''}">${I(i === 0 ? 'user' : i === 1 ? 'shield' : 'doc', 17)}<span>${esc(x.type)}</span><span class="dst">${docChecks(t, x).every((c) => c[1]) ? 'Checked' : 'Needs a look'}</span></button>`).join('')}</div>
            <div class="checks">${checks.map(([c, ok]) => `<div class="${ok ? '' : 'pend'}">${I(ok ? 'check' : 'clock', 16)}<span>${esc(c)}${ok ? '' : '<br><span class="muted">Needs a manual look</span>'}</span></div>`).join('')}</div></div>
          <div class="docstage">${docPreview(t, d)}</div>
        </div>
      </div></div>`;
  }
  function bindVerification() {
    $$('[data-v]').forEach((b) => b.onclick = () => { verifySel = b.dataset.v; verifyDoc = 0; renderView(); });
    $$('[data-d]').forEach((b) => b.onclick = () => { verifyDoc = +b.dataset.d; renderView(); });
    const ap = $('#vapprove'), rj = $('#vreject');
    if (ap) ap.onclick = () => { const t = TH.trader(verifySel); TH.verify(t.id, true); toast(`${t.name} is verified and live on the map`); };
    if (rj) rj.onclick = () => { const t = TH.trader(verifySel); TH.verify(t.id, false); toast(`${t.name} was rejected and their documents returned`); };
  }

  /* ---------- reports ---------- */
  const PAST_REPORTS = [
    { id: 'p1', at: Date.now() - 6 * TH.DAY, about: 'Profile of a roofer in Ewell', text: 'Insurance certificate expired. Trade hidden from the map until a renewed policy was uploaded the next day.', status: 'resolved' },
    { id: 'p2', at: Date.now() - 11 * TH.DAY, about: 'Message thread on a fencing job', text: 'Customer shared a phone number before hiring. Reminder sent about keeping quotes in the app so both sides are covered.', status: 'resolved' },
    { id: 'p3', at: Date.now() - 17 * TH.DAY, about: 'Review on a decorating job', text: 'Review mentioned the customer by full name. Edited with their agreement and left live.', status: 'resolved' },
  ];
  function reportsHTML() {
    const s = S(), open = s.reports.filter((r) => r.status === 'open'), done = s.reports.filter((r) => r.status !== 'open').concat(PAST_REPORTS);
    const row = (r) => {
      const ref = (r.about.match(/TH-\d+/) || [])[0], j = ref && s.jobs.find((x) => x.ref === ref);
      return `<div class="rep ${r.status === 'open' ? '' : 'res'}">${I('flag', 18)}<div><b style="font-weight:500">${esc(r.about)}</b> <span class="sub">${TH.ago(r.at)}</span><p>${esc(r.text)}</p>
        ${j ? `<button class="linkbtn" data-openjob="${j.id}" style="margin-top:8px">Open the job</button>` : ''}</div>
        ${r.status === 'open' ? `<button class="btn" data-res="${r.id}">Mark resolved</button>` : '<span class="state off">Resolved</span>'}</div>`;
    };
    return `<div class="sec-head"><h2 class="h2">Open</h2><span class="sub">${open.length} to review</span></div>
      ${open.length ? open.map(row).join('') : '<div class="empty" style="text-align:left;padding:18px 0;border-top:1px solid var(--line)">Nothing open. Good.</div>'}
      ${done.length ? `<div class="sec-head" style="margin-top:36px"><h2 class="h2">Resolved</h2></div>${done.map(row).join('')}` : ''}`;
  }
  function bindReports() {
    $$('[data-res]').forEach((b) => b.onclick = () => { TH.resolveReport(b.dataset.res); toast('Report resolved'); });
    $$('[data-openjob]').forEach((b) => b.onclick = () => openDrawer('job', b.dataset.openjob));
  }

  /* ---------- areas ---------- */
  const TRADE_SHARE = { electrician: .16, plumber: .15, handyman: .1, builder: .08, decorator: .08, gas: .07, roofer: .06, landscaper: .05, carpenter: .05, locksmith: .04, plasterer: .04, tiler: .03, kitchen: .03, bathroom: .03, drainage: .03, bricklayer: .02, flooring: .02, windows: .02, labourer: .05, scaffolder: .02, fencer: .02, aircon: .01 };
  function areaStats() {
    const s = S(), month = s.weeks.slice(-4).reduce((a, w) => a + w.posted, 0) + s.jobs.filter((j) => j.postedAt > s.seededAt).length;
    const names = Object.keys(TH.AREAS);
    const wts = names.map((n) => 1 / (0.6 + TH.miles(TH.CENTRE, TH.AREAS[n])) * (0.8 + (hashNum(n) % 40) / 100));
    const tot = wts.reduce((a, b) => a + b, 0);
    const areas = names.map((n, i) => {
      const live = s.jobs.filter((j) => j.area === n && j.postedAt > s.seededAt).length;
      const jobs = Math.round(month * wts[i] / tot) + live;
      const trades = s.traders.filter((t) => t.area === n && t.status === 'verified').length;
      return { n, pc: TH.AREAS[n][2], jobs, trades, ratio: jobs / Math.max(trades, 0.5) };
    }).sort((a, b) => b.ratio - a.ratio);
    const trades = TH.TRADES.map((t) => {
      const jobs = Math.round(month * (TRADE_SHARE[t.id] || .02)) + s.jobs.filter((j) => j.trade === t.id && j.postedAt > s.seededAt).length;
      const n = s.traders.filter((x) => x.trade === t.id && x.status === 'verified').length;
      const p = s.traders.filter((x) => x.trade === t.id && x.status === 'pending').length;
      return { t, jobs, n, p, ratio: jobs / Math.max(n, 0.5) };
    }).sort((a, b) => b.ratio - a.ratio);
    return { month, areas, trades };
  }
  function areasHTML() {
    const { month, areas, trades } = areaStats();
    const maxJ = Math.max(...areas.map((a) => a.jobs)), maxT = Math.max(...areas.map((a) => a.trades), 1);
    return `<div class="areas">
      <div><div class="sec-head"><div><h2 class="h2">By area</h2><div class="sub">${month} jobs in the last 30 days, busiest per trade first</div></div>
        <div class="legend" style="flex:none"><span><i style="background:#F5EC20"></i>Jobs</span><span><i style="background:#6d6a62"></i>Trades</span></div></div>
        <div class="tablewrap"><table style="min-width:620px"><thead><tr><th>Area</th><th>Jobs, 30 days</th><th>Verified trades</th><th class="r">Jobs per trade</th></tr></thead><tbody>
        ${areas.map((a) => `<tr style="cursor:default"><td><div class="t1">${esc(a.n)}</div><div class="t2">${a.pc}</div></td>
          <td><div class="barcell"><div class="track"><div class="bar" style="width:${(a.jobs / maxJ * 100).toFixed(1)}%"></div></div><span class="num" style="width:28px;text-align:right">${a.jobs}</span></div></td>
          <td><div class="barcell"><div class="track"><div class="bar sup" style="width:${(a.trades / maxT * 100).toFixed(1)}%;${a.trades ? '' : 'width:0'}"></div></div><span class="num" style="width:20px;text-align:right">${a.trades}</span></div></td>
          <td class="r num">${a.trades ? a.ratio.toFixed(1) : '<span class="muted">No trades yet</span>'}</td></tr>`).join('')}
        </tbody></table></div></div>
      <div><div class="sec-head"><div><h2 class="h2">Short supply</h2><div class="sub">Trades with the most jobs per verified member</div></div></div>
        ${trades.slice(0, 7).map((x) => `<div class="short"><div><div style="font-weight:500">${esc(x.t.name)}</div><div class="sub">${x.jobs} jobs in 30 days, ${x.n} verified${x.p ? `, ${x.p} waiting verification` : ''}</div></div><div class="ratio num">${x.n ? x.ratio.toFixed(1) : x.jobs}<div class="sub" style="font-family:var(--body)">${x.n ? 'jobs per trade' : 'jobs, no trades'}</div></div></div>`).join('')}
        <p class="note">Jobs with no local trade still reach the nearest verified ones within ten miles, but they wait longer for a first application. These are the trades and areas to recruit in next.</p></div>
    </div>`;
  }

  /* ---------- grow: recruitment to beat the empty-map problem ---------- */
  const GROW_KEY = 'th-hq-grow-v1';
  const PLURAL = { Handyman: 'Handymen', 'Painter and decorator': 'Painters and decorators', Flooring: 'Flooring fitters', 'Windows and doors': 'Window and door fitters', Drainage: 'Drainage engineers', 'Air conditioning': 'Air conditioning engineers' };
  const plural = (n) => PLURAL[n] || n + 's';
  const STAGES = [['found', 'Found'], ['contacted', 'Contacted'], ['opened', 'Opened'], ['replied', 'Replied'], ['joined', 'Joined'], ['verified', 'Verified']];
  const BIZ_STEPS = ['Found', 'Contacted', 'Opened', 'Replied', 'Call booked', 'Joined', 'Verified'];
  const BIZ_STATE = { Found: 'off', Contacted: 'lt', Opened: 'lt', Replied: 'lt', 'Call booked': 'lt', Joined: 'hi', Verified: 'ok' };
  const LEAD_PRICE = 35;
  function growSeed() {
    const now = Date.now(), H = 3600000, Dd = 86400000;
    const B = (name, trade, area, source, status, touch, ago) => ({ id: 'b' + hashNum(name), name, trade, area, source, status, touch, at: now - ago, ltd: / Ltd$/.test(name) });
    return {
      campaigns: [
        { id: 'c-plumb', trade: 'plumber', name: 'Plumbers, Esher and Claygate', side: 'supply', state: 'Running', started: now - 12 * Dd, f: { found: 142, contacted: 131, opened: 84, replied: 23, joined: 9, verified: 7 }, ch: { email: 58, call: 44, linkedin: 12, whatsapp: 17 } },
        { id: 'c-lab', trade: 'labourer', name: 'Labourers, Kingston', side: 'supply', state: 'Running', started: now - 8 * Dd, f: { found: 96, contacted: 90, opened: 61, replied: 28, joined: 15, verified: 11 }, ch: { email: 14, call: 22, linkedin: 9, whatsapp: 45 } },
        { id: 'c-let', trade: null, name: 'Letting agents, Surbiton and Kingston', side: 'demand', state: 'Running', started: now - 6 * Dd, f: { found: 38, contacted: 38, opened: 29, replied: 9, joined: 4, verified: 3 }, ch: { email: 38, call: 0, linkedin: 0, whatsapp: 0 } },
        { id: 'c-elec', trade: 'electrician', name: 'Electricians, Long Ditton and Thames Ditton', side: 'supply', state: 'Finished', started: now - 30 * Dd, f: { found: 64, contacted: 60, opened: 41, replied: 14, joined: 8, verified: 8 }, ch: { email: 31, call: 18, linkedin: 6, whatsapp: 5 } },
      ],
      biz: [
        B('Mole Valley Plumbing Ltd', 'plumber', 'Esher', 'Companies House', 'Joined', 'Signed up from the email', 3 * H),
        B('K. Dunne Electrical', 'electrician', 'Thames Ditton', 'Own website', 'Replied', 'WhatsApp reply', 5 * H),
        B('Claygate Heating Services Ltd', 'plumber', 'Claygate', 'Companies House', 'Opened', 'Email opened', 2 * H),
        B('R. Okoye Labour', 'labourer', 'Kingston', 'Listing', 'Call booked', 'Call, TPS checked', 26 * H),
        B('Hollybush Roofing Ltd', 'roofer', 'Chessington', 'Companies House', 'Contacted', 'Email sent', 7 * H),
        B('S. Varga Building', 'builder', 'Esher', 'Own website', 'Contacted', 'LinkedIn invite', 9 * H),
        B('Riverside Drain Care Ltd', 'drainage', 'Hampton Wick', 'Companies House', 'Replied', 'Email reply', 20 * H),
        B('M. Teale Carpentry', 'carpenter', 'Long Ditton', 'Listing', 'Opened', 'WhatsApp invite read', 4 * H),
        B('Ditton Bathrooms Ltd', 'bathroom', 'Thames Ditton', 'Companies House', 'Found', 'Queued for email', 1 * H),
        B('J. Abara Decorating', 'decorator', 'Tolworth', 'Listing', 'Joined', 'Signed up from WhatsApp', 30 * H),
        B('Weyside Plastering Ltd', 'plasterer', 'Hook', 'Companies House', 'Contacted', 'Email sent', 6 * H),
        B('P. Lindqvist Groundworks', 'labourer', 'Kingston', 'Own website', 'Opened', 'LinkedIn invite seen', 8 * H),
        B('Fairmile Electrical Ltd', 'electrician', 'Esher', 'Companies House', 'Verified', 'Insurance checked', 50 * H),
        B('T. Brook Plumbing', 'plumber', 'Claygate', 'Listing', 'Replied', 'Call, TPS checked', 10 * H),
        B('Ashgrove Lettings Ltd', 'letting', 'Kingston', 'Companies House', 'Opened', 'Email opened', 3 * H),
      ],
    };
  }
  let grow = null;
  function G() {
    if (grow) return grow;
    try { const raw = localStorage.getItem(GROW_KEY); if (raw) grow = JSON.parse(raw); } catch (e) {}
    if (!grow || !grow.campaigns) grow = growSeed();
    return grow;
  }
  function saveGrow() { try { localStorage.setItem(GROW_KEY, JSON.stringify(grow)); } catch (e) {} }
  const tradeName = (id) => id === 'letting' ? 'Letting agent' : TH.trade(id).name;

  function growGaps() {
    const { areas, trades } = areaStats();
    const s = S(), byDemand = areas.slice().sort((a, b) => b.jobs - a.jobs), used = {};
    return trades.slice(0, 6).map((x) => {
      const thin = byDemand.filter((a) => !s.traders.some((t) => t.trade === x.t.id && t.area === a.n && t.status === 'verified'))
        .slice(0, 8).map((a, i) => ({ n: a.n, score: i + 3 * (used[a.n] || 0) })).sort((a, b) => a.score - b.score).slice(0, 2).map((a) => a.n);
      thin.forEach((n) => { used[n] = (used[n] || 0) + 1; });
      const live = G().campaigns.find((c) => c.trade === x.t.id && c.state === 'Running');
      const name = live ? live.name : plural(x.t.name) + ', ' + thin.join(' and ');
      return { x, thin, name, running: !!live };
    });
  }
  function foundingStats() {
    const s = S(), ver = s.traders.filter((t) => t.status === 'verified');
    const flagged = s.traders.filter((t) => t.founding === true);
    const fromCampaigns = G().campaigns.filter((c) => c.side === 'supply').reduce((a, c) => a + c.f.verified, 0);
    const taken = Math.min(100, (flagged.length || ver.length) + fromCampaigns);
    const inv = (t) => (typeof t.invites === 'number' ? t.invites : (hashNum(t.id + 'inv') % 9) + (t.jobsDone > 100 ? 3 : 0));
    const inviters = ver.map((t) => ({ t, n: inv(t) })).sort((a, b) => b.n - a.n);
    const sent = inviters.reduce((a, r) => a + r.n, 0);
    return { taken, sent, joinedFromInvite: Math.round(sent * 0.17), top: inviters.slice(0, 5) };
  }
  function savings() {
    const s = S(), m = metrics();
    const apps12 = s.weeks.slice(0, -1).reduce((a, w) => a + w.apps, 0) + m.apps;
    const ver = s.traders.filter((t) => t.status === 'verified').length;
    return { apps12, total: apps12 * LEAD_PRICE, perTrade: Math.round(apps12 * LEAD_PRICE / Math.max(ver, 1)) };
  }

  function growHTML() {
    const gaps = growGaps(), fs = foundingStats(), sv = savings(), g = G();
    const camp = (c) => {
      const f = c.f, top = Math.max(f.found, 1), last = c.side === 'demand' ? 'Posting jobs' : 'Verified';
      const ch = [['Email', c.ch.email], ['Calls', c.ch.call], ['LinkedIn', c.ch.linkedin], ['WhatsApp', c.ch.whatsapp]].filter((x) => x[1]).map((x) => `${x[0]} ${x[1]}`).join(', ');
      return `<div class="camp" data-camp="${c.id}">
        <div class="camp-head"><div><h3>${esc(c.name)}</h3><div class="sub">${c.side === 'demand' ? 'Repeat job posters' : 'Trades'}, started ${TH.ago(c.started).toLowerCase()}. ${esc(ch) || 'Sourcing businesses'}</div></div>
          <span class="state ${c.state === 'Running' ? 'hi' : 'off'}">${c.state}</span></div>
        <div class="funnel">${STAGES.map(([k, l]) => `<div class="f"><div class="l">${k === 'verified' ? last : l}</div><div class="v num" data-k="${c.id}-${k}">${f[k]}</div><div class="fb"><i class="${k === 'joined' || k === 'verified' ? 'y' : ''}" style="width:${(f[k] / top * 100).toFixed(1)}%"></i></div></div>`).join('')}</div>
      </div>`;
    };
    return `<p class="credit">Recruitment campaigns run by Overture <span aria-hidden="true">&middot;</span> <a href="https://operasolutions.tech/demo/operaoverture/" target="_blank" rel="noopener">About Overture</a></p>
      <div class="grow-top">
        <div><div class="sec-head"><div><h2 class="h2">Where to recruit next</h2><div class="sub">Trades and areas with the most jobs per verified trade</div></div></div>
          <div class="gaps">${gaps.map((r) => `<div class="gap"><div><div class="g1">${esc(r.name)}</div><div class="sub">${r.x.jobs} jobs a month, ${r.x.n} verified ${r.x.n === 1 ? esc(r.x.t.name.toLowerCase()) : esc(plural(r.x.t.name).toLowerCase())}${r.x.p ? `, ${r.x.p} waiting verification` : ''}</div></div>
            ${r.running ? '<span class="sub">Campaign running</span>' : `<button class="btn" data-start="${r.x.t.id}" data-name="${esc(r.name)}">Start campaign</button>`}</div>`).join('')}</div>
          <div style="margin-top:36px"><div class="sec-head"><h2 class="h2">Lead fees saved</h2><span class="sub">Last 12 weeks</span></div>
            <div class="big num" id="saved">${TH.money(sv.total)}</div>
            <div class="sub">Estimate: ${sv.apps12.toLocaleString('en-GB')} applications &times; £${LEAD_PRICE}, a typical lead price. About ${TH.money(sv.perTrade)} for each verified trade, kept because applying on Trade Hunter is free.</div></div></div>
        <div class="stack">
          <div><div class="sec-head"><h2 class="h2">Founding 100</h2><span class="sub">The first hundred verified trades</span></div>
            <div class="big num">${fs.taken}<span> of 100</span></div>
            <div class="prog"><i style="width:${fs.taken}%"></i></div>
            <div class="pair"><div><div class="l">Invites sent by members</div><div class="v num">${fs.sent}</div></div><div><div class="l">Joined from an invite</div><div class="v num">${fs.joinedFromInvite}</div></div></div>
            <div class="inviters">${fs.top.map((r) => `<div>${av(r.t)}<div style="flex:1;min-width:0"><div>${esc(r.t.name)}</div><div class="sub">${esc(r.t.business)}</div></div><span class="num">${r.n} invites</span></div>`).join('')}</div></div>
        </div>
      </div>
      <div class="sec-head" style="margin-top:44px"><div><h2 class="h2">Campaigns</h2><div class="sub">Each one finds businesses, reaches them on the right channel and follows up until they join or say no</div></div></div>
      <div class="camps" id="camps">${g.campaigns.slice().sort((a, b) => (a.state === 'Finished') - (b.state === 'Finished') || b.started - a.started).map(camp).join('')}</div>
      <p class="note" style="max-width:720px">Marketing emails only go to limited companies, as UK PECR rules require. Sole traders are reached by phone after a TPS check, or by a LinkedIn or WhatsApp invite, and anyone can opt out in one reply.</p>
      <div class="sec-head" style="margin-top:40px"><div><h2 class="h2">Businesses found</h2><div class="sub">Sourced from Companies House, their own websites and trade listings</div></div><span class="sub">${g.biz.length} shown</span></div>
      <div class="tablewrap"><table style="min-width:760px"><thead><tr><th>Business</th><th>Trade</th><th>Area</th><th>Source</th><th>Status</th><th>Last touch</th></tr></thead><tbody id="bizbody">${bizRows()}</tbody></table></div>`;
  }
  let freshBiz = null;
  function bizRows() {
    return G().biz.slice().sort((a, b) => b.at - a.at).map((b) => `<tr style="cursor:default" class="${b.id === freshBiz ? 'fresh' : ''}"><td class="t1">${esc(b.name)}</td><td>${esc(tradeName(b.trade))}</td><td>${esc(b.area)}</td><td class="muted">${esc(b.source)}</td>
      <td><span class="state ${BIZ_STATE[b.status]}">${b.status}</span></td><td>${esc(b.touch)}<div class="t2">${TH.ago(b.at)}</div></td></tr>`).join('');
  }
  function bindGrow() {
    $$('[data-start]').forEach((b) => b.onclick = () => {
      const g = G(), id = 'c-' + Date.now().toString(36);
      g.campaigns.push({ id, trade: b.dataset.start, name: b.dataset.name, side: 'supply', state: 'Running', started: Date.now(), ramp: 60 + Math.round(Math.random() * 50),
        f: { found: 0, contacted: 0, opened: 0, replied: 0, joined: 0, verified: 0 }, ch: { email: 0, call: 0, linkedin: 0, whatsapp: 0 } });
      saveGrow(); toast('Campaign started: ' + b.dataset.name); renderView();
    });
  }
  // the clock: new campaigns ramp up and found businesses move along
  const NEXT_TOUCH = { Contacted: (b) => b.ltd ? 'Email sent' : ['Call, TPS checked', 'WhatsApp invite', 'LinkedIn invite'][hashNum(b.id) % 3], Opened: (b) => b.ltd ? 'Email opened' : 'Invite read', Replied: (b) => b.ltd ? 'Email reply' : 'WhatsApp reply', 'Call booked': () => 'Intro call booked', Joined: () => 'Signed up', Verified: () => 'ID and insurance checked' };
  let growTicks = 0;
  function growTick() {
    const g = G(); let changed = false; growTicks++;
    g.campaigns.forEach((c) => {
      if (!c.ramp || c.f.found >= c.ramp) return;
      c.f.found = Math.min(c.ramp, c.f.found + 4 + Math.round(Math.random() * 6));
      c.f.contacted = Math.round(c.f.found * 0.9); c.f.opened = Math.round(c.f.contacted * 0.55); c.f.replied = Math.round(c.f.opened * 0.2);
      const e = Math.round(c.f.contacted * 0.45), w = Math.round(c.f.contacted * 0.3);
      c.ch = { email: e, call: Math.round(c.f.contacted * 0.15), linkedin: c.f.contacted - e - w - Math.round(c.f.contacted * 0.15), whatsapp: w };
      changed = true;
    });
    if (growTicks % 7 === 0) {
      const open = g.biz.filter((b) => b.status !== 'Verified');
      const b = open[Math.floor(Math.random() * open.length)];
      if (b) {
        b.status = BIZ_STEPS[BIZ_STEPS.indexOf(b.status) + 1]; b.touch = NEXT_TOUCH[b.status](b); b.at = Date.now(); freshBiz = b.id;
        const c = g.campaigns.find((x) => x.trade === b.trade && x.state === 'Running') || g.campaigns.find((x) => x.side === (b.trade === 'letting' ? 'demand' : 'supply') && x.state === 'Running');
        if (c && b.status === 'Joined') c.f.joined++;
        if (c && b.status === 'Verified') c.f.verified++;
        if (c && b.status === 'Replied') c.f.replied++;
        changed = true;
      }
    }
    if (!changed) return;
    saveGrow();
    if (view !== 'grow') return;
    const before = {}; $$('.funnel .v').forEach((el) => { before[el.dataset.k] = el.textContent; });
    const y = window.scrollY; renderView(); window.scrollTo(0, y);
    $$('.funnel .v').forEach((el) => { if (before[el.dataset.k] !== undefined && before[el.dataset.k] !== el.textContent) el.classList.add('flash'); });
  }
  setInterval(growTick, 1000);

  /* ---------- drawer ---------- */
  function openDrawer(kind, id, tab) { drawer = { kind, id, tab: tab || null }; renderDrawer(); $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { drawer = null; $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); }
  function threadHTML(msgs) {
    return `<div class="thread">${msgs.map((m) => m.from === 'sys' ? `<div class="bub sys">${esc(m.text)}</div>`
      : m.kind === 'quote' ? `<div class="bub quote ${m.from}"><b class="num">${TH.money(m.amount)}</b>${esc(m.text)}<time>${m.accepted ? 'Accepted' : 'Quote sent'}, ${TH.clock(m.at)}</time></div>`
      : `<div class="bub ${m.from}">${esc(m.text)}<time>${TH.dayLabel(m.at)}, ${TH.clock(m.at)}</time></div>`).join('')}</div>`;
  }
  function renderDrawer() {
    if (!drawer) return;
    const el = $('#drawer');
    if (drawer.kind === 'job') {
      const j = TH.job(drawer.id); if (!j) return closeDrawer();
      const c = TH.customer(j.customerId), h = j.hiredId && TH.trader(j.hiredId);
      const convos = j.applications.map((a) => a.traderId).filter((tid) => TH.thread(j.id, tid).length);
      if (!drawer.tab || !convos.includes(drawer.tab)) drawer.tab = (h && convos.includes(h.id)) ? h.id : convos[0];
      el.innerHTML = `<div class="dh"><div><div class="sub">${j.ref}, ${esc(TH.trade(j.trade).name)}</div><h3>${esc(j.title)}</h3><div style="margin-top:8px">${state(j.status)}</div></div><button class="x" id="dx" aria-label="Close">${I('close', 16)}</button></div>
        <div class="db">
          <section><dl class="dl-grid"><dt>Customer</dt><dd>${esc(c.name)} <span class="muted">${esc(c.kind)}</span></dd><dt>Where</dt><dd>${esc(j.area)}, ${esc(j.postcode)}</dd>
            <dt>Posted</dt><dd>${TH.ago(j.postedAt)}</dd><dt>${j.dayRate ? 'Day rate' : 'Budget'}</dt><dd>${esc(TH.priceLabel(j))}</dd>
            <dt>Start date</dt><dd>${j.start ? TH.dayLabel(j.start) : esc(j.when)}</dd>${j.duration ? `<dt>Duration</dt><dd>${esc(j.duration)}</dd>` : ''}
            ${h ? `<dt>Hired</dt><dd>${esc(h.name)}, ${TH.money(j.agreed)} agreed</dd>` : ''}${j.scheduledFor && j.status !== 'done' ? `<dt>Booked for</dt><dd>${TH.dayLabel(j.scheduledFor)}, ${TH.clock(j.scheduledFor)}</dd>` : ''}
            <dt>Seen by</dt><dd>${j.views} trades</dd></dl></section>
          ${j.desc ? `<section><div class="lbl">Description</div><p style="margin:0;color:var(--text-2)">${esc(j.desc)}</p></section>` : ''}
          ${j.review ? `<section><div class="lbl">Review</div><div>${'★'.repeat(j.review.stars)}<span class="muted">${'★'.repeat(5 - j.review.stars)}</span></div><p style="margin:6px 0 0;color:var(--text-2)">${esc(j.review.text)}</p></section>` : ''}
          <section><div class="lbl">${j.applications.length} ${j.applications.length === 1 ? 'application' : 'applications'}</div>
            <div class="apps">${j.applications.length ? j.applications.map((a) => { const t = TH.trader(a.traderId); return `<div class="a">${av(t)}<div><div style="font-weight:500">${esc(t.name)} <span class="sub">${esc(t.business)}, ${TH.milesLabel(TH.miles(t.pos, j.pos))}</span></div>${a.message ? `<p>${esc(a.message)}</p>` : ''}<div class="sub" style="margin-top:4px">${TH.ago(a.at)}${a.status !== 'pending' ? ', ' + a.status : ''}</div></div><div class="q num">${TH.money(a.quote)}</div></div>`; }).join('') : '<p class="muted" style="margin:0">Nobody yet. Nearby trades have been told.</p>'}</div></section>
          ${convos.length ? `<section><div class="lbl">Conversations</div><div class="tabs">${convos.map((tid) => `<button data-tab="${tid}" class="${tid === drawer.tab ? 'on' : ''}">${esc(TH.trader(tid).name)}</button>`).join('')}</div>${threadHTML(TH.thread(j.id, drawer.tab))}</section>` : ''}
        </div>`;
      $$('[data-tab]', el).forEach((b) => b.onclick = () => { drawer.tab = b.dataset.tab; renderDrawer(); });
    } else {
      const t = TH.trader(drawer.id); if (!t) return closeDrawer();
      const work = S().jobs.filter((j) => j.hiredId === t.id).sort((a, b) => (b.doneAt || b.postedAt) - (a.doneAt || a.postedAt));
      const earned = work.filter((j) => j.status === 'done').reduce((a, j) => a + (j.agreed || 0), 0);
      el.innerHTML = `<div class="dh">${av(t, 'lg')}<div><h3>${esc(t.name)}</h3><div class="sub">${esc(t.business)}, ${esc(TH.trade(t.trade).name)} in ${esc(t.area)}</div><div style="margin-top:8px">${traderState(t)}</div></div><button class="x" id="dx" aria-label="Close">${I('close', 16)}</button></div>
        <div class="db">
          <section><p style="margin:0;color:var(--text-2)">${esc(t.about)}</p></section>
          <section><dl class="dl-grid"><dt>Rating</dt><dd class="num">${ratingTxt(t)}</dd><dt>Jobs done</dt><dd class="num">${t.jobsDone}</dd><dt>Replies in</dt><dd>${t.status === 'verified' ? 'About ' + t.responseMins + ' min' : 'n/a'}</dd>
            <dt>Day rate</dt><dd class="num">${TH.money(t.dayRate)}</dd><dt>In the trade</dt><dd>${t.years} years</dd><dt>Joined</dt><dd>${joined(t)}</dd>${earned ? `<dt>Earned here</dt><dd class="num">${TH.money(earned)} <span class="muted">no lead fees</span></dd>` : ''}</dl></section>
          <section><div class="lbl">Checks</div>${t.docs.map((d) => `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--line)">${I(d.status === 'approved' ? 'check' : d.status === 'rejected' ? 'close' : 'clock', 16)}<div><div>${esc(d.type)}</div><div class="sub">${esc(d.detail)}</div></div></div>`).join('')}</section>
          ${work.length ? `<section><div class="lbl">Work through Trade Hunter</div>${work.slice(0, 6).map((j) => `<div style="display:flex;gap:12px;padding:9px 0;border-top:1px solid var(--line)"><div style="flex:1"><div>${esc(j.title)}</div><div class="sub">${esc(TH.customer(j.customerId).name)}, ${esc(j.area)}</div></div><div style="text-align:right"><div class="num">${TH.money(j.agreed)}</div>${state(j.status)}</div></div>`).join('')}</section>` : ''}
          <section style="display:flex;gap:10px;flex-wrap:wrap">${t.status === 'pending' ? `<a class="btn primary" href="#verification" id="goverify">Review documents</a>`
            : t.status === 'verified' ? `<button class="btn" id="toggleon">${t.online ? 'Set offline' : 'Set online'}</button>` : ''}</section>
        </div>`;
      const gv = $('#goverify', el); if (gv) gv.onclick = () => { verifySel = t.id; verifyDoc = 0; closeDrawer(); };
      const to = $('#toggleon', el); if (to) to.onclick = () => TH.setOnline(t.id, !t.online);
    }
    $('#dx', el).onclick = closeDrawer;
  }

  /* ---------- router ---------- */
  function renderView() {
    const v = VIEWS.find((x) => x.id === view);
    $('#title').textContent = v.label; $('#lede').textContent = v.lede;
    document.title = (view === 'overview' ? '' : v.label + ', ') + 'Trade Hunter HQ';
    renderNav(); renderMeta();
    const root = $('#view');
    if (map && view !== 'overview') { map.remove(); map = null; }
    const html = { overview: overviewHTML, verification: verificationHTML, jobs: jobsHTML, trades: tradesHTML, reports: reportsHTML, areas: areasHTML, grow: growHTML }[view]();
    if (view === 'overview' && map) { updateOverview(); return; }
    root.innerHTML = `<div class="view ${renderView.last === view ? 'still' : ''}">${html}</div>`;
    renderView.last = view;
    if (view === 'overview') {
      renderChart.drawn = false;
      initMap(); updateOverview();
      $('#tbltoggle').onclick = (e) => { showTable = !showTable; e.target.textContent = showTable ? 'View as chart' : 'View as table'; renderChart.drawn = true; renderChart(); };
    }
    if (view === 'jobs') bindJobs();
    if (view === 'trades') bindTrades();
    if (view === 'verification') bindVerification();
    if (view === 'reports') bindReports();
    if (view === 'grow') bindGrow();
  }
  function refresh() {
    renderNav();
    if (view === 'overview' && map) updateOverview();
    else if (view === 'jobs') renderJobRows();
    else if (view === 'trades') renderTradeRows();
    else renderView();
    renderDrawer();
  }
  function route() {
    const [v, arg] = location.hash.replace('#', '').split('/');
    const next = VIEWS.some((x) => x.id === v) ? v : 'overview';
    if (next !== view || !$('#view').children.length) { view = next; if (map) { map.remove(); map = null; } renderView(); window.scrollTo(0, 0); }
    if (arg && next === 'jobs') { const j = S().jobs.find((x) => x.ref === arg || x.id === arg); if (j) openDrawer('job', j.id); }
    if (arg && next === 'trades') { const t = TH.trader(arg); if (t) openDrawer('trader', t.id); }
    if (arg && next === 'verification' && TH.trader(arg)) { verifySel = arg; verifyDoc = 0; renderView(); }
  }

  $('#mark').innerHTML = TH_LOGO(30);
  $('#scrim').onclick = closeDrawer;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  $('#reset').onclick = () => { grow = growSeed(); saveGrow(); TH.reset(); seenFeed.clear(); seenJobs.clear(); toast('Demo data reset'); };
  window.addEventListener('hashchange', route);
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (view === 'overview') { renderChart.drawn = true; renderChart(); } }, 150); });
  TH.on(refresh);
  setInterval(() => { renderMeta(); if (view === 'overview') renderFeed(); }, 30000);
  route();
})();
