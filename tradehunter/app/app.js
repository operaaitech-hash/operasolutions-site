/* Trade Hunter phone app preview. Customer side and trade side, rendered from the shared store. */
(function () {
  const q = new URLSearchParams(location.search);
  const EMBED = q.has('embed');
  const BARE = !EMBED && matchMedia('(max-width:520px)').matches;
  document.body.classList.toggle('embed', EMBED);
  document.body.classList.toggle('bare', BARE);

  const I = TH_ICON;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = () => TH.get();
  const ME = () => S().me;
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const START = Date.now();

  let mode = q.get('mode') === 'trade' ? 'trade' : q.get('mode') === 'customer' ? 'customer' : (store('th-mode') || 'customer');
  const ui = { homeFilter: 'all', sel: null, jobsSeg: 'active', feedView: 'list', feedRadius: 10, feedScope: 'mine', workSeg: 'applied' };
  const seenApps = new Set(), seenJobs = new Set(), toasted = new Set();
  function markSeen() {
    S().jobs.forEach((j) => { seenJobs.add(j.id); j.applications.forEach((a) => seenApps.add(j.id + '|' + a.traderId)); });
  }
  markSeen();
  S().notes.forEach((n) => toasted.add(n.id));

  /* ---------- shell ---------- */
  const root = $('#app');
  root.innerHTML = '<div class="stack" id="stack"></div><nav class="tabs" id="tabs"></nav><div class="dim" id="dim"></div><div class="bsheet" id="bsheet"></div><div class="toast" id="toast"></div><div class="confetti" id="confetti"></div>' +
    '<div class="splash" id="splash"><div class="in">' + TH_LOCKUP(250) + '</div></div>';
  const $stack = $('#stack'), $tabs = $('#tabs');
  setTimeout(() => $('#splash').classList.add('go'), EMBED ? 700 : 1300);

  const clockEl = $('#clock');
  const tickClock = () => { const d = new Date(); clockEl.textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  tickClock(); setInterval(tickClock, 15000);

  /* ---------- atoms ---------- */
  const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
  const myPosterId = () => (mode === 'customer' ? ME().customerId : ME().tradeCustomerId);
  const meCustomer = () => TH.customer(myPosterId());
  const sideFor = (j) => (j.customerId === myPosterId() ? 'c' : 't');
  const meTrader = () => TH.trader(ME().traderId);
  const mePos = () => { const a = TH.AREAS[meCustomer().area]; return [a[0], a[1]]; };
  const first = (name) => name.split(' ')[0];
  const shortName = (name) => { const p = name.split(' '); return p.length > 1 && !/Ltd|Lettings|Property|Builders|Electrical|Kitchens/.test(name) ? p[0] + ' ' + p[1][0] + '.' : name; };
  function av(name, tone, cls, online) { return '<div class="av ' + (cls || '') + '" style="--tone:' + (tone || '#2B2E33') + '">' + esc(TH.initials(name)) + (online ? '<i class="on"></i>' : '') + '</div>'; }
  const tic = (trade, cls) => '<div class="tic ' + (cls || '') + '">' + I(TH.trade(trade).icon, cls === 's' ? 17 : 20) + '</div>';
  const stars = (r, n) => '<span class="stars">' + I('star', 14) + (r ? r.toFixed(1) : 'New') + (n != null ? '<span class="muted" style="font-weight:500">(' + n + ')</span>' : '') + '</span>';
  const verified = '<span class="vf">' + I('shield', 14) + 'Verified</span>';
  const founding = (t, num) => t && t.founding ? '<span class="fm">' + TH_MARK(14) + 'Founding member' + (num ? ' #' + t.foundingNo : '') + '</span>' : '';
  const custRating = (c) => c && c.ratings ? '<span class="stars">' + I('star', 13) + c.rating.toFixed(1) + '<span class="muted" style="font-weight:500">(' + c.ratings + ' trade' + (c.ratings > 1 ? 's' : '') + ')</span></span>' + (c.paidOnTime ? '<span class="vf">' + I('check', 13) + 'Pays on time</span>' : '') : '';
  const tomorrow8 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.getTime(); };
  const share = (text) => 'https://wa.me/?text=' + encodeURIComponent(text);
  const bell = (to) => { const n = S().notes.filter((x) => x.to === to && !x.read).length; return '<button class="ib" data-act="notes">' + I('bell', 20) + (n ? '<span class="badge">' + n + '</span>' : '') + '</button>'; };
  const whenLabel = (j) => (j.scheduledFor && j.status !== 'open' && j.status !== 'done') ? TH.dayLabel(j.scheduledFor) + ' at ' + TH.clock(j.scheduledFor) : j.start ? 'Starts ' + TH.dayLabel(j.start).replace(/^(Today|Tomorrow)$/, (m) => m.toLowerCase()) : j.when;

  /* ---------- maps ---------- */
  function makeMap(el, center, zoom, opts) {
    const m = L.map(el, Object.assign({ zoomControl: false, attributionControl: true, zoomSnap: 0.25 }, opts || {})).setView(center, zoom);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, maxZoom: 18, className: 'tiles-base', attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap' }).addTo(m);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 16, maxZoom: 18, className: 'tiles-ref' }).addTo(m);
    m.attributionControl.setPrefix(false);
    setTimeout(() => m.invalidateSize(), 600); setTimeout(() => m.invalidateSize(), 1300);
    return m;
  }
  const tIcon = (t, sel) => L.divIcon({ className: '', html: '<div class="tpin-wrap" style="--d:' + ((parseInt(t.id.slice(1), 10) % 9) * 0.33) + 's"><div class="tpin' + (sel ? ' sel' : '') + '">' + I(TH.trade(t.trade).icon, 17) + '</div></div>', iconSize: [34, 34], iconAnchor: [17, 17] });
  const jIcon = (j, isNew) => L.divIcon({ className: '', html: '<div class="jpin' + (isNew ? ' new' : '') + '">' + I(TH.trade(j.trade).icon, 16) + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] });
  const meIcon = () => L.divIcon({ className: '', html: '<div class="mepin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });

  /* ---------- router ---------- */
  const stack = [];
  const top = () => stack[stack.length - 1];
  function build(name, params, opts) {
    const def = SCREENS[name];
    const el = document.createElement('section');
    el.className = 'scr' + (def.modal ? ' modal' : '');
    if (opts && opts.cls) el.classList.add(...opts.cls);
    if (opts && opts.before) $stack.insertBefore(el, opts.before); else $stack.appendChild(el);
    el.innerHTML = def.render(params || {});
    const entry = { name, params: params || {}, el, def, ctx: {} };
    def.mount && def.mount(el, entry.params, entry.ctx);
    return entry;
  }
  function destroy(e) { e.def.unmount && e.def.unmount(e.el, e.params, e.ctx); e.el.remove(); }
  function push(name, params) {
    const prev = top();
    const e = build(name, params, { cls: ['enter'] });
    e.el.getBoundingClientRect();
    requestAnimationFrame(() => { e.el.classList.remove('enter'); if (prev && !e.def.modal) prev.el.classList.add('under'); });
    stack.push(e);
    syncTabs();
  }
  function pop() {
    if (stack.length < 2) return;
    const cur = stack.pop();
    cur.el.classList.add('leave');
    top().el.classList.remove('under');
    refresh(top());
    setTimeout(() => destroy(cur), 520);
    syncTabs();
  }
  function setRoot(name, params, fade) {
    while (stack.length) destroy(stack.pop());
    const e = build(name, params, { cls: fade ? ['fade', 'enter'] : [] });
    if (fade) requestAnimationFrame(() => requestAnimationFrame(() => e.el.classList.remove('enter')));
    stack.push(e);
    syncTabs();
  }
  function refresh(e) {
    if (!e || e.def.static) return;
    if (e.def.refresh) return e.def.refresh(e.el, e.params, e.ctx);
    const sc = $('.scroll', e.el), y = sc ? sc.scrollTop : 0;
    e.el.innerHTML = e.def.render(e.params);
    e.def.mount && e.def.mount(e.el, e.params, e.ctx);
    const sc2 = $('.scroll', e.el); if (sc2) sc2.scrollTop = y;
  }

  /* ---------- tabs ---------- */
  const TABS = {
    customer: [['home', 'map', 'Explore'], ['jobs', 'briefcase', 'My jobs'], ['+post', 'plus', ''], ['inbox', 'chat', 'Messages'], ['cacct', 'user', 'Account']],
    trade: [['feed', 'search', 'Find work'], ['work', 'briefcase', 'My work'], ['+post', 'plus', ''], ['inbox', 'chat', 'Messages'], ['tacct', 'user', 'Account']],
  };
  function syncTabs() {
    const rootName = stack[0] && stack[0].name;
    $tabs.innerHTML = TABS[mode].map(([id, icon, label]) => id === '+post'
      ? '<button data-act="post" aria-label="Post a job"><span class="post">' + I('plus', 22) + '</span></button>'
      : '<button data-tab="' + id + '" class="' + (rootName === id ? 'on' : '') + '">' + I(icon, 22) + label + (tabDot(id) ? '<i class="dot"></i>' : '') + '</button>').join('');
    $tabs.classList.toggle('hide', stack.length > 1);
  }
  function tabDot(id) {
    const s = S(), me = ME();
    if (mode === 'trade' && id === 'work' && s.jobs.some((j) => j.customerId === me.tradeCustomerId && j.status === 'open' && j.applications.some((a) => !seenApps.has(j.id + '|' + a.traderId)))) return true;
    if (mode === 'customer' && id === 'jobs') return s.jobs.some((j) => j.customerId === me.customerId && j.status === 'open' && j.applications.some((a) => !seenApps.has(j.id + '|' + a.traderId)));
    if (mode === 'trade' && id === 'feed') return s.jobs.some((j) => !seenJobs.has(j.id) && j.status === 'open');
    return false;
  }

  /* ---------- sheets, toasts, confetti ---------- */
  const $dim = $('#dim'), $bs = $('#bsheet');
  function openSheet(html, mount) { $bs.innerHTML = html; $dim.classList.add('show'); $bs.classList.add('show'); mount && mount($bs); }
  function closeSheet() { $dim.classList.remove('show'); $bs.classList.remove('show'); }
  $dim.addEventListener('click', closeSheet);
  let toastTimer;
  function toast(text, link) {
    const t = $('#toast');
    t.innerHTML = TH_MARK(34) + '<div class="grow"><b><span>TRADE HUNTER</span><span>now</span></b><p>' + esc(text) + '</p></div>';
    t.onclick = () => { t.classList.remove('show'); if (link) go(link); };
    t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
  }
  function confetti() {
    const c = $('#confetti'); c.innerHTML = '';
    for (let i = 0; i < 36; i++) {
      const p = document.createElement('i');
      p.style.left = (10 + Math.random() * 80) + '%';
      p.style.background = ['#F5EC20', '#F2EFE8', '#F5EC20', '#8E8A80'][i % 4];
      p.style.setProperty('--x', ((Math.random() - 0.5) * 220) + 'px');
      p.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = (Math.random() * 0.25) + 's';
      c.appendChild(p);
    }
    setTimeout(() => { c.innerHTML = ''; }, 2400);
  }
  function go(link) {
    if (!link || !link.job) return;
    const j = TH.job(link.job); if (!j) return;
    if (link.chat) return push('chat', { jobId: j.id, traderId: link.chat });
    push(sideFor(j) === 'c' ? 'cjob' : 'tjob', { id: j.id });
  }
  function countUp(el) {
    $$('[data-count]', el).forEach((n) => {
      const to = +n.dataset.count, pre = n.dataset.pre || '', t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3); n.textContent = pre + Math.round(to * e).toLocaleString('en-GB'); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  /* ---------- shared pieces ---------- */
  function custStatus(j) {
    const t = j.hiredId && TH.trader(j.hiredId);
    if (j.status === 'open') { const n = j.applications.length; return ['open', n ? n + ' application' + (n > 1 ? 's' : '') : 'Waiting for trades to apply']; }
    if (j.status === 'hired') return ['live', 'Booked with ' + first(t.name) + ', ' + TH.dayLabel(j.scheduledFor) + ' ' + TH.clock(j.scheduledFor)];
    if (j.status === 'onway') return ['live', first(t.name) + ' is on the way'];
    if (j.status === 'started') return ['live', 'Work in progress'];
    if (j.status === 'done') return ['done', j.review ? 'Completed, you gave ' + j.review.stars + ' stars' : 'Finished, leave a review'];
    return ['done', j.status];
  }
  function custJobRow(j) {
    const [cls, text] = custStatus(j);
    const fresh = j.applications.some((a) => !seenApps.has(j.id + '|' + a.traderId));
    return '<button class="job" data-go="cjob" data-id="' + j.id + '">' + tic(j.trade) + '<div class="grow"><h3>' + esc(j.title) + '</h3><div class="status ' + cls + '"><i></i>' + esc(text) + (fresh ? ' <span style="color:var(--hi)">New</span>' : '') + '</div><div class="meta" style="margin-top:6px"><span>' + esc(TH.trade(j.trade).name) + '</span><span>' + TH.ago(j.postedAt) + '</span></div></div>' + I('next', 18, 'muted') + '</button>';
  }
  function tradeJobRow(j) {
    const me = meTrader();
    const d = TH.miles(me.pos, j.pos);
    const mine = j.applications.find((a) => a.traderId === me.id);
    const isNew = !seenJobs.has(j.id);
    const c = TH.customer(j.customerId);
    return '<button class="job' + (isNew ? ' newjob' : '') + '" data-go="tjob" data-id="' + j.id + '">' + tic(j.trade) + '<div class="grow"><h3>' + esc(j.title) + '</h3>' +
      '<div class="meta"><span>' + I('pin', 13) + esc(j.area) + ', ' + TH.milesLabel(d) + '</span><span>' + TH.ago(j.postedAt) + '</span>' + (c.kind === 'Trade' ? '<span>' + I('briefcase', 13) + 'Trade job</span>' : '') + '</div>' +
      '<div class="row" style="margin-top:9px;gap:10px"><b style="font-weight:600;font-size:14px">' + esc(TH.priceLabel(j)) + '</b><span class="muted sm grow ell">' + esc(whenLabel(j)) + '</span>' +
      (mine ? '<span class="sm" style="color:var(--hi);font-weight:600">' + (j.hiredId === me.id ? 'Hired' : 'Applied') + '</span>' : '<span class="muted xs">' + j.applications.length + ' applied</span>') + '</div></div></button>';
  }
  function traderRow(t, from) {
    const d = TH.miles(from, t.pos);
    return '<button class="item" data-go="tprofile" data-id="' + t.id + '">' + av(t.name, t.tone, '', t.online) +
      '<div class="grow"><div class="row" style="gap:8px"><b class="ell" style="font-weight:600">' + esc(t.name) + '</b></div><div class="muted sm ell">' + esc(TH.trade(t.trade).name) + ', ' + esc(t.business) + '</div>' +
      '<div class="meta" style="margin-top:4px">' + stars(t.rating, t.reviews) + '<span>' + TH.milesLabel(d) + '</span><span>Replies in ' + t.responseMins + ' min</span></div></div></button>';
  }
  function appCard(j, a) {
    const t = TH.trader(a.traderId), key = j.id + '|' + a.traderId, fresh = !seenApps.has(key);
    seenApps.add(key);
    const d = TH.miles(mePos(), t.pos);
    return '<div class="app' + (fresh ? ' arrive' : '') + '">' +
      '<div class="row">' + av(t.name, t.tone, '', t.online) + '<div class="grow"><b style="font-weight:600">' + esc(t.name) + '</b><div class="muted sm ell">' + esc(t.business) + '</div><div class="meta" style="margin-top:4px">' + stars(t.rating, t.reviews) + '<span>' + TH.milesLabel(d) + '</span></div></div>' +
      '<div class="q">' + TH.money(a.quote) + '<small>' + (j.dayRate ? 'a day' : 'quoted') + '</small></div></div>' +
      '<p>' + esc(a.message) + '</p>' +
      '<div class="meta" style="margin:-4px 0 14px">' + verified + (t.accred ? '<span>' + esc(t.accred) + '</span>' : '') + '<span>' + t.jobsDone + ' jobs</span>' + founding(t) + '</div>' +
      '<div class="acts"><button class="star-btn ' + (a.status === 'shortlisted' ? 'on' : '') + '" data-act="shortlist" data-job="' + j.id + '" data-t="' + t.id + '" aria-label="Shortlist">' + I('star', 18) + '</button>' +
      '<button class="btn dk sm" data-go="tprofile" data-id="' + t.id + '" data-job="' + j.id + '">Profile</button>' +
      '<button class="btn dk sm" data-go="chat" data-job="' + j.id + '" data-t="' + t.id + '">Message</button>' +
      '<button class="btn hi sm" data-act="hire" data-job="' + j.id + '" data-t="' + t.id + '">Hire</button></div></div>';
  }
  const REVIEW_BANK = [
    ['Claire W.', 5, 'Turned up when he said he would, kept us updated and left the place spotless.'],
    ['Mike R.', 5, 'Fair price, quality work and no upselling. Booked again for next month.'],
    ['Anita P.', 4, 'Good job overall. Needed a second visit for a part but sorted it quickly.'],
    ['Joe H.', 5, 'Really knows his stuff. Explained everything and gave us options.'],
  ];
  function reviewsFor(t) {
    const real = S().jobs.filter((j) => j.hiredId === t.id && j.review).sort((a, b) => b.review.at - a.review.at)
      .map((j) => [shortName(TH.customer(j.customerId).name), j.review.stars, j.review.text, TH.ago(j.review.at)]);
    const extra = t.reviews ? REVIEW_BANK.slice(0, Math.max(0, 3 - real.length)).map((r, i) => r.concat([(i + 2) + ' weeks ago'])) : [];
    return real.concat(extra);
  }
  function tracker(j) {
    const order = ['hired', 'onway', 'started', 'done'], idx = order.indexOf(j.status);
    return '<div class="track">' + ['Booked', 'On the way', 'Working', 'Done'].map((l, i) => '<div class="' + (i <= idx ? 'done' : '') + '"><b></b><span>' + l + '</span></div>').join('') + '</div>';
  }

  /* ---------- screens ---------- */
  const SCREENS = {};

  /* Customer: explore map */
  SCREENS.home = {
    render() {
      const me = meCustomer();
      const tradesOnline = TH.TRADES.filter((tr) => S().traders.some((t) => t.trade === tr.id && t.online && t.status === 'verified'));
      return '<div class="mapwrap"><div class="lmap"></div></div>' +
        '<div class="hometop"><div class="hello">' + TH_MARK(36) + '<div class="grow"><div class="muted sm">' + greet() + '</div><h1>' + esc(first(me.name)) + '</h1></div><span class="bellslot">' + bell('customer') + '</span></div>' +
        '<button class="urgentbar" data-act="urgent"><i></i><span class="grow">Emergency? <b>Get someone now</b></span>' + I('next', 15) + '</button>' +
        '<button class="searchbar" data-act="post">' + I('search', 20) + 'What do you need doing?</button>' +
        '<div class="chips">' + [['all', 'hammer', 'All trades']].concat(tradesOnline.map((t) => [t.id, t.icon, t.name])).map(([id, ic, n]) => '<button class="chip ' + (ui.homeFilter === id ? 'on' : '') + '" data-act="hfilter" data-id="' + id + '">' + I(ic, 16) + esc(n) + '</button>').join('') + '</div></div>' +
        '<div class="peekcard" id="peek"></div>' +
        '<div class="sheet" id="hsheet"><div class="grab"><h2 id="hcount"></h2><div class="muted sm" style="margin-top:3px">Verified, insured and available now near ' + esc(me.area) + '</div></div>' +
        '<div class="scroll"><div class="pad"><button class="btn hi block" data-act="post" style="margin:12px 0 4px">' + I('plus', 20) + 'Post a job, it\'s free</button><div class="list" id="hlist"></div></div></div></div>';
    },
    mount(el, p, ctx) {
      ctx.map = makeMap($('.lmap', el), [mePos()[0] - 0.012, mePos()[1]], 13.25);
      L.marker(mePos(), { icon: meIcon(), interactive: false }).addTo(ctx.map);
      ctx.markers = new Map();
      ctx.map.on('click', () => { if (ui.sel && ctx.sheetTo) ctx.sheetTo('peek'); ui.sel = null; $('#peek', el).classList.remove('show'); paintMarkers(el, ctx); });
      sheetDrag(el, ctx);
      this.refresh(el, p, ctx, true);
      ctx.drift = setInterval(() => drift(ctx), 3200);
    },
    unmount(el, p, ctx) { clearInterval(ctx.drift); ctx.map && ctx.map.remove(); },
    refresh(el, p, ctx) {
      const list = visibleTraders();
      $('#hcount', el).textContent = list.length + (list.length === 1 ? ' trade' : ' trades') + ' available near you';
      $('#hlist', el).innerHTML = list.slice(0, 30).map((t) => traderRow(t, mePos())).join('') || '<div class="empty">No one online for this trade right now. Post the job and we\'ll send it to them.</div>';
      $('.bellslot', el).innerHTML = bell('customer');
      $$('.chip', el).forEach((c) => c.classList.toggle('on', c.dataset.id === ui.homeFilter));
      paintMarkers(el, ctx);
    },
  };
  function visibleTraders() {
    const from = mePos();
    return S().traders.filter((t) => t.status === 'verified' && t.online && (ui.homeFilter === 'all' || t.trade === ui.homeFilter))
      .sort((a, b) => TH.miles(from, a.pos) - TH.miles(from, b.pos));
  }
  function paintMarkers(el, ctx) {
    const vis = new Set(visibleTraders().map((t) => t.id));
    ctx.markers.forEach((m, id) => { if (!vis.has(id)) { m.remove(); ctx.markers.delete(id); } });
    vis.forEach((id) => {
      const t = TH.trader(id);
      let m = ctx.markers.get(id);
      if (!m) {
        m = L.marker(t.pos, { icon: tIcon(t, ui.sel === id) }).addTo(ctx.map);
        m.on('click', (e) => { L.DomEvent.stopPropagation(e); ui.sel = id; showPeek(el, t); paintMarkers(el, ctx); });
        m._sel = ui.sel === id; ctx.markers.set(id, m);
      } else if (m._sel !== (ui.sel === id)) { m.setIcon(tIcon(t, ui.sel === id)); m._sel = ui.sel === id; }
    });
  }
  function drift(ctx) {
    if (document.hidden) return;
    ctx.markers.forEach((m, id) => {
      if (Math.random() < 0.55 || id === ui.sel) return;
      const t = TH.trader(id), from = m.getLatLng(), base = t.home || t.pos;
      const to = L.latLng(base[0] + (Math.random() - 0.5) * 0.007, base[1] + (Math.random() - 0.5) * 0.011);
      const t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / 2800), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; m.setLatLng([from.lat + (to.lat - from.lat) * e, from.lng + (to.lng - from.lng) * e]); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }
  function showPeek(el, t) {
    const pk = $('#peek', el), e = stack[0];
    if (e && e.ctx.sheetTo) e.ctx.sheetTo('low');
    pk.style.bottom = ((BARE ? 62 : 92) + 12) + 'px';
    pk.innerHTML = '<div class="row">' + av(t.name, t.tone, '', true) + '<div class="grow"><b style="font-weight:600">' + esc(t.name) + '</b><div class="muted sm ell">' + esc(TH.trade(t.trade).name) + ', ' + esc(t.business) + '</div><div class="meta" style="margin-top:4px">' + stars(t.rating, t.reviews) + '<span>' + TH.milesLabel(TH.miles(mePos(), t.pos)) + '</span>' + verified + '</div></div></div>' +
      '<div class="row" style="margin-top:14px;gap:8px"><button class="btn dk sm" style="flex:1" data-go="tprofile" data-id="' + t.id + '">View profile</button><button class="btn hi sm" style="flex:1" data-act="post" data-trade="' + t.trade + '" data-invite="' + t.id + '">Ask for a quote</button></div>';
    pk.classList.add('show');
  }
  function sheetDrag(el, ctx) {
    const sh = $('#hsheet', el), grab = $('.grab', sh);
    const peekY = () => sh.offsetHeight - (BARE ? 214 : 236);
    ctx.sheetTo = (m) => set(m === 'low' ? sh.offsetHeight - (BARE ? 62 : 92) : peekY(), true);
    const set = (y, anim) => { sh._y = y; sh.style.transition = anim ? '' : 'none'; sh.style.transform = 'translateY(' + y + 'px)'; };
    requestAnimationFrame(() => set(peekY(), false));
    setTimeout(() => set(peekY(), true), 650);
    let y0 = null, s0 = 0, moved = 0;
    grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; s0 = sh._y || 0; moved = 0; grab.setPointerCapture(e.pointerId); });
    grab.addEventListener('pointermove', (e) => { if (y0 == null) return; const dy = e.clientY - y0; moved = Math.max(moved, Math.abs(dy)); set(Math.max(0, Math.min(peekY() + 60, s0 + dy)), false); });
    grab.addEventListener('pointerup', (e) => {
      if (y0 == null) return;
      const dy = e.clientY - y0; y0 = null;
      if (moved < 6) set((sh._y || 0) > 10 ? 0 : peekY(), true);
      else set(dy < 0 ? 0 : peekY(), true);
      $('#peek', el).classList.remove('show');
    });
  }

  /* Customer: my jobs */
  SCREENS.jobs = {
    render() {
      const mine = S().jobs.filter((j) => j.customerId === ME().customerId);
      const act = mine.filter((j) => j.status !== 'done' || !j.review), past = mine.filter((j) => j.status === 'done' && j.review);
      const list = ui.jobsSeg === 'active' ? act : past;
      return '<div class="top"><div class="grow"><h1>My jobs</h1></div>' + bell('customer') + '<button class="ib" data-act="post" style="background:var(--hi);color:var(--hi-ink)">' + I('plus', 20) + '</button></div>' +
        '<div class="pad" style="margin-bottom:6px"><div class="seg"><button class="' + (ui.jobsSeg === 'active' ? 'on' : '') + '" data-act="jseg" data-id="active">Active (' + act.length + ')</button><button class="' + (ui.jobsSeg === 'past' ? 'on' : '') + '" data-act="jseg" data-id="past">Completed (' + past.length + ')</button></div></div>' +
        '<div class="scroll"><div class="pad list">' + (list.map(custJobRow).join('') || '<div class="empty">Nothing here yet.</div>') + '</div>' +
        '<div class="pad"><div class="card" style="margin-top:16px;display:flex;gap:14px;align-items:center">' + TH_MARK(40) + '<div class="grow"><b style="font-weight:600">Free to post, free to hire</b><div class="muted sm">No booking fees and no commission. You agree the price with your trade.</div></div></div></div></div>';
    },
  };

  /* Customer: job detail */
  SCREENS.cjob = {
    render(p) {
      const j = TH.job(p.id); if (!j) return '';
      const [cls, text] = custStatus(j);
      let body = '';
      if (j.status === 'open') {
        const apps = j.applications.slice().sort((a, b) => (b.status === 'shortlisted') - (a.status === 'shortlisted') || a.at - b.at);
        const near = S().traders.filter((t) => t.trade === j.trade && t.status === 'verified' && TH.miles(t.pos, j.pos) < 12).length;
        const shareText = (j.dayRate ? TH.trade(j.trade).name + ' needed, ' + j.area + ', ' + whenLabel(j).toLowerCase() + ', ' + TH.money(j.dayRate) + ' a day.' : j.title + ' in ' + j.area + '.') + ' Apply free on Trade Hunter: tradehunter.app/j/' + j.ref;
        body = (j.repeat ? '<div class="note" style="margin-top:14px">' + I('refresh', 17) + '<span>Reposts every Monday at 7am. Your crew sees it first.</span></div>' : '') +
          '<a class="sharebar" href="' + share(shareText) + '" target="_blank" rel="noopener" data-act="sharejob">' + I('send', 18) + '<div class="grow"><b>Share to your WhatsApp groups</b><span>More eyes, faster replies. Free to apply.</span></div>' + I('next', 16) + '</a>' +
          '<div class="h2">Applications<small>' + (apps.length ? apps.length + ' so far' : '') + '</small></div>' +
          (apps.length ? apps.map((a) => appCard(j, a)).join('') : '') +
          (apps.length < 3 ? '<div class="radar" style="height:' + (apps.length ? 150 : 200) + 'px"><i></i><i></i><i></i><div class="core">' + I(TH.trade(j.trade).icon, 28) + '</div></div><p class="muted sm" style="text-align:center;margin-top:-4px">Sent to ' + near + ' verified ' + esc(TH.trade(j.trade).name.toLowerCase()) + (near === 1 ? '' : 's') + ' near ' + esc(j.area) + '. Most jobs get their first application within the hour.</p>' : '');
      } else {
        const t = TH.trader(j.hiredId);
        body = tracker(j) +
          '<div class="card" style="margin-top:14px"><div class="row">' + av(t.name, t.tone) + '<div class="grow"><b style="font-weight:600">' + esc(t.name) + '</b><div class="muted sm">' + esc(t.business) + '</div><div class="meta" style="margin-top:4px">' + stars(t.rating, t.reviews) + verified + '</div></div><div class="q" style="font-family:var(--display);font-weight:600;font-size:22px;text-align:right">' + TH.money(j.agreed) + '<div class="muted" style="font:500 11px var(--body)">agreed</div></div></div>' +
          (j.status !== 'done' && j.scheduledFor ? '<div class="row" style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">' + I('clock', 18, 'muted') + '<span class="grow">' + TH.dayLabel(j.scheduledFor) + ' at ' + TH.clock(j.scheduledFor) + '</span></div>' : '') +
          '<div class="row" style="margin-top:14px;gap:8px"><button class="btn dk sm" style="flex:1" data-go="chat" data-job="' + j.id + '" data-t="' + t.id + '">' + I('chat', 17) + 'Message</button><button class="btn dk sm" style="flex:1" data-act="call" data-t="' + t.id + '">' + I('phone', 17) + 'Call</button></div></div>';
        if (j.status !== 'done') body += '<button class="btn line block" style="margin-top:12px" data-act="cdone" data-job="' + j.id + '">Mark the job as finished</button>';
        if (j.status === 'done' && !j.review) body += '<div class="card" style="margin-top:14px;text-align:center"><h3 style="font-size:19px">How did ' + esc(first(t.name)) + ' do?</h3><p class="muted sm" style="margin-top:4px">Your review helps other people hire with confidence.</p><div class="rstars" id="rstars">' + [1, 2, 3, 4, 5].map((n) => '<button data-act="rstar" data-n="' + n + '">' + I('star', 34) + '</button>').join('') + '</div><label class="fld" style="margin-top:4px;text-align:left"><textarea id="rtext" placeholder="What went well?" style="min-height:80px"></textarea></label><button class="btn hi block" style="margin-top:12px" data-act="review" data-job="' + j.id + '" disabled id="rsend">Post review</button></div>';
        if (j.review) body += '<div class="card" style="margin-top:14px"><div class="row"><b class="grow" style="font-weight:600">Your review</b><span class="stars">' + '★★★★★'.slice(0, j.review.stars).split('').map(() => I('star', 15)).join('') + '</span></div><p class="t2" style="margin-top:8px;font-size:14px">' + esc(j.review.text) + '</p></div>';
      }
      return '<div class="nav"><button class="ib" data-act="back">' + I('back', 20) + '</button><div class="t">' + esc(j.ref) + '</div><button class="ib ghost">' + I('settings', 19) + '</button></div>' +
        '<div class="scroll"><div class="pad"><div class="row" style="gap:10px;margin:6px 0 12px">' + tic(j.trade, 's') + '<span class="muted sm">' + esc(TH.trade(j.trade).name) + '</span></div>' +
        '<h1 style="font-size:26px">' + esc(j.title) + '</h1><div class="status ' + cls + '" style="margin:10px 0 18px"><i></i>' + esc(text) + '</div>' +
        (j.status === 'open'
          ? '<div class="kv"><div><span>' + (j.dayRate ? 'Day rate' : 'Budget') + '</span><b>' + esc(TH.priceLabel(j)) + '</b></div><div><span>When</span><b>' + esc(whenLabel(j)) + '</b></div><div><span>Where</span><b>' + esc(j.area + ', ' + j.postcode.split(' ')[0]) + '</b></div><div><span>Posted</span><b>' + TH.ago(j.postedAt) + '</b></div></div>'
          : '<div class="kv"><div><span>' + (j.status === 'done' ? 'Finished' : 'Booked for') + '</span><b>' + esc(j.status === 'done' ? TH.dayLabel(j.doneAt || Date.now()) : TH.dayLabel(j.scheduledFor) + ', ' + TH.clock(j.scheduledFor)) + '</b></div><div><span>Agreed</span><b>' + TH.money(j.agreed) + (j.dayRate ? ' a day' : '') + '</b></div><div><span>Where</span><b>' + esc(j.area + ', ' + j.postcode.split(' ')[0]) + '</b></div><div><span>Reference</span><b>' + esc(j.ref) + '</b></div></div>') +
        (j.desc ? '<p class="t2" style="margin-top:14px;font-size:14.5px">' + esc(j.desc) + '</p>' : '') +
        (j.photos && j.photos.length ? '<div class="photos" style="margin-top:14px">' + j.photos.map((s) => '<div class="ph" style="background-image:url(' + s + ')"></div>').join('') + '</div>' : '') +
        body + '</div></div>';
    },
    mount() { syncTabs(); },
  };

  /* Trader profile (seen by customers, and by Dan as his public profile) */
  SCREENS.tprofile = {
    render(p) {
      const t = TH.trader(p.id), j = p.job && TH.job(p.job);
      const app = j && j.applications.find((a) => a.traderId === t.id);
      const revs = reviewsFor(t);
      const own = mode === 'trade';
      return '<div class="nav"><button class="ib" data-act="back">' + I('back', 20) + '</button><div class="t"></div><button class="ib ghost">' + I('send', 19) + '</button></div>' +
        '<div class="scroll"><div class="phero">' + av(t.name, t.tone, 'lg', t.online) + '<h1>' + esc(t.name) + '</h1><div class="muted" style="margin-top:4px">' + esc(TH.trade(t.trade).name) + ', ' + esc(t.business) + '</div>' +
        '<div class="row" style="justify-content:center;gap:14px;margin-top:10px">' + stars(t.rating, t.reviews) + verified + '</div>' +
        (t.founding ? '<div style="margin-top:10px">' + founding(t, true) + '</div>' : '') +
        '<div class="figs"><div><b>' + t.jobsDone + '</b><span>Jobs done</span></div><div><b>' + t.years + ' yrs</b><span>In the trade</span></div><div><b>' + t.responseMins + ' min</b><span>Replies in</span></div></div></div>' +
        '<div class="pad"><div class="h2">Checked by Trade Hunter</div><div class="list">' +
        t.docs.map((d) => '<div class="check">' + I(d.status === 'approved' ? 'shield' : 'clock', 20) + '<div><b>' + esc(d.type === 'Accreditation' ? d.detail : d.type) + '</b><span>' + esc(d.type === 'Accreditation' ? 'Membership checked with the scheme' : d.detail) + '</span></div></div>').join('') +
        '<div class="check">' + I('pin', 20) + '<div><b>Based in ' + esc(t.area) + '</b><span>Covers about 10 miles. Member since ' + esc(t.since) + '</span></div></div></div>' +
        '<div class="h2">About</div><p class="t2" style="font-size:14.5px">' + esc(t.about) + '</p>' +
        (t.dayRate ? '<p class="muted sm" style="margin-top:10px">Day rate from ' + TH.money(t.dayRate) + '</p>' : '') +
        '<div class="h2">Reviews<small>' + t.reviews + ' total</small></div><div class="list">' +
        (revs.length ? revs.map((r) => '<div class="rev"><div class="row"><b class="grow" style="font-weight:600">' + esc(r[0]) + '</b><span class="stars">' + Array.from({ length: r[1] }, () => I('star', 13)).join('') + '</span></div><p>' + esc(r[2]) + '</p><div class="muted xs" style="margin-top:6px">' + esc(r[3]) + '</div></div>').join('') : '<p class="muted sm" style="padding:10px 0">No reviews yet.</p>') +
        '</div></div></div>' +
        (own ? '' : '<div class="bottombar">' + (app && j.status === 'open'
          ? '<button class="btn dk" data-go="chat" data-job="' + j.id + '" data-t="' + t.id + '">Message</button><button class="btn hi" data-act="hire" data-job="' + j.id + '" data-t="' + t.id + '">Hire for ' + TH.money(app.quote) + '</button>'
          : '<button class="btn hi" data-act="post" data-trade="' + t.trade + '" data-invite="' + t.id + '">Ask ' + esc(first(t.name)) + ' for a quote</button>') + '</div>');
    },
  };

  /* Messages */
  function threadsFor() {
    const s = S(), me = ME(), out = [];
    Object.keys(s.threads).forEach((k) => {
      const [jobId, traderId] = k.split('|'); const j = TH.job(jobId); const msgs = s.threads[k];
      if (!j || !msgs.length) return;
      if (mode === 'customer' && j.customerId !== me.customerId) return;
      if (mode === 'trade' && traderId !== me.traderId && j.customerId !== me.tradeCustomerId) return;
      out.push({ j, t: TH.trader(traderId), last: msgs[msgs.length - 1] });
    });
    return out.sort((a, b) => b.last.at - a.last.at);
  }
  SCREENS.inbox = {
    render() {
      const th = threadsFor();
      return '<div class="top"><div class="grow"><h1>Messages</h1></div>' + bell(mode) + '</div>' +
        '<div class="scroll"><div class="pad list">' + (th.map(({ j, t, last }) => {
          const sd = sideFor(j), other = sd === 'c' ? { name: t.name, tone: t.tone } : { name: TH.customer(j.customerId).name, tone: '#2E2F2A' };
          const txt = last.kind === 'quote' ? 'Quote, ' + TH.money(last.amount) : last.text;
          return '<button class="item" data-go="chat" data-job="' + j.id + '" data-t="' + t.id + '">' + av(other.name, other.tone) + '<div class="grow"><div class="row"><b class="grow ell" style="font-weight:600">' + esc(sd === 'c' ? other.name : shortName(other.name)) + '</b><span class="muted xs">' + TH.ago(last.at) + '</span></div><div class="muted xs ell" style="margin:1px 0 2px">' + esc(j.title) + '</div><div class="t2 sm ell">' + (last.from === sd ? 'You: ' : '') + esc(txt) + '</div></div></button>';
        }).join('') || '<div class="empty">No messages yet. Conversations start when a trade applies to your job.</div>') + '</div></div>';
    },
  };
  SCREENS.chat = {
    render(p) {
      const j = TH.job(p.jobId), t = TH.trader(p.traderId);
      const sd = sideFor(j), other = sd === 'c' ? { name: t.name, tone: t.tone, sub: t.business } : { name: TH.customer(j.customerId).name, tone: '#2E2F2A', sub: j.area };
      return '<div class="nav"><button class="ib" data-act="back">' + I('back', 20) + '</button><div class="t row" style="justify-content:center;gap:10px">' + av(other.name, other.tone, 's') + '<div style="text-align:left;min-width:0"><div class="ell">' + esc(sd === 'c' ? other.name : shortName(other.name)) + '</div><div class="muted xs ell" style="font-weight:500">' + esc(j.title) + '</div></div></div><button class="ib ghost" data-act="call" data-t="' + t.id + '">' + I('phone', 19) + '</button></div>' +
        '<div class="msgs" id="msgs"></div>' +
        '<div class="composer">' + (sd === 't' ? '<button class="ib" data-act="quote" data-job="' + j.id + '" aria-label="Send a quote">' + I('pound', 20) + '</button>' : '') +
        '<input id="cinput" placeholder="Message" autocomplete="off"><button class="send" data-act="send" data-job="' + j.id + '" data-t="' + t.id + '">' + I('send', 19) + '</button></div>';
    },
    mount(el, p, ctx) {
      ctx.count = 0;
      this.refresh(el, p, ctx);
      $('#cinput', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(el, p); });
    },
    refresh(el, p, ctx) {
      const j = TH.job(p.jobId), msgs = TH.thread(p.jobId, p.traderId), side = sideFor(j);
      const box = $('#msgs', el);
      const typing = S().sims.some((x) => x.kind === 'reply' && x.jobId === p.jobId && x.traderId === p.traderId) && side === 'c';
      box.innerHTML = msgs.map((m, i) => {
        const anim = i >= ctx.count ? '' : ' style="animation:none"';
        if (m.from === 'sys') return '<div class="bub sys"' + anim + '>' + esc(m.text) + '</div>';
        const who = m.from === side ? 'me' : 'them';
        if (m.kind === 'quote') return '<div class="qcard ' + who + '"' + anim + '><div class="muted xs" style="font-weight:600;letter-spacing:.04em">QUOTE</div><div class="amt">' + TH.money(m.amount) + '</div><p>' + esc(m.text) + '</p>' +
          (m.accepted ? '<div class="ok">' + I('check', 16) + 'Accepted</div>' : (who === 'them' && side === 'c' && j.status === 'open' ? '<button class="btn hi sm block" data-act="accept" data-job="' + j.id + '" data-t="' + p.traderId + '" data-i="' + i + '">Accept quote</button>' : '<div class="muted sm">Waiting for a reply</div>')) + '</div>';
        return '<div class="bub ' + who + '"' + anim + '>' + esc(m.text) + '<time>' + TH.clock(m.at) + '</time></div>';
      }).join('') + (typing ? '<div class="typing"><i></i><i></i><i></i></div>' : '');
      ctx.count = msgs.length;
      box.scrollTop = box.scrollHeight;
    },
  };
  function sendMsg(el, p) {
    const inp = $('#cinput', el), v = inp.value.trim(); if (!v) return;
    inp.value = '';
    TH.message(p.jobId, p.traderId, sideFor(TH.job(p.jobId)), v);
  }

  /* Customer: account */
  SCREENS.cacct = {
    render() {
      const c = meCustomer();
      return '<div class="top"><div class="grow"><h1>Account</h1></div></div><div class="scroll"><div class="pad">' +
        '<div class="row" style="padding:6px 0 18px">' + av(c.name, '#33302A', 'lg') + '<div><h2 style="font-size:22px">' + esc(c.name) + '</h2><div class="muted sm">' + esc(c.kind + ', ' + c.area + ' ' + c.postcode.split(' ')[0]) + '</div><div class="meta" style="margin-top:6px">' + custRating(c) + '</div></div></div>' +
        '<button class="card row" data-act="mode" data-mode="trade" style="width:100%;text-align:left">' + TH_MARK(40) + '<div class="grow"><b style="font-weight:600">Open the trade app</b><div class="muted sm">See Trade Hunter as Dan, a local electrician</div></div>' + I('next', 18, 'muted') + '</button>' +
        '<div class="list" style="margin-top:12px">' + [['send', 'Know a good trade? Invite them', 'invite'], ['bell', 'Notifications', 'notes'], ['star', 'Saved trades'], ['home', 'My addresses'], ['shield', 'How we check trades'], ['chat', 'Help and support'], ['doc', 'Terms and privacy']].map(([ic, l, act]) => '<button class="mrow" ' + (act ? 'data-act="' + act + '"' : '') + '>' + I(ic, 20) + '<span class="grow">' + l + '</span>' + I('next', 17) + '</button>').join('') +
        '<button class="mrow" data-act="ideas">' + I('sparkle', 20) + '<span class="grow">Suggest a feature</span>' + I('next', 17) + '</button>' +
        '<button class="mrow" data-act="reset">' + I('refresh', 20) + '<span class="grow">Restart the demo</span></button></div>' +
        '<p class="muted xs" style="margin-top:22px">Trade Hunter Group Ltd. Version 2.0</p></div></div>';
    },
  };

  /* Post a job */
  let pf = null;
  SCREENS.post = {
    modal: true, static: true,
    render(p) {
      const T = mode === 'trade';
      pf = { T, step: p.trade ? 1 : 0, trade: p.trade || null, invite: p.invite || null, title: '', desc: '', photos: [], when: null, budget: null, startLabel: null, startDays: 0, duration: null, dayRate: p.trade === 'labourer' ? 140 : 220 };
      const startOpts = [['Tomorrow', 1], ['The day after', 2], ['Next Monday', ((8 - new Date().getDay()) % 7) || 7], ['Flexible', 0]];
      return '<div class="nav"><button class="ib" data-act="pback">' + I('back', 20) + '</button><div class="t">Post a job</div><button class="ib" data-act="back">' + I('close', 19) + '</button></div>' +
        '<div class="prog"><i id="pbar"></i></div><div class="steps">' +
        '<div class="step" data-s="0"><h2>' + (T ? 'Who do you need?' : 'What do you need?') + '</h2><p class="muted">' + (T ? 'Short on hands? Post it and let local trades come to you. Free.' : 'Pick the trade. You can post as many jobs as you like, free.') + '</p><div class="tgrid">' +
        (T ? [TH.trade('labourer')].concat(TH.TRADES.filter((t) => t.id !== 'labourer')) : TH.TRADES).map((t) => '<button data-act="ptrade" data-id="' + t.id + '">' + I(t.icon, 26) + esc(t.name) + '</button>').join('') + '</div></div>' +
        '<div class="step" data-s="1"><h2>Tell them about it</h2><p class="muted" id="ptradeName"></p>' +
        '<label class="fld"><span>Job title</span><input id="ptitle" maxlength="70" placeholder="e.g. Two sockets need moving"></label>' +
        '<div class="fld"><span>Details</span><div class="voice" id="pvoice"><button class="mic" data-act="voice" aria-label="Describe it out loud">' + I('mic', 22) + '</button><div class="grow"><b id="pvl">Say it instead of typing</b><div class="wave" id="pwave">' + Array.from({ length: 22 }, (_, i) => '<i style="animation-delay:' + (i * 0.06) + 's"></i>').join('') + '</div><span id="pvs">Tap the mic and describe the job</span></div></div>' +
        '<textarea id="pdesc" style="margin-top:8px" placeholder="Or type what\'s the problem, how big is the job, anything they should know?"></textarea></div>' +
        '<div class="fld"><span>Photos <em class="muted" style="font-style:normal;font-weight:500">(optional)</em></span><div class="photos" id="pphotos"><label>' + I('camera', 22) + '<input type="file" accept="image/*" multiple hidden id="pfile"></label></div></div></div>' +
        (T ? '<div class="step" data-s="2"><h2>Start, length and rate</h2><p class="muted">The same details trades see on the map.</p>' +
          '<div class="fld"><span>Start date</span><div class="sgrid" id="pstart">' + startOpts.map(([l, d]) => '<button class="chip" style="background:var(--panel)" data-act="pstart" data-d="' + d + '" data-v="' + l + '">' + l + '</button>').join('') + '</div></div>' +
          '<div class="fld"><span>Duration</span><div class="opts">' + TH.DURATIONS.map((w) => '<button class="opt" data-act="pdur" data-v="' + esc(w) + '">' + esc(w) + '<i></i></button>').join('') + '</div></div>' +
          '<label class="fld"><span>Day rate</span><div class="money"><input id="prate" inputmode="numeric" value="' + pf.dayRate + '"></div></label>' +
          '<div class="fld"><span>Repeat</span><div class="sgrid">' + [['once', 'Just this once'], ['weekly', 'Every week']].map(([v, l]) => '<button class="chip" style="background:var(--panel)" data-act="prepeat" data-v="' + v + '">' + l + '</button>').join('') + '</div></div></div>'
        : '<div class="step" data-s="2"><h2>When and how much?</h2><p class="muted">A rough idea helps trades give you a fair price.</p>' +
        '<div class="fld"><span>When do you need it?</span><div class="opts" id="pwhen">' + TH.WHEN.map((w) => '<button class="opt" data-act="pwhen" data-v="' + esc(w) + '">' + esc(w) + '<i></i></button>').join('') + '</div></div>' +
        '<div class="fld"><span>Budget</span><div class="opts" id="pbudget">' + TH.BUDGETS.map((w) => '<button class="opt" data-act="pbudget" data-v="' + esc(w) + '">' + esc(w) + '<i></i></button>').join('') + '</div></div></div>') +
        '<div class="step" data-s="3"><h2>Ready to post</h2><p class="muted">Check it over. Trades nearby will see it straight away.</p><div class="sum" id="psum"></div>' +
        '<div class="note">' + I('shield', 18) + '<span>Only verified, insured trades can apply. Your exact address is shared only with the trade you hire.</span></div></div>' +
        '</div><div class="bottombar"><button class="btn hi" id="pnext" data-act="pnext">Continue</button></div>';
    },
    mount(el) {
      $('#ptitle', el).addEventListener('input', (e) => { pf.title = e.target.value; postSync(el); });
      $('#pdesc', el).addEventListener('input', (e) => { pf.desc = e.target.value; });
      $('#pfile', el).addEventListener('change', (e) => addPhotos(el, e.target.files));
      const pr = $('#prate', el); pr && pr.addEventListener('input', (e) => { pf.dayRate = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0; postSync(el); });
      postSync(el, true);
    },
  };
  function postSync(el, initial) {
    $$('.step', el).forEach((s) => { const i = +s.dataset.s; s.classList.toggle('r', i > pf.step); s.classList.toggle('l', i < pf.step); });
    $('#pbar', el).style.width = ((pf.step + 1) / 4 * 100) + '%';
    $$('[data-act=ptrade]', el).forEach((b) => b.classList.toggle('on', b.dataset.id === pf.trade));
    $$('[data-act=pwhen]', el).forEach((b) => b.classList.toggle('on', b.dataset.v === pf.when));
    $$('[data-act=pbudget]', el).forEach((b) => b.classList.toggle('on', b.dataset.v === pf.budget));
    $$('[data-act=prepeat]', el).forEach((b) => { const on = b.dataset.v === (pf.repeat || 'once'); b.classList.toggle('on', on); b.style.background = on ? '' : 'var(--panel)'; });
    $$('[data-act=pdur]', el).forEach((b) => b.classList.toggle('on', b.dataset.v === pf.duration));
    $$('[data-act=pstart]', el).forEach((b) => { const on = b.dataset.v === pf.startLabel; b.classList.toggle('on', on); b.style.background = on ? '' : 'var(--panel)'; });
    if (pf.trade) { $('#ptradeName', el).textContent = TH.trade(pf.trade).name + (pf.invite ? ', ' + first(TH.trader(pf.invite).name) + ' will be asked first' : ''); $('#ptitle', el).placeholder = PLACEHOLDER[pf.trade] || 'e.g. What needs doing'; }
    const ok = [!!pf.trade, pf.title.trim().length > 3, pf.T ? (!!pf.startLabel && !!pf.duration && pf.dayRate > 0) : (!!pf.when && !!pf.budget), true][pf.step];
    const nx = $('#pnext', el); nx.disabled = !ok;
    nx.innerHTML = pf.step === 3 ? I('send', 19) + 'Post job' : 'Continue';
    $('.bottombar', el).style.display = pf.step === 0 ? 'none' : '';
    if (pf.step === 3) {
      const c = meCustomer();
      $('#psum', el).innerHTML = (pf.T ? [['Trade', TH.trade(pf.trade).name], ['Job', pf.title], ['Start', pf.startLabel], ['Duration', pf.duration], ['Day rate', TH.money(pf.dayRate)], ['Repeat', pf.repeat === 'weekly' ? 'Every week' : 'Just this once'], ['Where', c.area + ', ' + c.postcode]]
        : [['Trade', TH.trade(pf.trade).name], ['Job', pf.title], ['When', pf.when], ['Budget', pf.budget], ['Where', c.area + ', ' + c.postcode], ['Photos', pf.photos.length ? pf.photos.length + ' added' : 'None']])
        .map(([k, v]) => '<div class="item"><span class="muted sm" style="width:72px">' + k + '</span><b class="grow" style="font-weight:600;font-size:14.5px">' + esc(v) + '</b></div>').join('');
      $('#psum', el).classList.add('list');
    }
    if (!initial && pf.step === 1) setTimeout(() => $('#ptitle', el).focus({ preventScroll: true }), 450);
  }
  const PLACEHOLDER = { electrician: 'e.g. Two sockets need moving', plumber: 'e.g. Leaking tap in the bathroom', gas: 'e.g. Annual boiler service', builder: 'e.g. Knock through to the kitchen', carpenter: 'e.g. Fitted wardrobes in the loft', roofer: 'e.g. Slipped tiles after the storm', decorator: 'e.g. Paint the hallway and landing', landscaper: 'e.g. Lay a new patio', labourer: 'e.g. Labourer needed for three days', locksmith: 'e.g. Locked out, front door' };
  const VOICE = {
    electrician: ['Sockets keep tripping in the kitchen', 'The kitchen sockets trip every time the kettle and the toaster are on together. Started last week. It\'s a 1930s semi, fuse box is in the hallway cupboard.'],
    plumber: ['Leak under the bathroom sink', 'There\'s a slow leak under the bathroom sink, looks like it\'s coming from the trap. Cupboard floor is getting soft. Need it sorted this week if possible.'],
    labourer: ['Labourer needed for a rewire', 'Need a labourer for two days on a rewire in Surbiton. Lifting floorboards, chasing walls and keeping the site clean. Own PPE please, start 8am.'],
    decorator: ['Paint the hallway and landing', 'Hallway, stairs and landing. Walls and ceilings, two coats, and the spindles need doing in white gloss. Carpets are going down after.'],
  };
  function voice(el) {
    const v = $('#pvoice', el); if (!v || v.classList.contains('rec')) { if (v && v._stop) v._stop(); return; }
    v.classList.add('rec'); $('#pvl', el).textContent = 'Listening'; $('#pvs', el).textContent = 'Tap again when you\'re done';
    const ta = $('#pdesc', el), ti = $('#ptitle', el);
    const done = () => { v.classList.remove('rec'); $('#pvl', el).textContent = 'Got it'; $('#pvs', el).textContent = 'Check it over, then carry on'; pf.desc = ta.value; postSync(el); };
    const fake = () => {
      const [title, text] = VOICE[pf.trade] || VOICE.electrician; let i = 0;
      if (!ti.value) { ti.value = title; pf.title = title; }
      const iv = setInterval(() => { i += 2; ta.value = text.slice(0, i); if (i >= text.length) { clearInterval(iv); done(); } }, 28);
      v._stop = () => { clearInterval(iv); ta.value = text; done(); };
    };
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || EMBED) return setTimeout(fake, 700);
    try {
      const rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = true; rec.continuous = true; let got = false, base = ta.value ? ta.value + ' ' : '';
      rec.onresult = (e) => { got = true; let t = ''; for (let k = 0; k < e.results.length; k++) t += e.results[k][0].transcript; ta.value = base + t; };
      rec.onerror = () => { if (!got) fake(); };
      rec.onend = () => { if (got) done(); };
      v._stop = () => rec.stop();
      rec.start();
      setTimeout(() => { if (!got) { try { rec.abort(); } catch (e) {} } }, 3500);
    } catch (e) { fake(); }
  }
  function addPhotos(el, files) {
    [...files].slice(0, 6 - pf.photos.length).forEach((f) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'), k = 360 / Math.max(img.width, img.height);
          c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          const url = c.toDataURL('image/jpeg', 0.72); pf.photos.push(url);
          const d = document.createElement('div'); d.className = 'ph'; d.style.backgroundImage = 'url(' + url + ')';
          $('#pphotos', el).insertBefore(d, $('#pphotos label', el));
        };
        img.src = r.result;
      };
      r.readAsDataURL(f);
    });
  }
  function postSubmit(el) {
    const startAt = pf.startDays ? (() => { const d = new Date(); d.setHours(8, 0, 0, 0); d.setDate(d.getDate() + pf.startDays); return d.getTime(); })() : null;
    const j = pf.T
      ? TH.postJob({ customerId: myPosterId(), trade: pf.trade, title: pf.title.trim(), desc: pf.desc.trim(), when: pf.startDays === 1 ? 'As soon as possible' : pf.startDays ? 'This week' : 'I\'m flexible', budget: null, dayRate: pf.dayRate, start: startAt, duration: pf.duration, photos: pf.photos, repeat: pf.repeat === 'weekly' ? 'weekly' : null })
      : TH.postJob({ customerId: myPosterId(), trade: pf.trade, title: pf.title.trim(), desc: pf.desc.trim(), when: pf.when, budget: pf.budget, photos: pf.photos });
    if (pf.invite) { const s = S(); s.sims = s.sims.filter((x) => !(x.jobId === j.id && x.traderId === pf.invite)); s.sims.push({ kind: 'apply', jobId: j.id, traderId: pf.invite, dueAt: Date.now() + 3500 }); TH.save(); }
    seenJobs.add(j.id);
    const near = S().traders.filter((t) => t.trade === j.trade && t.status === 'verified' && TH.miles(t.pos, j.pos) < 12);
    const ov = document.createElement('div'); ov.className = 'sent';
    ov.innerHTML = '<div class="pins">' + near.slice(0, 8).map((t, i) => '<span style="left:' + (14 + ((i * 37) % 72)) + '%;top:' + (16 + ((i * 23) % 40)) + '%;animation-delay:' + (0.5 + i * 0.18) + 's">' + I(TH.trade(t.trade).icon, 14) + '</span>').join('') + '</div>' +
      '<div class="radar"><i></i><i></i><i></i><div class="core">' + I('check', 30) + '</div></div><h2>Your job is live</h2><p>Sent to ' + near.length + ' verified ' + esc(TH.trade(j.trade).name.toLowerCase()) + (near.length === 1 ? '' : 's') + ' near ' + esc(j.area) + '.<br>We\'ll tell you the moment someone applies.</p>';
    el.appendChild(ov);
    setTimeout(() => {
      const modal = stack.pop();
      while (stack.length) destroy(stack.pop());
      if (mode === 'trade') ui.workSeg = 'posted';
      const jobsRoot = build(mode === 'trade' ? 'work' : 'jobs', {}, { before: modal.el, cls: ['under'] }); stack.push(jobsRoot);
      const det = build('cjob', { id: j.id }, { before: modal.el }); stack.push(det);
      modal.el.classList.add('leave'); setTimeout(() => destroy(modal), 520);
      syncTabs();
    }, 2900);
  }

  /* Need someone now */
  const EMERG = [['plumber', 'drop', 'Burst pipe or leak', 'Water coming through'], ['locksmith', 'key', 'Locked out', 'Can\'t get in'], ['electrician', 'bolt', 'No power', 'Power\'s gone off'], ['gas', 'flame', 'No heating or hot water', 'Boiler\'s stopped'], ['drainage', 'pipe', 'Blocked drain or toilet', 'Drain backing up'], ['windows', 'window', 'Broken window or door', 'Can\'t lock up']];
  SCREENS.urgent = {
    static: true,
    render(p) {
      return '<div class="mapwrap"><div class="lmap"></div></div>' +
        '<div class="nav" style="position:relative;z-index:5;background:linear-gradient(to bottom,rgba(11,12,10,.95) 60%,rgba(11,12,10,0))"><button class="ib" data-act="back">' + I('close', 19) + '</button><div class="t">' + esc(p.title) + '</div><span style="width:40px"></span></div>' +
        '<div class="ucard" id="ucard"></div>';
    },
    mount(el, p, ctx) {
      const j = TH.urgent({ trade: p.trade, title: p.title, desc: p.title + '. Needs someone as soon as possible.' });
      p.id = j.id; ctx.t0 = Date.now();
      ctx.map = makeMap($('.lmap', el), [mePos()[0] - 0.006, mePos()[1]], 14);
      L.marker(mePos(), { icon: meIcon(), interactive: false }).addTo(ctx.map);
      ctx.ring = L.circle(mePos(), { radius: 4828, color: '#F5EC20', weight: 1, opacity: 0.35, fillOpacity: 0.03 }).addTo(ctx.map);
      setTimeout(() => ctx.map.flyToBounds(ctx.ring.getBounds(), { duration: 1.6, paddingTopLeft: [10, 90], paddingBottomRight: [10, 260] }), 700);
      ctx.pins = {};
      (j.pinged || []).forEach((id, i) => setTimeout(() => {
        const t = TH.trader(id); if (!ctx.map) return;
        ctx.pins[id] = L.marker(t.pos, { icon: L.divIcon({ className: '', html: '<div class="tpin-wrap ping"><div class="tpin">' + I(TH.trade(t.trade).icon, 17) + '</div></div>', iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(ctx.map);
        ctx.lines = ctx.lines || []; ctx.lines.push(L.polyline([mePos(), t.pos], { color: '#F5EC20', weight: 1, opacity: 0.5, dashArray: '3 6' }).addTo(ctx.map));
      }, 1400 + i * 650));
      this.refresh(el, p, ctx);
      ctx.iv = setInterval(() => this.refresh(el, p, ctx), 1000);
    },
    unmount(el, p, ctx) { clearInterval(ctx.iv); clearInterval(ctx.mv); ctx.map && ctx.map.remove(); ctx.map = null; },
    refresh(el, p, ctx) {
      const j = TH.job(p.id); if (!j) return;
      const card = $('#ucard', el), secs = Math.floor((Date.now() - ctx.t0) / 1000);
      const tr = TH.trade(j.trade).name.toLowerCase();
      if (j.status === 'open') {
        const asked = Math.min((j.pinged || []).length, Math.max(0, Math.floor((Date.now() - ctx.t0 - 1400) / 650) + 1));
        card.innerHTML = '<div class="row"><div class="radar mini"><i></i><i></i><div class="core">' + I(TH.trade(j.trade).icon, 20) + '</div></div><div class="grow"><b class="uh">' + (asked ? 'Asking ' + asked + ' ' + tr + (asked > 1 ? 's' : '') + ' nearby' : 'Finding ' + tr + 's near you') + '</b><div class="muted sm">Within 3 miles and online now. First to accept is yours.</div></div></div>' +
          '<div class="ulist">' + (j.pinged || []).slice(0, asked).map((id, i) => { const t = TH.trader(id); return '<div class="row" style="padding:9px 0">' + av(t.name, t.tone, 's', true) + '<div class="grow"><b style="font-weight:600;font-size:14px">' + esc(t.name) + '</b><div class="muted xs">' + TH.milesLabel(TH.miles(mePos(), t.pos)) + ' away</div></div><span class="xs muted">' + (secs > 3 + i ? 'Seen' : 'Sent') + '</span></div>'; }).join('') + '</div>' +
          '<div class="muted xs" style="margin-top:10px;text-align:center">' + secs + 's</div>';
      } else {
        const t = TH.trader(j.hiredId), mins = Math.max(1, Math.round((j.eta - Date.now()) / 60000));
        if (!ctx.arrived) {
          ctx.arrived = true; confetti();
          Object.keys(ctx.pins).forEach((id) => { if (id !== t.id) ctx.pins[id].remove(); });
          (ctx.lines || []).forEach((l) => l.remove());
          const m = ctx.pins[t.id] || L.marker(t.pos).addTo(ctx.map); const from = L.latLng(t.pos), to = L.latLng(mePos());
          m.setIcon(L.divIcon({ className: '', html: '<div class="tpin sel">' + I('van', 17) + '</div>', iconSize: [34, 34], iconAnchor: [17, 17] }));
          ctx.route = L.polyline([from, to], { color: '#F5EC20', weight: 3, opacity: 0.8 }).addTo(ctx.map);
          ctx.map.flyToBounds(ctx.route.getBounds(), { duration: 1.2, paddingTopLeft: [40, 120], paddingBottomRight: [40, 300] });
          let k = 0; ctx.mv = setInterval(() => { k = Math.min(0.35, k + 0.004); m.setLatLng([from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k]); }, 120);
        }
        card.innerHTML = '<div class="row">' + av(t.name, t.tone, '', true) + '<div class="grow"><div class="xs" style="color:var(--ok);font-weight:700;letter-spacing:.02em">ACCEPTED</div><b class="uh">' + esc(first(t.name)) + ' is on the way</b><div class="muted sm">' + esc(t.business) + ', ' + stars(t.rating, t.reviews) + '</div></div><div style="text-align:right"><div class="eta">' + mins + '</div><div class="muted xs">min</div></div></div>' +
          '<div class="row" style="margin-top:14px;gap:8px"><button class="btn dk sm" style="flex:1" data-go="chat" data-job="' + j.id + '" data-t="' + t.id + '">' + I('chat', 16) + 'Message</button><button class="btn dk sm" style="flex:1" data-act="call" data-t="' + t.id + '">' + I('phone', 16) + 'Call</button><button class="btn hi sm" style="flex:1" data-go="cjob" data-id="' + j.id + '">Job</button></div>' +
          '<p class="muted xs" style="margin-top:12px">Callout from ' + TH.money(95) + ', agreed before work starts. No booking fee.</p>';
      }
    },
  };

  /* Trade: find work */
  function feedJobs() {
    const me = meTrader();
    return S().jobs.filter((j) => j.status === 'open' && j.customerId !== ME().tradeCustomerId && (ui.feedScope === 'all' || j.trade === me.trade) && TH.miles(me.pos, j.pos) <= ui.feedRadius)
      .sort((a, b) => b.postedAt - a.postedAt);
  }
  SCREENS.feed = {
    render() {
      const me = meTrader();
      return '<div class="top" style="padding-bottom:14px">' + TH_MARK(36) + '<div class="grow"><div class="muted sm">' + greet() + '</div><h1 style="font-size:24px">' + esc(first(me.name)) + '</h1></div><button class="ib" data-act="fview" data-id="' + (ui.feedView === 'list' ? 'map' : 'list') + '" aria-label="Switch view">' + I(ui.feedView === 'list' ? 'map' : 'list', 20) + '</button><span class="bellslot">' + bell('trade') + '</span></div>' +
        '<div class="scroll" id="fscroll"><div class="pad">' +
        '<button class="avail ' + (me.online ? 'on' : '') + '" data-act="online" style="width:100%;text-align:left" id="avail"><div class="grow"><b>' + (me.online ? 'Available for work' : 'You\'re offline') + '</b><span>' + (me.online ? 'Customers within ' + ui.feedRadius + ' miles can see you on the map' : 'Go online to show up on the live map') + '</span></div><span class="tog ' + (me.online ? 'on' : '') + '"></span></button>' +
        '<button class="ftrow" data-act="freetom" id="ftrow"><div class="grow"><b>Free tomorrow</b><span>Firms short of hands tomorrow see you first</span></div><span class="tog sm ' + (me.freeTomorrow ? 'on' : '') + '"></span></button>' +
        '<div class="row" style="gap:6px;margin:16px -20px 0;padding:0 20px;overflow-x:auto;scrollbar-width:none">' +
        '<button class="chip ' + (ui.feedScope === 'mine' ? 'on' : '') + '" data-act="fscope" data-id="mine" style="height:34px">' + I(TH.trade(me.trade).icon, 15) + esc(TH.trade(me.trade).name) + '</button><button class="chip ' + (ui.feedScope === 'all' ? 'on' : '') + '" data-act="fscope" data-id="all" style="height:34px">All trades</button><span style="width:1px;background:var(--line-2);margin:6px 4px;flex:none"></span>' +
        [5, 10, 15].map((r) => '<button class="chip ' + (ui.feedRadius === r ? 'on' : '') + '" data-act="fradius" data-id="' + r + '" style="height:34px">' + r + ' mi</button>').join('') + '</div>' +
        '<div id="fbody"></div></div></div>';
    },
    mount(el, p, ctx) { this.refresh(el, p, ctx); },
    unmount(el, p, ctx) { ctx.map && ctx.map.remove(); },
    refresh(el, p, ctx) {
      const me = meTrader(), jobs = feedJobs();
      const ft_ = $('#ftrow', el); if (ft_) $('.tog', ft_).classList.toggle('on', !!me.freeTomorrow);
      const av_ = $('#avail', el);
      av_.classList.toggle('on', me.online); $('.tog', av_).classList.toggle('on', me.online);
      $('b', av_).textContent = me.online ? 'Available for work' : 'You\'re offline';
      $('span', av_).textContent = me.online ? 'Customers within ' + ui.feedRadius + ' miles can see you on the map' : 'Go online to show up on the live map';
      $('.bellslot', el).innerHTML = bell('trade');
      const body = $('#fbody', el);
      if (ui.feedView === 'list') {
        if (ctx.map) { ctx.map.remove(); ctx.map = null; }
        body.innerHTML = '<div class="h2">' + jobs.length + ' jobs near you<small>Applying is free</small></div><div class="list">' + (jobs.map(tradeJobRow).join('') || '<div class="empty">No open jobs in this radius right now.</div>') + '</div>';
      } else {
        if (!ctx.map) {
          body.innerHTML = '<div class="minimap" style="height:400px;margin-top:16px"><div class="lmap" style="position:absolute;inset:0"></div></div><div id="fpick"></div>';
          ctx.map = makeMap($('.lmap', body), me.pos, 12.5);
          L.marker(me.pos, { icon: tIcon(me, true), interactive: false }).addTo(ctx.map);
          ctx.ring = L.circle(me.pos, { radius: ui.feedRadius * 1609, color: '#F5EC20', weight: 1, opacity: 0.4, fillOpacity: 0.03 }).addTo(ctx.map);
          ctx.jm = new Map();
        }
        ctx.ring.setRadius(ui.feedRadius * 1609);
        const ids = new Set(jobs.map((j) => j.id));
        ctx.jm.forEach((m, id) => { if (!ids.has(id)) { m.remove(); ctx.jm.delete(id); } });
        jobs.forEach((j) => { if (!ctx.jm.has(j.id)) { const m = L.marker(j.pos, { icon: jIcon(j, !seenJobs.has(j.id)) }).addTo(ctx.map); m.on('click', () => { $('#fpick', el).innerHTML = '<div class="list">' + tradeJobRow(j) + '</div>'; }); ctx.jm.set(j.id, m); } });
      }
      setTimeout(() => { jobs.forEach((j) => seenJobs.add(j.id)); syncTabs(); }, 1600);
    },
  };

  /* Trade: job detail */
  SCREENS.tjob = {
    render(p) {
      const j = TH.job(p.id), me = meTrader(), c = TH.customer(j.customerId);
      const mine = j.applications.find((a) => a.traderId === me.id);
      const others = j.applications.filter((a) => a.traderId !== me.id).length;
      const hiredMe = j.hiredId === me.id;
      let bar = '';
      if (hiredMe) {
        const next = { hired: ['onway', 'I\'m on my way'], onway: ['started', 'Start the job'], started: ['done', 'Mark as complete'] }[j.status];
        bar = '<button class="btn dk" data-go="chat" data-job="' + j.id + '" data-t="' + me.id + '">Message</button>' + (next ? '<button class="btn hi" data-act="tstatus" data-job="' + j.id + '" data-s="' + next[0] + '">' + next[1] + '</button>' : '<button class="btn dk" disabled>Completed</button>');
      } else if (mine) bar = '<button class="btn dk" data-go="chat" data-job="' + j.id + '" data-t="' + me.id + '">' + I('chat', 18) + 'Message ' + esc(first(c.name)) + '</button>';
      else if (j.status === 'open') bar = '<button class="btn hi" data-act="apply" data-job="' + j.id + '">Apply for this job</button>';
      return '<div class="nav"><button class="ib" data-act="back">' + I('back', 20) + '</button><div class="t">' + esc(j.ref) + '</div><button class="ib ghost">' + I('flag', 19) + '</button></div>' +
        '<div class="scroll"><div class="pad"><div class="row" style="gap:10px;margin:6px 0 12px">' + tic(j.trade, 's') + '<span class="muted sm">' + esc(TH.trade(j.trade).name) + (c.kind === 'Trade' ? ', trade job' : '') + '</span></div>' +
        '<h1 style="font-size:26px">' + esc(j.title) + '</h1>' +
        '<div class="meta" style="margin-top:10px"><span>' + I('clock', 13) + 'Posted ' + TH.ago(j.postedAt).toLowerCase() + '</span><span>' + I('eye', 13) + j.views + (j.views === 1 ? ' view' : ' views') + '</span><span>' + I('pin', 13) + TH.milesLabel(TH.miles(me.pos, j.pos)) + ' away</span></div>' +
        (hiredMe ? tracker(j) : '') +
        '<div class="row" style="margin-top:18px">' + av(c.name, '#2E2F2A', 's') + '<div class="grow"><b style="font-weight:600">' + esc(shortName(c.name)) + '</b><div class="muted sm">' + esc(c.kind + ' in ' + j.area) + '</div><div class="meta" style="margin-top:3px">' + custRating(c) + '</div></div>' + (mine ? '<span class="sm" style="color:var(--hi);font-weight:600">' + (hiredMe ? 'You\'re hired' : 'Applied, ' + TH.money(mine.quote)) + '</span>' : '') + '</div>' +
        '<div class="minimap"><div class="lmap" style="position:absolute;inset:0"></div></div>' +
        (j.desc ? '<p class="t2" style="margin-top:16px;font-size:14.5px">' + esc(j.desc) + '</p>' : '') +
        (j.photos && j.photos.length ? '<div class="photos" style="margin-top:14px">' + j.photos.map((s) => '<div class="ph" style="background-image:url(' + s + ')"></div>').join('') + '</div>' : '') +
        '<div class="kv" style="margin-top:16px"><div><span>' + (j.dayRate ? 'Day rate' : 'Budget') + '</span><b>' + esc(TH.priceLabel(j)) + '</b></div><div><span>Start</span><b>' + esc(j.start ? TH.dayLabel(j.start) : j.when) + '</b></div><div><span>Duration</span><b>' + esc(j.duration || 'To be agreed') + '</b></div><div><span>Area</span><b>' + esc(j.area + ', ' + j.postcode.split(' ')[0]) + '</b></div></div>' +
        (hiredMe && j.status === 'done' && !j.custReview ? '<div class="card" style="margin-top:14px;text-align:center"><h3 style="font-size:18px">How was ' + esc(first(c.name)) + ' to work for?</h3><p class="muted sm" style="margin-top:4px">Only other trades see this. It helps everyone pick good jobs.</p><div class="rstars" id="rstars">' + [1, 2, 3, 4, 5].map((n) => '<button data-act="rstar" data-n="' + n + '">' + I('star', 32) + '</button>').join('') + '</div>' +
          '<div class="tagrow">' + ['Paid on time', 'Clear brief', 'Easy access', 'Would work for again'].map((x) => '<button class="chip" data-act="ctag" data-v="' + x + '">' + x + '</button>').join('') + '</div><button class="btn hi block" style="margin-top:14px" data-act="ratecust" data-job="' + j.id + '" id="rsend" disabled>Rate ' + esc(first(c.name)) + '</button></div>' : '') +
        (hiredMe && j.custReview ? '<div class="card" style="margin-top:14px"><div class="row"><b class="grow" style="font-weight:600">You rated ' + esc(first(c.name)) + '</b><span class="stars">' + Array.from({ length: j.custReview.stars }, () => I('star', 14)).join('') + '</span></div><div class="meta" style="margin-top:8px">' + j.custReview.tags.map((x) => '<span>' + esc(x) + '</span>').join('') + '</div></div>' : '') +
        (hiredMe && j.review ? '<div class="card" style="margin-top:14px"><div class="row"><b class="grow" style="font-weight:600">' + esc(shortName(c.name)) + '\'s review</b><span class="stars">' + Array.from({ length: j.review.stars }, () => I('star', 14)).join('') + '</span></div><p class="t2" style="margin-top:8px;font-size:14px">' + esc(j.review.text) + '</p></div>' : '') +
        (!hiredMe && j.status === 'open' ? '<div class="note" style="margin-top:18px">' + I('shield', 18) + '<span>' + (others ? others + ' other trade' + (others > 1 ? 's have' : ' has') + ' applied. ' : 'Be the first to apply. ') + 'Applying is free. No lead fees, no subscription.</span></div>' : '') +
        '</div></div>' + (bar ? '<div class="bottombar">' + bar + '</div>' : '');
    },
    mount(el, p, ctx) {
      const j = TH.job(p.id);
      if (!ctx.viewed) { ctx.viewed = true; j.views = (j.views || 0) + 1; setTimeout(() => TH.save(), 50); }
      ctx.map = makeMap($('.lmap', el), j.pos, 14, { dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false });
      L.circle(j.pos, { radius: 380, color: '#F5EC20', weight: 1.2, fillColor: '#F5EC20', fillOpacity: 0.12 }).addTo(ctx.map);
    },
    unmount(el, p, ctx) { ctx.map && ctx.map.remove(); },
  };

  /* Trade: my work */
  SCREENS.work = {
    render() {
      const me = meTrader(), s = S();
      const mineAll = s.jobs.filter((j) => j.applications.some((a) => a.traderId === me.id));
      const applied = mineAll.filter((j) => j.status === 'open');
      const booked = mineAll.filter((j) => j.hiredId === me.id && ['hired', 'onway', 'started'].includes(j.status)).sort((a, b) => a.scheduledFor - b.scheduledFor);
      const done = mineAll.filter((j) => j.hiredId === me.id && j.status === 'done').sort((a, b) => b.doneAt - a.doneAt);
      const monthStart = new Date(); monthStart.setDate(monthStart.getDate() - 28);
      const recent = done.filter((j) => j.doneAt > monthStart.getTime());
      const total = recent.reduce((a, j) => a + j.agreed, 0);
      const weeks = [3, 2, 1, 0].map((w) => recent.filter((j) => { const age = (Date.now() - j.doneAt) / TH.DAY; return age >= w * 7 && age < (w + 1) * 7; }).reduce((a, j) => a + j.agreed, 0));
      const max = Math.max(...weeks, 1);
      const next = booked[0];
      const posted = s.jobs.filter((j) => j.customerId === ME().tradeCustomerId).sort((a, b) => b.postedAt - a.postedAt);
      const list = { applied, booked, done, posted }[ui.workSeg];
      return '<div class="top"><div class="grow"><h1>My work</h1></div>' + bell('trade') + '</div><div class="scroll"><div class="pad">' +
        '<div class="earn"><div class="muted sm">Earned in the last 4 weeks</div><div class="big" data-count="' + total + '" data-pre="£">£0</div><div class="muted sm" style="margin-top:8px">From ' + recent.length + ' jobs. <span style="color:var(--text)">£0 paid in lead fees or subscriptions.</span></div>' +
        '<div class="bars">' + weeks.map((v, i) => '<div><b>' + (v ? TH.money(v) : '') + '</b><i style="height:' + Math.max(6, v / max * 78) + '%;animation-delay:' + (i * 0.08) + 's"></i><span>' + (i === 3 ? 'This week' : (3 - i) + 'w ago') + '</span></div>').join('') + '</div></div>' +
        '<div class="saved"><div class="row" style="align-items:flex-end"><div class="grow"><div class="muted sm">Kept this year, not spent on leads</div><div class="big2" data-count="' + (me.appsYear || 0) * TH.LEAD_PRICE + '" data-pre="£">£0</div></div><span class="pill0">£0 paid</span></div>' +
        '<p class="muted xs" style="margin-top:8px">' + (me.appsYear || 0) + ' jobs applied for this year. On lead sites that\'s about ' + TH.money(TH.LEAD_PRICE) + ' a lead, win or lose.</p></div>' +
        (next ? '<div class="h2">Up next</div><div class="today"><div class="row"><div class="grow"><div class="muted sm">' + TH.dayLabel(next.scheduledFor) + '</div><div class="when">' + TH.clock(next.scheduledFor) + '</div></div><span class="status live"><i></i>' + ({ hired: 'Booked', onway: 'On the way', started: 'In progress' })[next.status] + '</span></div>' +
          '<div style="margin:12px 0 14px"><b style="font-weight:600">' + esc(next.title) + '</b><div class="muted sm">' + esc(shortName(TH.customer(next.customerId).name) + ', ' + next.area + ', ' + TH.money(next.agreed) + ' agreed') + '</div></div>' +
          '<div class="row" style="gap:8px"><button class="btn dk sm" style="flex:1" data-go="tjob" data-id="' + next.id + '">' + I('map', 17) + 'Details</button>' +
          ({ hired: '<button class="btn hi sm" style="flex:1" data-act="tstatus" data-job="' + next.id + '" data-s="onway">' + I('van', 17) + 'On my way</button>', onway: '<button class="btn hi sm" style="flex:1" data-act="tstatus" data-job="' + next.id + '" data-s="started">Start job</button>', started: '<button class="btn hi sm" style="flex:1" data-act="tstatus" data-job="' + next.id + '" data-s="done">Mark complete</button>' })[next.status] + '</div></div>' : '') +
        '<div class="seg" style="margin-top:24px"><button class="' + (ui.workSeg === 'applied' ? 'on' : '') + '" data-act="wseg" data-id="applied">Applied (' + applied.length + ')</button><button class="' + (ui.workSeg === 'booked' ? 'on' : '') + '" data-act="wseg" data-id="booked">Booked (' + booked.length + ')</button><button class="' + (ui.workSeg === 'done' ? 'on' : '') + '" data-act="wseg" data-id="done">Done</button><button class="' + (ui.workSeg === 'posted' ? 'on' : '') + '" data-act="wseg" data-id="posted">Posted' + (posted.length ? ' (' + posted.length + ')' : '') + '</button></div>' +
        (ui.workSeg === 'posted' ? crewBlock() : '') +
        (ui.workSeg === 'posted' ? '<button class="card row" data-act="post" data-trade="labourer" style="width:100%;text-align:left;margin-top:14px">' + tic('labourer') + '<div class="grow"><b style="font-weight:600">Need a hand tomorrow?</b><div class="muted sm">Post a day-rate job for a labourer or another trade. Free.</div></div>' + I('next', 18, 'muted') + '</button>' : '') +
        '<div class="list">' + ((ui.workSeg === 'posted' ? list.map(custJobRow) : list.map(tradeJobRow)).join('') || '<div class="empty">Nothing here yet. Find work and apply, it\'s free.</div>') + '</div></div></div>';
    },
    mount(el, p, ctx) {
      if (ctx.counted) $$('[data-count]', el).forEach((n) => { n.textContent = (n.dataset.pre || '') + (+n.dataset.count).toLocaleString('en-GB'); });
      else { ctx.counted = true; countUp(el); }
    },
  };

  function foundingCard(t) {
    // founding places: trades flagged in the store plus those verified through HQ recruitment campaigns
    let fromCampaigns = 26;
    try { const g = JSON.parse(localStorage.getItem('th-hq-grow-v1') || 'null'); if (g && g.campaigns) fromCampaigns = g.campaigns.filter((c) => c.side === 'supply').reduce((a, c) => a + ((c.f && c.f.verified) || 0), 0); } catch (e) {}
    const target = S().foundingTarget || 100, taken = Math.min(target, S().traders.filter((x) => x.founding).length + fromCampaigns);
    return '<div class="card fcard" style="margin-top:18px"><div class="row" style="align-items:flex-start">' + TH_MARK(40) + '<div class="grow"><b style="font-weight:700;font-size:16px">' + (t.founding ? 'Founding member #' + t.foundingNo : 'Founding 100') + '</b><div class="muted sm" style="margin-top:2px">One of the first ' + target + ' trades on Trade Hunter. ' + taken + ' of ' + target + ' places taken.</div></div></div>' +
      '<div class="fbar"><i style="width:' + Math.round(taken / target * 100) + '%"></i></div>' +
      '<div class="row" style="margin-top:14px"><div class="grow sm t2">You\'ve invited <b>' + (t.invites || 0) + '</b> trades' + (t.invitesJoined ? ', <b>' + t.invitesJoined + '</b> joined' : '') + '.</div><button class="btn hi sm" data-act="invite">' + I('send', 16) + 'Invite a mate</button></div></div>';
  }

  function crewBlock() {
    const crew = (S().crew || []).map(TH.trader).filter(Boolean);
    if (!crew.length) return '';
    return '<div class="h2" style="margin-top:22px">My crew<small>Rebook in one tap</small></div><div class="list">' + crew.map((t) => '<div class="item">' + av(t.name, t.tone, 's', t.online) +
      '<div class="grow"><b style="font-weight:600">' + esc(t.name) + '</b><div class="muted xs">' + esc(TH.trade(t.trade).name) + ', ' + TH.money(t.dayRate) + ' a day</div>' +
      '<div class="xs" style="margin-top:3px;font-weight:600;color:' + (t.freeTomorrow ? 'var(--ok)' : 'var(--muted)') + '">' + (t.freeTomorrow ? 'Free tomorrow' : 'Busy tomorrow') + '</div></div>' +
      '<button class="btn ' + (t.freeTomorrow ? 'hi' : 'dk') + ' sm" data-act="crewbook" data-t="' + t.id + '">Book</button></div>').join('') + '</div>';
  }

  /* Trade: account */
  SCREENS.tacct = {
    render() {
      const t = meTrader();
      return '<div class="top"><div class="grow"><h1>Account</h1></div></div><div class="scroll"><div class="pad">' +
        '<div class="row" style="padding:6px 0 4px">' + av(t.name, t.tone, 'lg', t.online) + '<div class="grow"><h2 style="font-size:22px">' + esc(t.name) + '</h2><div class="muted sm">' + esc(t.business + ', ' + TH.trade(t.trade).name) + '</div><div class="row" style="gap:12px;margin-top:6px">' + stars(t.rating, t.reviews) + verified + '</div></div></div>' +
        '<div class="figs" style="margin:20px 0 6px"><div><b>' + t.jobsDone + '</b><span>Jobs done</span></div><div><b>' + t.reviews + '</b><span>Reviews</span></div><div><b>£0</b><span>Fees paid</span></div></div>' +
        foundingCard(t) +
        '<div class="h2">Documents<small>All checked</small></div><div class="list">' + t.docs.map((d) => '<div class="doc"><div class="tic s">' + I('check', 17) + '</div><div class="grow"><b style="font-weight:600;font-size:14.5px">' + esc(d.type) + '</b><div class="muted sm">' + esc(d.detail) + '</div></div></div>').join('') + '</div>' +
        '<div class="h2">Settings</div><div class="list">' +
        '<button class="mrow" data-go="tprofile" data-id="' + t.id + '">' + I('eye', 20) + '<span class="grow">My public profile</span>' + I('next', 17) + '</button>' +
        [['pin', 'Service area', '10 miles from ' + t.area], ['bolt', 'My trades', TH.trade(t.trade).name], ['bell', 'Job alerts', 'Instant'], ['chat', 'Help and support', '']].map(([ic, l, v]) => '<button class="mrow">' + I(ic, 20) + '<span class="grow">' + l + '</span><span class="muted sm">' + esc(v) + '</span>' + I('next', 17) + '</button>').join('') +
        '<button class="mrow" data-act="ideas">' + I('sparkle', 20) + '<span class="grow">Suggest a feature</span>' + I('next', 17) + '</button>' +
        '<button class="mrow" data-act="mode" data-mode="customer">' + I('home', 20) + '<span class="grow">Open the customer app</span>' + I('next', 17) + '</button>' +
        '<button class="mrow" data-act="reset">' + I('refresh', 20) + '<span class="grow">Restart the demo</span></button></div>' +
        '<p class="muted xs" style="margin-top:22px">Trade Hunter Group Ltd. Version 2.0</p></div></div>';
    },
  };

  /* ---------- actions ---------- */
  const ACTS = {
    back: () => pop(),
    notes: () => {
      const to = mode;
      const notes = S().notes.filter((n) => n.to === to).slice(0, 12);
      openSheet('<h2>Notifications</h2>' + (notes.length ? '<div class="list" style="margin-top:8px">' + notes.map((n) => '<button class="item" data-note="' + n.id + '">' + TH_MARK(30) + '<div class="grow"><div class="sm" style="' + (n.read ? 'color:var(--text-2)' : 'font-weight:600') + '">' + esc(n.text) + '</div><div class="muted xs" style="margin-top:2px">' + TH.ago(n.at) + '</div></div></button>').join('') + '</div>' : '<p class="muted" style="padding:20px 0 10px">You\'re all caught up. Updates on your jobs will show here.</p>'));
      TH.readNotes(to);
    },
    post: (b) => { closeSheet(); push('post', { trade: b.dataset.trade, invite: b.dataset.invite }); },
    hfilter: (b) => { ui.homeFilter = b.dataset.id; ui.sel = null; const e = stack[0]; $('#peek', e.el).classList.remove('show'); refresh(e); },
    jseg: (b) => { ui.jobsSeg = b.dataset.id; refresh(top()); },
    wseg: (b) => { ui.workSeg = b.dataset.id; refresh(top()); },
    fview: (b) => { ui.feedView = b.dataset.id; const nx = ui.feedView === 'list' ? 'map' : 'list'; b.dataset.id = nx; b.innerHTML = I(nx, 20); refresh(top()); },
    fscope: (b) => { ui.feedScope = b.dataset.id; $$('[data-act=fscope]', top().el).forEach((x) => x.classList.toggle('on', x.dataset.id === ui.feedScope)); refresh(top()); },
    fradius: (b) => { ui.feedRadius = +b.dataset.id; $$('[data-act=fradius]', top().el).forEach((x) => x.classList.toggle('on', x.dataset.id === b.dataset.id)); refresh(top()); },
    online: () => { const t = meTrader(); TH.setOnline(t.id, !t.online); if (t.online) toast('You\'re live on the map. Customers nearby can see you now.'); },
    shortlist: (b) => { const a = TH.job(b.dataset.job).applications.find((x) => x.traderId === b.dataset.t); TH.shortlist(b.dataset.job, b.dataset.t, a.status !== 'shortlisted'); },
    hire: (b) => {
      const j = TH.job(b.dataset.job), t = TH.trader(b.dataset.t), a = j.applications.find((x) => x.traderId === t.id);
      openSheet('<div style="text-align:center">' + av(t.name, t.tone, 'lg').replace('class="av lg"', 'class="av lg" style="margin:4px auto 14px;--tone:' + t.tone + '"') + '<h2>Hire ' + esc(first(t.name)) + ' for ' + TH.money(a.quote) + (j.dayRate ? ' a day' : '') + '?</h2><p class="muted" style="margin:6px 0 18px">' + esc(first(t.name)) + ' gets your address and a confirmation straight away. The other applicants are thanked and let go.</p></div>' +
        '<div class="note" style="margin:0 0 18px">' + I('shield', 18) + '<span>No booking fee and no commission. You pay ' + esc(first(t.name)) + ' directly, once you\'re happy.</span></div>' +
        '<button class="btn hi block" data-act="hireok" data-job="' + j.id + '" data-t="' + t.id + '">Confirm and hire</button><button class="btn block" style="margin-top:6px;color:var(--muted)" data-act="closesheet">Not yet</button>');
    },
    hireok: (b) => {
      closeSheet(); TH.hire(b.dataset.job, b.dataset.t); confetti();
      if (mode === 'trade') TH.addToCrew(b.dataset.t);
      if (top().name !== 'cjob') { while (stack.length > 2) { destroy(stack.pop()); } stack.length > 1 && top().name !== 'cjob' && pop(); }
      setTimeout(() => toast(first(TH.trader(b.dataset.t).name) + ' is booked. You can message them any time.', { job: b.dataset.job }), 900);
    },
    closesheet: () => closeSheet(),
    voice: () => voice(top().el),
    urgent: () => openSheet('<h2>What\'s happened?</h2><p class="muted sm">We\'ll ask the nearest trades who are online right now. The first to accept comes straight out.</p><div class="tgrid" style="margin-top:16px">' +
      EMERG.map(([tr, ic, l]) => '<button data-act="urgentgo" data-trade="' + tr + '" data-title="' + esc(l) + '">' + I(ic, 26) + esc(l) + '</button>').join('') + '</div>'),
    urgentgo: (b) => { closeSheet(); push('urgent', { trade: b.dataset.trade, title: b.dataset.title }); },
    freetom: () => { const t = meTrader(); TH.setFreeTomorrow(t.id, !t.freeTomorrow); if (!t.freeTomorrow) return; toast('Firms looking for help tomorrow will see you first.'); },
    invite: () => {
      const me = mode === 'trade' ? meTrader() : null;
      const text = me ? 'Alright mate, I\'m on Trade Hunter. It\'s free, no lead fees or subscriptions. Jobs come straight to your phone and you show on a live map for customers nearby. Founding places are going: tradehunter.app/join/' + first(me.name).toLowerCase()
        : 'I found a good trade through Trade Hunter. It\'s free to post a job and every trade is checked: tradehunter.app/invite/' + first(meCustomer().name).toLowerCase();
      openSheet('<h2>' + (me ? 'Invite a trade mate' : 'Invite a trade you trust') + '</h2><p class="muted sm">' + (me ? 'The more trades nearby, the more work comes through for everyone.' : 'Good trades you\'ve used before can join free and get your next job.') + '</p>' +
        '<div class="wa"><div class="wab">' + esc(text) + '<time>' + TH.clock(Date.now()) + '</time></div></div>' +
        '<a class="btn hi block" style="margin-top:16px" href="' + share(text) + '" target="_blank" rel="noopener" data-act="invitesent">' + I('send', 18) + 'Share on WhatsApp</a>' +
        '<button class="btn dk block" style="margin-top:8px" data-act="copylink" data-v="' + esc(text.split(': ').pop()) + '">Copy link</button>');
    },
    invitesent: () => { if (mode === 'trade') TH.invite(ME().traderId); setTimeout(closeSheet, 300); },
    copylink: (b) => { try { navigator.clipboard.writeText('https://' + b.dataset.v); } catch (e) {} closeSheet(); toast('Link copied.'); },
    sharejob: () => {},
    prepeat: (b) => { pf.repeat = b.dataset.v; postSync(top().el); },
    ctag: (b) => { b.classList.toggle('on'); },
    ratecust: (b) => { const tags = $$('.tagrow .chip.on', top().el).map((x) => x.dataset.v); TH.rateCustomer(b.dataset.job, ui.rstars || 5, tags); confetti(); },
    crewbook: (b) => {
      const t = TH.trader(b.dataset.t);
      openSheet('<div style="text-align:center">' + av(t.name, t.tone, 'lg').replace('class="av lg"', 'class="av lg" style="margin:4px auto 14px;--tone:' + t.tone + '"') + '<h2>Book ' + esc(first(t.name)) + ' for tomorrow?</h2><p class="muted" style="margin:6px 0 16px">' + TH.money(t.dayRate) + ' a day, 8am start in ' + esc(meCustomer().area) + '. ' + esc(first(t.name)) + ' gets a booking request straight away.</p></div>' +
        '<div class="sgrid" style="margin-bottom:16px">' + ['1 day', '2 to 3 days', 'About a week', 'Two weeks or more'].map((d, i) => '<button class="chip ' + (i === 0 ? 'on' : '') + '" data-act="crewdur" data-v="' + d + '"' + (i === 0 ? '' : ' style="background:var(--panel)"') + '>' + d + '</button>').join('') + '</div>' +
        '<button class="btn hi block" data-act="crewok" data-t="' + t.id + '">Send booking</button>');
      ui.crewDur = '1 day';
    },
    crewdur: (b) => { ui.crewDur = b.dataset.v; $$('[data-act=crewdur]', $bs).forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.style.background = on ? '' : 'var(--panel)'; }); },
    crewok: (b) => {
      const t = TH.trader(b.dataset.t); closeSheet();
      TH.bookCrew(myPosterId(), t.id, { trade: t.trade, title: TH.trade(t.trade).name + ', ' + (ui.crewDur || '1 day').toLowerCase() + ' from tomorrow', desc: 'Booked directly from your crew.', budget: null, dayRate: t.dayRate, start: tomorrow8(), duration: ui.crewDur || '1 day', when: 'As soon as possible' });
      toast('Booking sent to ' + first(t.name) + '.');
    },
    accept: (b) => { TH.acceptQuote(b.dataset.job, b.dataset.t, +b.dataset.i); confetti(); },
    send: () => sendMsg(top().el, top().params),
    call: (b) => toast('Calling ' + TH.trader(b.dataset.t).name + '. Numbers stay private until you hire.'),
    cdone: (b) => TH.setStatus(b.dataset.job, 'done'),
    rstar: (b) => { const n = +b.dataset.n; ui.rstars = n; $$('#rstars button', top().el).forEach((x, i) => x.classList.toggle('on', i < n)); $('#rsend', top().el).disabled = false; },
    review: (b) => { const txt = $('#rtext', top().el).value.trim() || 'Great job, would hire again.'; TH.review(b.dataset.job, ui.rstars || 5, txt); confetti(); },
    apply: (b) => {
      const j = TH.job(b.dataset.job), me = meTrader(), c = TH.customer(j.customerId);
      const guess = j.dayRate || ({ 'Under £250': 180, '£250 to £500': 380, '£500 to £1,000': 760, '£1,000 to £5,000': 1450, '£5,000 and over': 5600 })[j.budget] || 250;
      openSheet('<h2>Apply to ' + esc(first(c.name)) + (c.kind === 'Trade' ? '' : '\'s') + ' job</h2><p class="muted sm">' + esc(j.title) + '</p>' +
        '<label class="fld"><span>' + (j.dayRate ? 'Your day rate' : 'Your price') + '</span><div class="money"><input id="aq" inputmode="numeric" value="' + guess + '"></div></label>' +
        '<label class="fld"><span>Message</span><textarea id="am">Hi ' + esc(first(c.name)) + ', I\'m ' + esc(first(me.name)) + ' from ' + esc(me.business) + '. ' + esc(me.accred ? me.accred + ', ' : '') + 'based in ' + esc(me.area) + ' and fully insured. I can come and take a look ' + (j.when === 'As soon as possible' ? 'today' : 'this week') + '.</textarea></label>' +
        '<div class="note">' + I('shield', 18) + '<span>Free to apply. ' + esc(first(c.name)) + ' sees your profile, reviews and checks.</span></div>' +
        '<button class="btn hi block" style="margin-top:18px" data-act="applyok" data-job="' + j.id + '">' + I('send', 18) + 'Send application</button>');
    },
    applyok: (b) => {
      const v = parseInt(($('#aq').value || '').replace(/[^0-9]/g, ''), 10) || 0, m = $('#am').value.trim();
      closeSheet(); TH.apply(b.dataset.job, ME().traderId, m, v); confetti();
      setTimeout(() => toast('Application sent. We\'ll let you know when they reply.'), 700);
    },
    quote: (b) => {
      openSheet('<h2>Send a quote</h2><p class="muted sm">They can accept it with one tap.</p><label class="fld"><span>Amount</span><div class="money"><input id="qa" inputmode="numeric" placeholder="0"></div></label><label class="fld"><span>What\'s included</span><textarea id="qd" style="min-height:80px" placeholder="Labour, parts, certificate..."></textarea></label><button class="btn hi block" style="margin-top:18px" data-act="quoteok" data-job="' + b.dataset.job + '">Send quote</button>');
    },
    quoteok: (b) => {
      const v = parseInt(($('#qa').value || '').replace(/[^0-9]/g, ''), 10); if (!v) return;
      closeSheet(); TH.message(b.dataset.job, ME().traderId, 't', $('#qd').value.trim() || 'Labour and materials.', { kind: 'quote', amount: v });
    },
    tstatus: (b) => {
      TH.setStatus(b.dataset.job, b.dataset.s);
      if (b.dataset.s === 'done') { confetti(); setTimeout(() => toast('Job complete. ' + TH.money(TH.job(b.dataset.job).agreed) + ' earned, no fees taken.'), 600); }
    },
    mode: (b) => setMode(b.dataset.mode),
    reset: () => { TH.reset(); seenApps.clear(); seenJobs.clear(); markSeen(); S().notes.forEach((n) => toasted.add(n.id)); setMode(mode, true); toast('Demo restarted.'); },
    ptrade: (b) => { pf.trade = b.dataset.id; if (pf.T) { pf.dayRate = pf.trade === 'labourer' ? 140 : 220; const pr = $('#prate', top().el); if (pr) pr.value = pf.dayRate; } postSync(top().el); setTimeout(() => { pf.step = 1; postSync(top().el); }, 260); },
    pwhen: (b) => { pf.when = b.dataset.v; postSync(top().el); },
    pbudget: (b) => { pf.budget = b.dataset.v; postSync(top().el); },
    pdur: (b) => { pf.duration = b.dataset.v; postSync(top().el); },
    pstart: (b) => { pf.startLabel = b.dataset.v; pf.startDays = +b.dataset.d; postSync(top().el); },
    ideas: () => {
      const ideas = (S().ideas || []).slice().sort((a, b) => b.votes - a.votes).slice(0, 5);
      openSheet('<h2>Help build Trade Hunter</h2><p class="muted sm">Tell us what would make the app better for you. The most wanted ideas get built first.</p>' +
        '<label class="fld"><textarea id="idea" style="min-height:90px" placeholder="I\'d love to be able to..."></textarea></label><button class="btn hi block" style="margin-top:12px" data-act="ideaok">Send suggestion</button>' +
        '<div class="h2">Most wanted</div><div class="list">' + ideas.map((i) => '<div class="item"><div class="grow"><div class="sm">' + esc(i.text) + '</div><div class="muted xs" style="margin-top:2px">' + esc(i.from) + '</div></div><button class="chip" data-act="vote" data-id="' + i.id + '" style="background:var(--panel)">' + I('plus', 14) + i.votes + '</button></div>').join('') + '</div>');
    },
    ideaok: () => { const v = $('#idea').value.trim(); if (!v) return; TH.suggest(mode === 'customer' ? meCustomer().name : meTrader().name, v); closeSheet(); setTimeout(() => toast('Thanks. Every suggestion goes straight to the Trade Hunter team.'), 400); },
    vote: (b) => { const i = (S().ideas || []).find((x) => x.id === b.dataset.id); if (!i || b.dataset.done) return; i.votes++; b.dataset.done = 1; b.innerHTML = I('check', 14) + i.votes; b.classList.add('on'); TH.save(); },
    pnext: () => { if (pf.step === 3) return postSubmit(top().el); pf.step++; postSync(top().el); },
    pback: () => { if (pf.step === 0) return pop(); pf.step--; postSync(top().el); },
  };

  root.addEventListener('click', (e) => {
    const note = e.target.closest('[data-note]');
    if (note) { const n = S().notes.find((x) => x.id === note.dataset.note); closeSheet(); if (n && n.link) go(n.link); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) { if (stack[0].name !== tab.dataset.tab || stack.length > 1) setRoot(tab.dataset.tab, {}, true); else { const sc = $('.scroll', top().el); sc && sc.scrollTo({ top: 0, behavior: 'smooth' }); } return; }
    const g = e.target.closest('[data-go]');
    if (g && !e.target.closest('[data-act]')) {
      const d = g.dataset;
      if (d.go === 'chat') return push('chat', { jobId: d.job, traderId: d.t });
      if (d.go === 'tprofile') return push('tprofile', { id: d.id, job: d.job });
      return push(d.go, { id: d.id });
    }
    const a = e.target.closest('[data-act]');
    if (a && ACTS[a.dataset.act]) { e.preventDefault(); ACTS[a.dataset.act](a); }
  });

  /* ---------- mode switch ---------- */
  const sw = $('#modeSwitch');
  function paintSwitch() {
    if (!sw) return;
    const btns = $$('button', sw), on = btns.find((b) => b.dataset.mode === mode);
    btns.forEach((b) => b.classList.toggle('on', b === on));
    const i = $('i', sw); i.style.left = on.offsetLeft + 'px'; i.style.width = on.offsetWidth + 'px';
  }
  function setMode(m, force) {
    if (m === mode && !force) return;
    mode = m; store('th-mode', m); closeSheet();
    const sp = $('#splash'); sp.classList.remove('go'); sp.style.transition = 'none'; sp.getBoundingClientRect(); sp.style.transition = '';
    setTimeout(() => { setRoot(m === 'customer' ? 'home' : 'feed'); setTimeout(() => sp.classList.add('go'), 350); }, 60);
    paintSwitch();
  }
  if (sw) {
    sw.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
    document.fonts && document.fonts.ready.then(paintSwitch); setTimeout(paintSwitch, 300);
  }
  const rd = $('#resetDemo'); rd && rd.addEventListener('click', (e) => { e.preventDefault(); ACTS.reset(); });

  /* ---------- live updates ---------- */
  TH.on(() => {
    stack.forEach((e, i) => { if (i === stack.length - 1 || e.def.refresh) refresh(e); });
    syncTabs();
    const fresh = S().notes.filter((n) => n.to === mode && !toasted.has(n.id) && n.at >= START - 1000);
    S().notes.forEach((n) => toasted.add(n.id));
    if (fresh.length) {
      const n = fresh[0], t = top();
      const viewing = t && n.link && ((t.name === 'chat' && t.params.jobId === n.link.job && n.link.chat) || ((t.name === 'cjob' || t.name === 'tjob') && t.params.id === n.link.job && !n.link.chat));
      if (!viewing) toast(n.text, n.link);
    }
  });

  setRoot(mode === 'customer' ? 'home' : 'feed');
  paintSwitch();
})();
