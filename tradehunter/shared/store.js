/* Trade Hunter platform preview: shared data engine.
   One store in localStorage, read by the website, the phone app (customer and trade sides)
   and the HQ dashboard. A job posted in the app appears in the trade feed and on the HQ map
   straight away, applications arrive live, and every change reaches the other surfaces
   through the storage event. */
(function (global) {
  const KEY = 'th-preview-v1';
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  const CENTRE = [51.3937, -0.3036]; // Surbiton

  /* ---------- small helpers ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const uid = (p) => (p || 'x') + Math.random().toString(36).slice(2, 9);
  const money = (n) => '£' + Math.round(n).toLocaleString('en-GB');
  const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  function miles(a, b) {
    const R = 3958.8, toR = Math.PI / 180;
    const dLat = (b[0] - a[0]) * toR, dLng = (b[1] - a[1]) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const milesLabel = (m) => (m < 0.15 ? 'Under 0.2 mi' : m.toFixed(1) + ' mi');
  function ago(t) {
    const d = Date.now() - t;
    if (d < 45000) return 'Just now';
    if (d < HOUR) return Math.round(d / MIN) + ' min ago';
    if (d < DAY) return Math.round(d / HOUR) + 'h ago';
    const days = Math.round(d / DAY);
    return days === 1 ? 'Yesterday' : days + ' days ago';
  }
  function clock(t) { const d = new Date(t); return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function dayLabel(t) {
    const d = new Date(t), n = new Date(); const s = new Date(n); s.setHours(0, 0, 0, 0);
    const diff = Math.floor((d - s) / DAY);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  const atDay = (offset, h, m) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); d.setHours(h, m || 0, 0, 0); return d.getTime(); };

  /* ---------- reference data ---------- */
  const TRADES = [
    { id: 'electrician', name: 'Electrician', icon: 'bolt' },
    { id: 'plumber', name: 'Plumber', icon: 'drop' },
    { id: 'gas', name: 'Gas engineer', icon: 'flame' },
    { id: 'builder', name: 'Builder', icon: 'brick' },
    { id: 'carpenter', name: 'Carpenter', icon: 'saw' },
    { id: 'roofer', name: 'Roofer', icon: 'roof' },
    { id: 'decorator', name: 'Painter and decorator', icon: 'roller' },
    { id: 'plasterer', name: 'Plasterer', icon: 'trowel' },
    { id: 'tiler', name: 'Tiler', icon: 'grid' },
    { id: 'kitchen', name: 'Kitchen fitter', icon: 'kitchen' },
    { id: 'bathroom', name: 'Bathroom fitter', icon: 'bath' },
    { id: 'landscaper', name: 'Landscaper', icon: 'leaf' },
    { id: 'locksmith', name: 'Locksmith', icon: 'key' },
    { id: 'handyman', name: 'Handyman', icon: 'wrench' },
    { id: 'bricklayer', name: 'Bricklayer', icon: 'brick' },
    { id: 'flooring', name: 'Flooring', icon: 'floor' },
    { id: 'windows', name: 'Windows and doors', icon: 'window' },
    { id: 'drainage', name: 'Drainage', icon: 'pipe' },
    { id: 'labourer', name: 'Labourer', icon: 'hammer' },
    { id: 'scaffolder', name: 'Scaffolder', icon: 'grid' },
    { id: 'fencer', name: 'Fencer', icon: 'fence' },
    { id: 'aircon', name: 'Air conditioning', icon: 'snow' },
  ];
  const DURATIONS = ['Half a day', '1 day', '2 to 3 days', 'About a week', 'Two weeks or more'];
  const BUDGETS = ['Under £250', '£250 to £500', '£500 to £1,000', '£1,000 to £5,000', '£5,000 and over', 'Not sure yet'];
  const WHEN = ['As soon as possible', 'This week', 'Within a month', 'I\'m flexible'];
  const AREAS = {
    'Surbiton': [51.3937, -0.3036, 'KT6'], 'Kingston': [51.4123, -0.3007, 'KT1'], 'Long Ditton': [51.3846, -0.3216, 'KT6'],
    'Thames Ditton': [51.3890, -0.3313, 'KT7'], 'Esher': [51.3695, -0.3657, 'KT10'], 'Tolworth': [51.3786, -0.2804, 'KT6'],
    'New Malden': [51.4005, -0.2559, 'KT3'], 'Wimbledon': [51.4214, -0.2064, 'SW19'], 'Richmond': [51.4613, -0.3037, 'TW9'],
    'Teddington': [51.4275, -0.3326, 'TW11'], 'Twickenham': [51.4467, -0.3360, 'TW1'], 'East Molesey': [51.4010, -0.3480, 'KT8'],
    'Chessington': [51.3570, -0.3010, 'KT9'], 'Hook': [51.3700, -0.3050, 'KT9'], 'Berrylands': [51.3990, -0.2810, 'KT5'],
    'Hampton Wick': [51.4140, -0.3120, 'KT1'], 'Claygate': [51.3600, -0.3390, 'KT10'], 'Worcester Park': [51.3770, -0.2430, 'KT4'],
    'Ewell': [51.3490, -0.2490, 'KT17'], 'Raynes Park': [51.4090, -0.2300, 'SW20'], 'Epsom': [51.3360, -0.2670, 'KT18'],
  };
  const TONES = ['#2B2E33', '#33302A', '#2A3130', '#302B33', '#2E2F2A', '#2C2F36'];

  /* ---------- seed ---------- */
  function seed() {
    const r = rng(20261126);
    const jitter = (v, s) => v + (r() - 0.5) * s;
    const place = (area, s) => { const a = AREAS[area]; return [jitter(a[0], s || 0.012), jitter(a[1], s || 0.02)]; };

    const T = (id, name, business, trade, area, o) => Object.assign({
      id, name, business, trade, area, pos: place(area), home: null, online: true, status: 'verified',
      rating: 4.8, reviews: 40, jobsDone: 60, years: 10, responseMins: 12, since: '2025',
      tone: TONES[Math.floor(r() * TONES.length)], accred: null, insurance: '£2m public liability',
      about: '', dayRate: null, docs: [],
    }, o);
    const traders = [
      T('t1', 'Dan Reeves', 'Reeves Electrical', 'electrician', 'Surbiton', { accred: 'NICEIC Approved Contractor', rating: 4.9, reviews: 87, jobsDone: 132, years: 14, responseMins: 6, dayRate: 280, since: 'March 2025', about: 'Domestic and light commercial electrics across Kingston and Elmbridge. Consumer units, rewires, EV chargers, lighting and EICRs. Clean, tidy and on time.' }),
      T('t2', 'Marcus Bell', 'Bell Plumbing and Heating', 'plumber', 'Tolworth', { accred: 'WaterSafe approved', rating: 4.9, reviews: 112, jobsDone: 190, years: 17, responseMins: 9, dayRate: 260, about: 'Leaks, bathrooms, unvented cylinders and heating upgrades. Same day callouts when I can.' }),
      T('t3', 'Priya Nair', 'Nair Gas Services', 'gas', 'New Malden', { accred: 'Gas Safe registered 584112', rating: 5.0, reviews: 64, jobsDone: 98, years: 9, responseMins: 14, about: 'Boiler servicing, repairs and landlord gas safety certificates.' }),
      T('t4', 'Tom Hadley', 'Hadley Joinery', 'carpenter', 'Long Ditton', { rating: 4.8, reviews: 51, jobsDone: 77, years: 21, responseMins: 25, about: 'Bespoke joinery, fitted wardrobes, doors and staircases.' }),
      T('t5', 'Kieran Walsh', 'Walsh Roofing', 'roofer', 'Chessington', { accred: 'NFRC member', rating: 4.7, reviews: 39, jobsDone: 58, years: 12, responseMins: 30 }),
      T('t6', 'Sam Okafor', 'Okafor Decorating', 'decorator', 'Kingston', { rating: 4.9, reviews: 73, jobsDone: 104, years: 8, responseMins: 11 }),
      T('t7', 'Luke Prentice', 'Prentice Builders', 'builder', 'Esher', { accred: 'FMB member', rating: 4.8, reviews: 46, jobsDone: 41, years: 19, responseMins: 40 }),
      T('t8', 'Jodie Marsh', 'JM Tiling', 'tiler', 'Thames Ditton', { rating: 5.0, reviews: 58, jobsDone: 83, years: 11, responseMins: 16 }),
      T('t9', 'Craig Fenwick', 'Fenwick Kitchens', 'kitchen', 'Hook', { rating: 4.8, reviews: 33, jobsDone: 47, years: 15, responseMins: 35 }),
      T('t10', 'Ollie Grant', 'Grant Landscapes', 'landscaper', 'Claygate', { rating: 4.9, reviews: 42, jobsDone: 66, years: 7, responseMins: 20 }),
      T('t11', 'Ben Carter', 'Carter Locks', 'locksmith', 'Berrylands', { accred: 'MLA approved', rating: 4.9, reviews: 95, jobsDone: 240, years: 10, responseMins: 4 }),
      T('t12', 'Ryan Doyle', 'Doyle Plastering', 'plasterer', 'Teddington', { rating: 4.8, reviews: 37, jobsDone: 62, years: 13, responseMins: 22 }),
      T('t13', 'Alex Moreno', 'Moreno Electrical', 'electrician', 'Twickenham', { accred: 'NAPIT registered', rating: 4.8, reviews: 49, jobsDone: 71, years: 8, responseMins: 10 }),
      T('t14', 'Nathan Price', 'Price Plumbing', 'plumber', 'Wimbledon', { rating: 4.7, reviews: 28, jobsDone: 44, years: 6, responseMins: 18 }),
      T('t15', 'Gary Holt', 'Holt Handyman Services', 'handyman', 'Worcester Park', { rating: 4.9, reviews: 120, jobsDone: 310, years: 16, responseMins: 8 }),
      T('t16', 'Will Ashby', 'Ashby Bathrooms', 'bathroom', 'East Molesey', { rating: 4.9, reviews: 31, jobsDone: 39, years: 12, responseMins: 28 }),
      T('t17', 'Ethan Shaw', 'Shaw Brickwork', 'bricklayer', 'Raynes Park', { rating: 4.7, reviews: 22, jobsDone: 35, years: 9, responseMins: 45, online: false }),
      T('t18', 'Hannah Lowe', 'Lowe Floors', 'flooring', 'Richmond', { rating: 4.9, reviews: 44, jobsDone: 70, years: 7, responseMins: 19 }),
      T('t19', 'Josh Reid', 'Reid Glazing', 'windows', 'Ewell', { accred: 'FENSA registered', rating: 4.8, reviews: 26, jobsDone: 38, years: 10, responseMins: 33 }),
      T('t20', 'Danny Kerr', 'Kerr Drainage', 'drainage', 'Hampton Wick', { rating: 4.8, reviews: 57, jobsDone: 160, years: 11, responseMins: 7 }),
      T('t21', 'Lewis Hart', 'Hart Electrical', 'electrician', 'Kingston', { accred: 'NICEIC registered', rating: 4.9, reviews: 68, jobsDone: 101, years: 12, responseMins: 9 }),
      T('t22', 'Mo Rahman', 'Rahman Heating', 'gas', 'Surbiton', { accred: 'Gas Safe registered 601734', rating: 4.9, reviews: 81, jobsDone: 150, years: 13, responseMins: 12, online: false }),
      T('t23', 'Chris Daly', 'Daly Carpentry', 'carpenter', 'Twickenham', { status: 'pending', online: false, rating: 0, reviews: 0, jobsDone: 0, years: 6, since: 'Today' }),
      T('t24', 'Aaron Field', 'Field Roofing', 'roofer', 'Epsom', { status: 'pending', online: false, rating: 0, reviews: 0, jobsDone: 0, years: 15, since: 'Yesterday', accred: 'NFRC member' }),
      T('t25', 'Zara Patel', 'ZP Electrical', 'electrician', 'New Malden', { status: 'pending', online: false, rating: 0, reviews: 0, jobsDone: 0, years: 5, since: 'Today', accred: 'NICEIC registered' }),
      T('t26', 'Steve Mullan', 'Mullan Plumbing', 'plumber', 'Raynes Park', { rating: 4.8, reviews: 35, jobsDone: 52, years: 9, responseMins: 15 }),
      T('t27', 'Kofi Asante', 'Asante Decor', 'decorator', 'New Malden', { rating: 4.8, reviews: 29, jobsDone: 40, years: 6, responseMins: 21 }),
      T('t28', 'Rob Turner', 'Turner Handyman', 'handyman', 'Surbiton', { rating: 4.8, reviews: 64, jobsDone: 140, years: 9, responseMins: 10 }),
      T('t29', 'Callum Byrne', 'Byrne Groundworks', 'labourer', 'Tolworth', { rating: 4.8, reviews: 19, jobsDone: 44, years: 4, responseMins: 9, dayRate: 140 }),
      T('t30', 'Dean Fox', 'Fox Scaffolding', 'scaffolder', 'Chessington', { rating: 4.7, reviews: 23, jobsDone: 60, years: 14, responseMins: 26, accred: 'CISRS card holder' }),
      T('t31', 'Owen Lacey', 'Lacey Fencing', 'fencer', 'Claygate', { rating: 4.9, reviews: 34, jobsDone: 71, years: 11, responseMins: 18 }),
      T('t32', 'Imran Ali', 'Cool Air Surrey', 'aircon', 'New Malden', { rating: 4.9, reviews: 27, jobsDone: 48, years: 8, responseMins: 20, accred: 'F-Gas certified' }),
      T('t33', 'Josh Kemp', 'Kemp Labour', 'labourer', 'Surbiton', { rating: 4.9, reviews: 15, jobsDone: 31, years: 3, responseMins: 6, dayRate: 130 }),
    ];
    let foundingN = 0;
    traders.forEach((t, i) => {
      t.home = t.pos.slice();
      if (t.status === 'verified') { t.founding = true; t.foundingNo = ++foundingN; }
      t.invites = t.status === 'verified' ? Math.floor(r() * 6) : 0;
      t.freeTomorrow = ['labourer', 'handyman', 'decorator', 'plasterer'].includes(t.trade) ? r() > 0.25 : r() > 0.7;
      t.appsYear = t.status === 'verified' ? Math.round(t.jobsDone * (0.35 + r() * 0.2)) : 0;
      const doc = (type, detail, status) => ({ type, detail, status: status || (t.status === 'verified' ? 'approved' : 'waiting') });
      t.docs = [doc('Photo ID', 'Driving licence, face match passed'), doc('Public liability insurance', '£2m cover, renews ' + ['March', 'June', 'August', 'October'][Math.floor(r() * 4)] + ' 2027')];
      if (t.accred) t.docs.push(doc('Accreditation', t.accred));
      if (!t.about) t.about = 'Local, insured and fully verified on Trade Hunter. Free quotes, tidy work and a proper finish.';
      if (!t.dayRate) t.dayRate = 200 + Math.round(r() * 12) * 10;
    });

    const customers = [
      { id: 'c1', name: 'Emma Clarke', area: 'Long Ditton', postcode: 'KT6 5RL', kind: 'Homeowner' },
      { id: 'c2', name: 'Rachel Moss', area: 'Surbiton', postcode: 'KT6 4QA', kind: 'Homeowner' },
      { id: 'c3', name: 'James Whitford', area: 'Esher', postcode: 'KT10 9LP', kind: 'Homeowner' },
      { id: 'c4', name: 'Harbour Lettings', area: 'Kingston', postcode: 'KT1 1QU', kind: 'Letting agent' },
      { id: 'c5', name: 'Nina Osei', area: 'Tolworth', postcode: 'KT6 7DS', kind: 'Homeowner' },
      { id: 'c6', name: 'Paul Brennan', area: 'New Malden', postcode: 'KT3 4NE', kind: 'Landlord' },
      { id: 'c7', name: 'Sophie Grant', area: 'Thames Ditton', postcode: 'KT7 0RH', kind: 'Homeowner' },
      { id: 'c8', name: 'Kingsway Property', area: 'Wimbledon', postcode: 'SW19 1QL', kind: 'Property manager' },
      { id: 'c9', name: 'Tariq Hussain', area: 'Chessington', postcode: 'KT9 2HD', kind: 'Homeowner' },
      { id: 'c10', name: 'Lucy Parker', area: 'Teddington', postcode: 'TW11 8PB', kind: 'Homeowner' },
      { id: 'c11', name: 'Mark Ellis', area: 'Claygate', postcode: 'KT10 0HR', kind: 'Homeowner' },
      { id: 'c12', name: 'Grace Fielding', area: 'Hampton Wick', postcode: 'KT1 4DA', kind: 'Homeowner' },
      { id: 'c13', name: 'Prentice Builders', area: 'Esher', postcode: 'KT10 8AN', kind: 'Trade' },
      { id: 'c14', name: 'Hart Electrical', area: 'Kingston', postcode: 'KT2 6QW', kind: 'Trade' },
      { id: 'c15', name: 'Fenwick Kitchens', area: 'Hook', postcode: 'KT9 1EP', kind: 'Trade' },
      { id: 'c16', name: 'Reeves Electrical', area: 'Surbiton', postcode: 'KT6 4HL', kind: 'Trade' },
    ];

    let refN = 40112;
    const now = Date.now();
    const J = (o) => {
      const c = customers.find((x) => x.id === o.customerId);
      const pos = o.pos || place(c.area, 0.008);
      return Object.assign({
        id: uid('j'), ref: 'TH-' + (refN++), status: 'open', postedAt: now - 2 * HOUR, budget: BUDGETS[1], when: WHEN[1],
        area: c.area, postcode: c.postcode, pos, applications: [], hiredId: null, scheduledFor: null, agreed: null,
        startedAt: null, doneAt: null, review: null, photos: [], views: Math.round(10 + r() * 40),
        start: atDay(1 + Math.floor(r() * 9), 8), duration: DURATIONS[Math.floor(r() * 3)], dayRate: null,
      }, o);
    };
    const A = (traderId, minsAgo, quote, message, status) => ({ traderId, at: now - minsAgo * MIN, quote, message, status: status || 'pending' });

    const jobs = [
      // Emma's jobs (the customer side of the demo)
      J({ customerId: 'c1', trade: 'electrician', title: 'New consumer unit and two extra kitchen sockets', desc: 'Old fuse box in the hallway cupboard, trips now and then. Would like it replaced and two double sockets added above the worktop. House is a 1930s semi.', budget: BUDGETS[3], when: WHEN[1], postedAt: now - 3 * HOUR, views: 41,
        applications: [
          A('t21', 150, 640, 'Hi Emma, I can do the board swap and the two sockets in one day. Price includes the certificate and Part P notification. I\'m free Thursday.'),
          A('t13', 95, 590, 'Hello, happy to take a look first if you want a fixed price. Board would be a Hager 10 way with surge protection.'),
        ] }),
      J({ customerId: 'c1', trade: 'plumber', title: 'Leak under the kitchen sink', desc: 'Slow drip from the waste pipe under the sink, cupboard base is getting soaked.', budget: BUDGETS[0], when: WHEN[0], postedAt: now - 26 * HOUR, status: 'hired', hiredId: 't2', agreed: 120, scheduledFor: atDay(1, 9, 0), views: 22,
        applications: [A('t2', 1500, 120, 'I can be with you first thing tomorrow, 9am. £120 covers the visit and a new trap and waste if needed.', 'hired'), A('t14', 1480, 140, 'Can come Wednesday afternoon.', 'declined'), A('t26', 1470, 110, 'Free Friday morning if that helps.', 'declined')] }),
      J({ customerId: 'c1', trade: 'decorator', title: 'Paint living room and hallway', desc: 'Walls and ceilings, two coats, white skirting.', budget: BUDGETS[2], when: WHEN[2], postedAt: now - 19 * DAY, status: 'done', hiredId: 't6', agreed: 780, startedAt: now - 12 * DAY, doneAt: now - 10 * DAY, views: 37,
        review: { stars: 5, text: 'Sam was brilliant. Neat lines, dust sheets everywhere and finished a day early.', at: now - 10 * DAY },
        applications: [A('t6', 19 * 1440, 780, 'I can start the 14th, two days.', 'hired'), A('t27', 19 * 1400, 820, 'Free next week.', 'declined')] }),

      // Open jobs around the area (the trade feed)
      J({ customerId: 'c3', trade: 'electrician', title: 'EV charger on the driveway', desc: 'Tesla Model Y. Meter is on the front of the house, driveway right next to it. Would like a tethered 7kW charger.', budget: BUDGETS[2], when: WHEN[2], postedAt: now - 55 * MIN, views: 19, applications: [A('t13', 30, 945, 'I install Zappi and Ohme units, both work well with the Tesla. Happy to survey first.')] }),
      J({ customerId: 'c5', trade: 'electrician', title: 'Outside lights stopped working after the rain', desc: 'Two wall lights by the back door, the RCD keeps tripping when they switch on.', budget: BUDGETS[0], when: WHEN[0], postedAt: now - 22 * MIN, views: 8 }),
      J({ customerId: 'c6', trade: 'electrician', title: 'Full rewire, three bed semi', desc: 'Empty property between tenants, can give full access for two weeks. Need EICR at the end.', budget: BUDGETS[4], when: WHEN[2], postedAt: now - 5 * HOUR, views: 64, applications: [A('t21', 200, 5400, 'Done plenty of these, can start on the 1st.'), A('t25', 150, 4900, 'Available from next Monday.')] }),
      J({ customerId: 'c4', trade: 'electrician', title: 'EICR for a two bed rental flat', desc: 'Landlord electrical certificate due by the end of the month. Tenant works from home so mornings are best.', budget: BUDGETS[0], when: WHEN[1], postedAt: now - 3.5 * HOUR, views: 27, applications: [A('t13', 120, 165, 'Can do Friday morning.')] }),
      J({ customerId: 'c7', trade: 'electrician', title: 'Six downlights in the kitchen ceiling', desc: 'Swap the single pendant for six LED downlights on a dimmer.', budget: BUDGETS[1], when: WHEN[1], postedAt: now - 7 * HOUR, views: 33 }),
      J({ customerId: 'c9', trade: 'roofer', title: 'Flat roof over the extension is leaking', desc: 'Felt roof about 15 years old, water coming through near the rooflight.', budget: BUDGETS[3], when: WHEN[0], postedAt: now - 70 * MIN, views: 15, applications: [A('t5', 40, 2350, 'Sounds like the felt has had it. I\'d recommend a GRP fibreglass roof, 20 year guarantee.')] }),
      J({ customerId: 'c10', trade: 'gas', title: 'Annual boiler service', desc: 'Worcester Bosch combi, about six years old.', budget: BUDGETS[0], when: WHEN[2], postedAt: now - 4 * HOUR, views: 12, applications: [A('t3', 180, 85, 'Can fit you in on Tuesday.')] }),
      J({ customerId: 'c11', trade: 'landscaper', title: 'Fence panels down after the storm', desc: 'Four panels and two concrete posts along the back boundary.', budget: BUDGETS[1], when: WHEN[1], postedAt: now - 2.5 * HOUR, views: 21 }),
      J({ customerId: 'c12', trade: 'bathroom', title: 'Retile the shower enclosure', desc: 'Tiles cracking and grout gone black. About 6 square metres.', budget: BUDGETS[2], when: WHEN[2], postedAt: now - 9 * HOUR, views: 30, applications: [A('t8', 400, 720, 'Can strip and retile in two days.'), A('t16', 300, 860, 'I\'d also replace the tray while it\'s open.')] }),
      J({ customerId: 'c8', trade: 'drainage', title: 'Blocked drain at the front of a block of flats', desc: 'Manhole is full, residents reporting smells.', budget: BUDGETS[0], when: WHEN[0], postedAt: now - 35 * MIN, views: 9 }),
      J({ customerId: 'c2', trade: 'plasterer', title: 'Skim two bedrooms', desc: 'Walls only, old wallpaper already stripped.', budget: BUDGETS[2], when: WHEN[2], postedAt: now - 11 * HOUR, views: 26, applications: [A('t12', 500, 650, 'Two days, can start Monday week.')] }),
      J({ customerId: 'c6', trade: 'locksmith', title: 'Change the locks after a tenant moved out', desc: 'Front door euro cylinder and a back door mortice.', budget: BUDGETS[0], when: WHEN[0], postedAt: now - 15 * MIN, views: 5 }),
      // Trade to trade: day-rate work posted by firms that need a hand
      J({ customerId: 'c13', trade: 'labourer', title: 'Labourer needed on a house extension', desc: 'General labouring, site clean and helping the bricklayers. Own PPE and CSCS card please. All experience welcome.', budget: null, dayRate: 140, duration: 'About a week', start: atDay(3, 8), when: WHEN[1], postedAt: now - 4 * HOUR, views: 52, applications: [A('t15', 200, 140, 'Can do the full week, own PPE and CSCS.')] }),
      J({ customerId: 'c14', trade: 'electrician', title: 'Second fix electrician, new build flats', desc: 'Four flats ready for second fix. Need an approved electrician for three days alongside our team, materials supplied.', budget: null, dayRate: 250, duration: '2 to 3 days', start: atDay(2, 8), when: WHEN[1], postedAt: now - 80 * MIN, views: 23 }),
      J({ customerId: 'c15', trade: 'plumber', title: 'Plumber for two kitchen installs', desc: 'Sinks, dishwashers and a boiling water tap on each. Kitchens fitted by us, you connect and test.', budget: null, dayRate: 230, duration: '2 to 3 days', start: atDay(5, 8), when: WHEN[2], postedAt: now - 6 * HOUR, views: 31, applications: [A('t26', 300, 230, 'Free that week, happy to work around your fitters.')] }),
      J({ customerId: 'c13', trade: 'scaffolder', title: 'Scaffold for a rear loft conversion', desc: 'Two lifts across the back elevation, about eight weeks hire.', budget: BUDGETS[3], duration: 'Two weeks or more', when: WHEN[2], postedAt: now - 13 * HOUR, views: 19 }),
      J({ customerId: 'c11', trade: 'fencer', title: 'New close board fence, 20 metres', desc: 'Replacing an old panel fence along one side of the garden. Concrete posts and gravel boards.', budget: BUDGETS[3], when: WHEN[2], postedAt: now - 8 * HOUR, views: 17 }),
      J({ customerId: 'c3', trade: 'aircon', title: 'Air conditioning in two bedrooms', desc: 'Wall mounted split units, outdoor unit on the side return.', budget: BUDGETS[3], when: WHEN[2], postedAt: now - 15 * HOUR, views: 28 }),
      J({ customerId: 'c5', trade: 'kitchen', title: 'Replace laminate worktops with oak', desc: 'L shaped kitchen, about 4.5 metres in total, one sink cut out and a hob.', budget: BUDGETS[3], when: WHEN[2], postedAt: now - 20 * HOUR, views: 48 }),

      // Dan's pipeline (the trade side of the demo)
      J({ customerId: 'c2', trade: 'electrician', title: 'Replace kitchen light fittings', desc: 'Three old spotlight bars to swap for pendants over the island.', budget: BUDGETS[0], when: WHEN[1], postedAt: now - 2 * DAY, status: 'hired', hiredId: 't1', agreed: 210, scheduledFor: atDay(0, 14, 0), views: 18,
        applications: [A('t1', 2800, 210, 'Can do this Thursday afternoon, two hours.', 'hired')] }),
      J({ customerId: 'c7', trade: 'electrician', title: 'Garden office power supply', desc: 'Armoured cable from the house to a new garden office, about 18 metres.', budget: BUDGETS[3], when: WHEN[2], postedAt: now - 30 * HOUR, views: 36,
        applications: [A('t1', 1700, 1350, 'Survey free, I\'d run 6mm SWA with its own board in the office.'), A('t21', 1650, 1490, 'Can start the week after next.')] }),
    ];
    // Dan's finished work this month
    const doneTitles = [['c11', 'Fault finding, tripping RCD', 140, 3], ['c9', 'EICR and two remedial fixes', 260, 6], ['c12', 'Outdoor socket and garden lights', 390, 9], ['c3', 'Consumer unit upgrade', 620, 13], ['c10', 'Smoke alarms, interlinked', 230, 17], ['c4', 'Rental flat EICR', 160, 21]];
    doneTitles.forEach(([cid, title, amt, d], i) => {
      jobs.push(J({ customerId: cid, trade: 'electrician', title, desc: '', status: 'done', hiredId: 't1', agreed: amt, postedAt: now - (d + 3) * DAY, startedAt: now - d * DAY, doneAt: now - d * DAY + 3 * HOUR,
        review: { stars: i === 1 ? 4 : 5, text: ['Quick, tidy and explained everything.', 'Good job, turned up a bit late but called ahead.', 'Lovely work, the garden looks great at night.', 'Dan was excellent. Fair price and no mess.', 'Really professional, would use again.', 'Sorted the certificate the same day.'][i], at: now - d * DAY + 5 * HOUR },
        applications: [A('t1', (d + 3) * 1440, amt, '', 'hired')] }));
    });

    const threads = {};
    const thread = (job, tid, msgs) => { threads[job.id + '|' + tid] = msgs; };
    const emmaLeak = jobs[1], emmaBoard = jobs[0], rachel = jobs.find((j) => j.customerId === 'c2' && j.hiredId === 't1');
    thread(emmaLeak, 't2', [
      { from: 't', text: 'Hi Emma, I can be with you first thing tomorrow, 9am. £120 covers the visit and a new trap and waste if needed.', at: now - 25 * HOUR },
      { from: 'c', text: 'Perfect, 9 works. It\'s the cupboard to the left of the dishwasher.', at: now - 24.6 * HOUR },
      { from: 't', kind: 'quote', amount: 120, text: 'Leak under the kitchen sink. Callout, new trap and waste fitted, tested.', at: now - 24.5 * HOUR, accepted: true },
      { from: 'c', text: 'Accepted, see you tomorrow.', at: now - 24.4 * HOUR },
      { from: 't', text: 'Great. Pop a towel down tonight and keep a bowl under it.', at: now - 24.3 * HOUR },
    ]);
    thread(emmaBoard, 't21', [{ from: 't', text: emmaBoard.applications[0].message, at: emmaBoard.applications[0].at }]);
    thread(emmaBoard, 't13', [{ from: 't', text: emmaBoard.applications[1].message, at: emmaBoard.applications[1].at }]);
    thread(rachel, 't1', [
      { from: 't', text: 'Can do this Thursday afternoon, two hours.', at: now - 47 * HOUR },
      { from: 'c', text: 'Brilliant. The pendants are already here, you just need to fit them.', at: now - 46 * HOUR },
      { from: 't', kind: 'quote', amount: 210, text: 'Remove three spotlight bars, fit three pendants over the island, make good.', at: now - 45.8 * HOUR, accepted: true },
      { from: 'c', text: 'See you at 2. Parking on the drive is fine.', at: now - 3 * HOUR },
    ]);

    // HQ history: 12 weeks of platform activity
    const weeks = [];
    let base = 38;
    for (let i = 11; i >= 0; i--) {
      base = base * (1.06 + r() * 0.08);
      const posted = Math.round(base), apps = Math.round(posted * (2.6 + r() * 0.8)), hires = Math.round(posted * (0.55 + r() * 0.12));
      weeks.push({ label: new Date(now - i * 7 * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), posted, apps, hires, signups: Math.round(6 + r() * 10 + (11 - i) * 1.4) });
    }

    const activity = [
      ['signup', 'Zara Patel (ZP Electrical) joined and uploaded 3 documents', 18],
      ['post', 'Locksmith job posted in New Malden', 15],
      ['post', 'Outside lights job posted in Tolworth', 22],
      ['apply', 'Alex Moreno applied to an EV charger job in Esher', 30],
      ['post', 'Blocked drain posted in Wimbledon by Kingsway Property', 35],
      ['apply', 'Kieran Walsh applied to a flat roof job in Chessington', 40],
      ['hire', 'Rachel Moss hired Dan Reeves, £210 agreed', 2880],
      ['review', 'Emma Clarke left Sam Okafor 5 stars', 14400],
      ['signup', 'Chris Daly (Daly Carpentry) joined, waiting on insurance check', 55],
    ].map(([type, text, m]) => ({ id: uid('a'), type, text, at: now - m * MIN }));

    const tDan = traders.find((t) => t.id === 't1'); tDan.invites = 6; tDan.invitesJoined = 4; tDan.foundingNo = 12; tDan.appsYear = 46;
    // how trades have rated each customer
    const crate = { c1: [5.0, 4], c2: [4.9, 7], c3: [4.8, 3], c4: [4.7, 22], c5: [5.0, 2], c6: [4.4, 9], c7: [4.9, 5], c8: [4.6, 14], c9: [4.8, 3], c10: [5.0, 2], c11: [4.9, 4], c12: [5.0, 1], c13: [4.9, 31], c14: [4.8, 12], c15: [4.7, 9], c16: [5.0, 6] };
    customers.forEach((c) => { const x = crate[c.id] || [5, 1]; c.rating = x[0]; c.ratings = x[1]; c.paidOnTime = x[0] >= 4.7; });
    return {
      v: 3, seededAt: now, traders, customers, jobs, threads, weeks, activity,
      crew: ['t33', 't29'], foundingTarget: 100,
      me: { customerId: 'c1', traderId: 't1', tradeCustomerId: 'c16' }, notes: [], sims: [],
      ideas: [
        { id: 'i1', from: 'Gary Holt', text: 'Let me save jobs to look at later', at: now - 3 * DAY, votes: 14 },
        { id: 'i2', from: 'Jodie Marsh', text: 'Show which trades have a CSCS card', at: now - 6 * DAY, votes: 9 },
        { id: 'i3', from: 'Prentice Builders', text: 'Post the same labourer job every week without retyping it', at: now - 9 * DAY, votes: 21 },
      ],
      reports: [
        { id: 'r1', at: now - 5 * HOUR, about: 'Job TH-40125', text: 'Customer says the trader asked to be paid in cash before starting.', status: 'open' },
        { id: 'r2', at: now - 2 * DAY, about: 'Review on Price Plumbing', text: 'Trader disputes a one star review from someone who never booked.', status: 'open' },
      ],
    };
  }

  /* ---------- persistence ---------- */
  let state = null;
  const listeners = [];
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.v === 3 && Date.now() - s.seededAt < 36 * HOUR) return s;
      }
    } catch (e) { /* private mode */ }
    const s = seed();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function get() { if (!state) state = load(); return state; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} emit(); }
  function emit() { listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }
  function on(fn) { listeners.push(fn); }
  global.addEventListener('storage', (e) => { if (e.key === KEY && e.newValue) { state = JSON.parse(e.newValue); emit(); } });
  function reset() { state = seed(); save(); }

  /* ---------- lookups ---------- */
  const trade = (id) => TRADES.find((t) => t.id === id) || { id, name: id, icon: 'wrench' };
  const trader = (id) => get().traders.find((t) => t.id === id);
  const customer = (id) => get().customers.find((c) => c.id === id);
  const job = (id) => get().jobs.find((j) => j.id === id);
  const thread = (jobId, traderId) => get().threads[jobId + '|' + traderId] || [];

  function log(type, text) { get().activity.unshift({ id: uid('a'), type, text, at: Date.now() }); get().activity.length = Math.min(get().activity.length, 80); }
  function notify(to, text, link) { get().notes.unshift({ id: uid('n'), to, text, link: link || null, at: Date.now(), read: false }); }
  function posterSide(j) { const me = get().me; return j.customerId === me.customerId ? 'customer' : j.customerId === me.tradeCustomerId ? 'trade' : null; }
  function push(jobId, traderId, msg) { const k = jobId + '|' + traderId; (get().threads[k] = get().threads[k] || []).push(Object.assign({ at: Date.now() }, msg)); }

  /* ---------- actions ---------- */
  function postJob(d) {
    const s = get();
    const c = customer(d.customerId || s.me.customerId);
    const a = AREAS[c.area] || AREAS.Surbiton;
    const j = {
      id: uid('j'), ref: 'TH-' + (40200 + s.jobs.length), customerId: c.id, trade: d.trade, title: d.title, desc: d.desc || '',
      budget: d.budget || BUDGETS[5], when: d.when || WHEN[1], area: c.area, postcode: c.postcode,
      pos: [a[0] + (Math.random() - 0.5) * 0.004, a[1] + (Math.random() - 0.5) * 0.006],
      status: 'open', postedAt: Date.now(), applications: [], hiredId: null, scheduledFor: null, agreed: null, startedAt: null, doneAt: null, review: null,
      photos: d.photos || [], views: 0, dayRate: d.dayRate || null, start: d.start || null, duration: d.duration || null,
    };
    s.jobs.unshift(j);
    log('post', trade(j.trade).name + ' job posted in ' + j.area + ': ' + j.title);
    // matching traders nearby apply over the next few seconds (never the demo trader, who applies by hand)
    j.repeat = d.repeat || null;
    const matches = d.quiet ? [] : s.traders.filter((t) => t.trade === j.trade && t.status === 'verified' && t.id !== s.me.traderId)
      .sort((x, y) => miles(x.pos, j.pos) - miles(y.pos, j.pos)).slice(0, 3);
    const delays = [5000, 11000, 19000];
    matches.forEach((t, i) => s.sims.push({ kind: 'apply', jobId: j.id, traderId: t.id, dueAt: Date.now() + delays[i] }));
    if (j.trade === trader(s.me.traderId).trade && c.id !== s.me.tradeCustomerId) notify('trade', 'New ' + trade(j.trade).name.toLowerCase() + ' job ' + milesLabel(miles(trader(s.me.traderId).pos, j.pos)) + ' away: ' + j.title, { job: j.id });
    save();
    return j;
  }

  const OPENERS = [
    (j, t) => 'Hi, I\'m ' + t.name.split(' ')[0] + ' from ' + t.business + '. I\'m local to ' + t.area + ' and can come and look this week.',
    (j, t) => 'Hello, this is right up my street. Happy to give you a fixed price once I\'ve seen it.',
    (j, t) => 'Hi there, I\'ve got availability ' + ['tomorrow morning', 'Thursday', 'Friday afternoon'][Math.floor(Math.random() * 3)] + '. Fully insured, photos of similar jobs on my profile.',
  ];
  const dl = (t) => { const x = dayLabel(t); return /^(Today|Tomorrow|Yesterday)$/.test(x) ? x.toLowerCase() : 'on ' + x; };
  const DAY_OPENERS = [
    (j, t) => 'Hi, I\'m ' + t.name.split(' ')[0] + '. Free ' + (j.start ? dl(j.start) : 'tomorrow') + ', own PPE and transport, CSCS card. Can stay for the whole job.',
    (j, t) => 'Can start ' + (j.start ? dl(j.start) : 'when you need') + '. ' + t.years + ' years on site, references on my profile.',
    (j, t) => 'Available for this. Based in ' + t.area + ' so I can be on site by 7.30.',
  ];
  const BANDS = { 'Under £250': [90, 240], '£250 to £500': [260, 490], '£500 to £1,000': [520, 980], '£1,000 to £5,000': [1100, 4200], '£5,000 and over': [5200, 9800], 'Not sure yet': [150, 900] };
  function guessQuote(j) { if (j.dayRate) return j.dayRate; const b = BANDS[j.budget] || [150, 600]; return Math.round((b[0] + Math.random() * (b[1] - b[0])) / 5) * 5; }

  function apply(jobId, traderId, message, quote) {
    const j = job(jobId), t = trader(traderId);
    if (!j || !t || j.applications.some((a) => a.traderId === traderId)) return;
    const msg = message || (j.dayRate ? DAY_OPENERS : OPENERS)[j.applications.length % 3](j, t);
    j.applications.push({ traderId, at: Date.now(), quote: quote || guessQuote(j), message: msg, status: 'pending' });
    push(jobId, traderId, { from: 't', text: msg });
    log('apply', t.name + ' applied to ' + j.title.toLowerCase() + ' in ' + j.area);
    if (posterSide(j)) notify(posterSide(j), t.name + ' applied to ' + j.title, { job: j.id });
    save();
  }
  function hire(jobId, traderId) {
    const j = job(jobId), t = trader(traderId);
    j.status = 'hired'; j.hiredId = traderId;
    const a = j.applications.find((x) => x.traderId === traderId);
    j.agreed = a ? a.quote : j.agreed;
    j.scheduledFor = j.scheduledFor || atDay(1, 9, 0);
    j.applications.forEach((x) => { x.status = x.traderId === traderId ? 'hired' : 'declined'; });
    push(jobId, traderId, { from: 'sys', text: 'Job booked. ' + money(j.agreed) + (j.dayRate ? ' a day' : '') + ' agreed.' });
    log('hire', customer(j.customerId).name + ' hired ' + t.name + ', ' + money(j.agreed) + ' agreed');
    if (traderId === get().me.traderId) notify('trade', customer(j.customerId).name + ' hired you for ' + j.title, { job: j.id });
    save();
  }
  function shortlist(jobId, traderId, on) { const a = job(jobId).applications.find((x) => x.traderId === traderId); if (a && a.status === 'pending' || a && a.status === 'shortlisted') { a.status = on ? 'shortlisted' : 'pending'; save(); } }
  function message(jobId, traderId, from, text, extra) {
    push(jobId, traderId, Object.assign({ from, text }, extra || {}));
    const j = job(jobId), me = get().me;
    if (from === 'c' && traderId !== me.traderId) get().sims.push({ kind: 'reply', jobId, traderId, text, dueAt: Date.now() + 2600 + Math.random() * 1800 });
    if (from === 'c' && traderId === me.traderId) notify('trade', customer(j.customerId).name + ': ' + text, { job: jobId, chat: traderId });
    if (from === 't' && posterSide(j)) notify(posterSide(j), trader(traderId).name + ': ' + (extra && extra.kind === 'quote' ? 'sent a quote for ' + money(extra.amount) : text), { job: jobId, chat: traderId });
    save();
  }
  function acceptQuote(jobId, traderId, idx) {
    const msgs = get().threads[jobId + '|' + traderId]; const m = msgs && msgs[idx];
    if (!m || m.kind !== 'quote') return;
    m.accepted = true;
    const a = job(jobId).applications.find((x) => x.traderId === traderId); if (a) a.quote = m.amount;
    hire(jobId, traderId);
  }
  function setStatus(jobId, status) {
    const j = job(jobId);
    j.status = status;
    if (status === 'started') { j.startedAt = Date.now(); log('start', trader(j.hiredId).name + ' started ' + j.title.toLowerCase()); if (posterSide(j)) notify(posterSide(j), trader(j.hiredId).name + ' has started work', { job: j.id }); }
    if (status === 'onway') { log('start', trader(j.hiredId).name + ' is on the way to ' + j.area); if (posterSide(j)) notify(posterSide(j), trader(j.hiredId).name + ' is on the way', { job: j.id }); }
    if (status === 'done') { j.doneAt = Date.now(); log('done', trader(j.hiredId).name + ' finished ' + j.title.toLowerCase() + ', ' + money(j.agreed)); if (posterSide(j)) notify(posterSide(j), trader(j.hiredId).name + ' marked the job complete. Leave a review?', { job: j.id }); }
    save();
  }
  function review(jobId, stars, text) {
    const j = job(jobId), t = trader(j.hiredId);
    j.review = { stars, text, at: Date.now() }; j.status = 'done'; j.doneAt = j.doneAt || Date.now();
    t.rating = Math.round(((t.rating * t.reviews) + stars) / (t.reviews + 1) * 10) / 10; t.reviews += 1; t.jobsDone += 1;
    log('review', customer(j.customerId).name + ' left ' + t.name + ' ' + stars + ' star' + (stars > 1 ? 's' : ''));
    if (t.id === get().me.traderId) notify('trade', 'New ' + stars + ' star review from ' + customer(j.customerId).name);
    save();
  }
  function setFreeTomorrow(traderId, on) { const t = trader(traderId); t.freeTomorrow = on; if (on) log('online', t.name + ' is free tomorrow'); save(); }
  function rateCustomer(jobId, stars, tags) {
    const j = job(jobId), c = customer(j.customerId);
    j.custReview = { stars, tags: tags || [], at: Date.now() };
    c.rating = Math.round(((c.rating * c.ratings) + stars) / (c.ratings + 1) * 10) / 10; c.ratings += 1;
    if (tags && tags.includes('Paid on time')) c.paidOnTime = true;
    log('review', trader(j.hiredId).name + ' rated ' + c.name + ' ' + stars + ' stars');
    if (posterSide(j)) notify(posterSide(j), trader(j.hiredId).name + ' rated you ' + stars + ' stars as a customer');
    save();
  }
  function addToCrew(traderId) { const s = get(); s.crew = s.crew || []; if (!s.crew.includes(traderId)) { s.crew.push(traderId); save(); } }
  function invite(traderId) { const t = trader(traderId); t.invites = (t.invites || 0) + 1; log('signup', t.name + ' invited a trade to join'); save(); }
  /* Straight booking of a crew member: offer, then they accept a moment later. */
  function bookCrew(posterId, traderId, d) {
    const j = postJob(Object.assign({ customerId: posterId, quiet: true }, d));
    const s = get(); s.sims = s.sims.filter((x) => x.jobId !== j.id);
    s.sims.push({ kind: 'crew', jobId: j.id, traderId, dueAt: Date.now() + 3200 });
    save(); return j;
  }
  /* Need someone now: ping online trades within 3 miles, the first to accept is booked and on the way. */
  function urgent(d) {
    const s = get();
    const j = postJob(Object.assign({ customerId: s.me.customerId, quiet: true, when: 'As soon as possible', budget: 'Not sure yet' }, d));
    j.urgent = true;
    const near = s.traders.filter((t) => t.trade === j.trade && t.status === 'verified' && t.online && t.id !== s.me.traderId)
      .sort((a, b) => miles(a.pos, j.pos) - miles(b.pos, j.pos));
    const pick = near[0];
    s.sims = s.sims.filter((x) => x.jobId !== j.id);
    if (pick) s.sims.push({ kind: 'urgent', jobId: j.id, traderId: pick.id, dueAt: Date.now() + 7000 });
    j.pinged = near.slice(0, 5).map((t) => t.id);
    log('post', 'Urgent ' + trade(j.trade).name.toLowerCase() + ' request in ' + j.area + ', ' + j.pinged.length + ' trades pinged');
    save(); return j;
  }
  function setOnline(traderId, on) { const t = trader(traderId); t.online = on; log('online', t.name + (on ? ' is available for work' : ' went offline')); save(); }
  function verify(traderId, ok) {
    const t = trader(traderId);
    t.status = ok ? 'verified' : 'rejected';
    t.docs.forEach((d) => { d.status = ok ? 'approved' : 'rejected'; });
    if (ok) { t.online = true; t.rating = 0; }
    log('verify', t.name + (ok ? ' verified and live on the map' : ' rejected, documents returned'));
    save();
  }
  function suggest(from, text) { (get().ideas = get().ideas || []).unshift({ id: uid('i'), from, text, at: Date.now(), votes: 1 }); log('idea', from + ' suggested: ' + text.slice(0, 80)); save(); }
  function readNotes(to) { get().notes.forEach((n) => { if (n.to === to) n.read = true; }); save(); }
  function resolveReport(id) { const r = get().reports.find((x) => x.id === id); if (r) { r.status = 'resolved'; save(); } }

  function priceLabel(j) { return j.dayRate ? money(j.dayRate) + ' a day' : (j.budget || 'Not sure yet'); }

  /* ---------- the clock: due simulations and drifting vans ---------- */
  const REPLIES = [
    [/when|time|day|available|free/i, 'I could do tomorrow at 10, or Friday first thing. Whichever suits you.'],
    [/price|cost|quote|how much|£/i, 'That price is fixed unless I find something unexpected, and I\'d always ask before doing extra.'],
    [/insur|certif|qualif|registered/i, 'Yes, fully insured and the certificates are on my profile. I\'ll leave copies with you too.'],
    [/park|address|where/i, 'No problem, I\'ll message when I\'m ten minutes away.'],
    [/./, 'Thanks, that helps. I\'ll bring everything I need so it\'s done in one visit.'],
  ];
  function tick() {
    const s = get(); const now = Date.now(); let changed = false;
    const due = s.sims.filter((x) => x.dueAt <= now);
    if (due.length) {
      s.sims = s.sims.filter((x) => x.dueAt > now);
      due.forEach((x) => {
        const j = job(x.jobId); if (!j) return;
        if (x.kind === 'apply' && j.status === 'open') { apply(x.jobId, x.traderId); changed = true; }
        if ((x.kind === 'crew' || x.kind === 'urgent') && j.status === 'open') {
          const t = trader(x.traderId);
          const quote = x.kind === 'crew' ? (j.dayRate || t.dayRate) : 95;
          const msg = x.kind === 'crew' ? 'Yes, I can do it. See you at 8.' : 'On my way now, about ' + Math.max(8, Math.round(miles(t.pos, j.pos) * 6 + 6)) + ' minutes.';
          j.applications.push({ traderId: t.id, at: Date.now(), quote, message: msg, status: 'pending' });
          if (x.kind === 'urgent') { j.eta = Date.now() + Math.max(8, Math.round(miles(t.pos, j.pos) * 6 + 6)) * MIN; j.scheduledFor = j.eta; }
          else j.scheduledFor = j.start || atDay(1, 8);
          hire(j.id, t.id);
          if (x.kind === 'urgent') { j.status = 'onway'; }
          push(j.id, t.id, { from: 't', text: msg });
          if (posterSide(j)) notify(posterSide(j), t.name + (x.kind === 'crew' ? ' accepted. Booked for ' + dayLabel(j.scheduledFor).toLowerCase() + '.' : ' accepted and is on the way'), { job: j.id });
          changed = true;
        }
        if (x.kind === 'reply') {
          const reply = REPLIES.find(([re]) => re.test(x.text))[1];
          push(x.jobId, x.traderId, { from: 't', text: reply });
          if (posterSide(j)) notify(posterSide(j), trader(x.traderId).name + ': ' + reply, { job: x.jobId, chat: x.traderId });
          changed = true;
        }
      });
      if (changed) save();
    }
  }
  setInterval(tick, 1000);

  global.TH = {
    KEY, CENTRE, LEAD_PRICE: 35, TRADES, BUDGETS, WHEN, DURATIONS, AREAS, MIN, HOUR, DAY,
    get, save, on, reset, tick,
    trade, trader, customer, job, thread,
    postJob, apply, hire, suggest, posterSide, setFreeTomorrow, rateCustomer, addToCrew, invite, bookCrew, urgent, shortlist, message, acceptQuote, setStatus, review, setOnline, verify, readNotes, resolveReport,
    miles, milesLabel, money, priceLabel, ago, clock, dayLabel, initials,
  };
})(window);
