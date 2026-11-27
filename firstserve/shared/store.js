/* First Serve UK platform preview: shared data engine.
   One store in localStorage, read by the manager portal, the engineer app and the
   management dashboard. Every screen is rendered from this data, and a change in one
   surface (a booking, an engineer pressing Arrived, a parts approval) shows up in the
   others straight away through the storage event. */
(function (global) {
  const KEY = 'fsuk-preview-v4';
  const DAY = 86400000;

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const at = (dayOffset, h, m) => { const d = today(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m || 0, 0, 0); return d.getTime(); };

  const WINDOWS = [
    { id: 'am', label: '8am to 11am', start: 8 },
    { id: 'mid', label: '11am to 2pm', start: 11 },
    { id: 'pm', label: '2pm to 5pm', start: 14 },
  ];
  const PRICES = { next: 99, same: 119, steam: 89 };
  const SERVICE_LABEL = { next: 'Next day repair', same: 'Same day repair', steam: 'Steam clean' };
  const APPLIANCES = ['Washing machine', 'Washer dryer', 'Tumble dryer', 'Dishwasher', 'Fridge freezer', 'Oven or cooker'];
  const STEAM_STEPS = ['Drum', 'Door seal', 'Soap drawer', 'Pump filter', 'Hoses and sump'];
  const BRANDS = ['Bosch', 'Miele', 'Hotpoint', 'Samsung', 'Siemens', 'LG', 'AEG', 'Indesit', 'Zanussi', 'Hoover', 'Smeg', 'Beko', 'Other'];
  const FAULTS = ['Not draining', 'Not spinning', 'Leaking', 'Won\'t start', 'Drum noise', 'Door won\'t open', 'Error code', 'Not heating', 'Smell or smoke'];
  const PARTS = [
    { name: 'Drain pump', price: 68 }, { name: 'Door lock', price: 42 }, { name: 'Carbon brushes', price: 28 },
    { name: 'Heating element', price: 54 }, { name: 'Drum bearings kit', price: 96 }, { name: 'Inlet valve', price: 38 },
    { name: 'Door seal', price: 59 }, { name: 'Control module', price: 148 },
  ];

  const STATUS = {
    booked: { label: 'Booked', tone: 'blue', order: 0 },
    scheduled: { label: 'Engineer assigned', tone: 'blue', order: 1 },
    enroute: { label: 'On the way', tone: 'amber', order: 2 },
    onsite: { label: 'On site', tone: 'amber', order: 3 },
    parts: { label: 'Parts quoted', tone: 'orange', order: 4 },
    return: { label: 'Return visit booked', tone: 'blue', order: 5 },
    done: { label: 'Completed', tone: 'green', order: 6 },
    cancelled: { label: 'Cancelled', tone: 'grey', order: 7 },
  };

  function seed() {
    const partners = [
      { id: 'p1', name: 'Kingsman Estate Agents', short: 'Kingsman', colour: '#0E4C92', contact: 'Priya Shah', branch: 'Fulham' },
      { id: 'p2', name: 'Chestertons', short: 'Chestertons', colour: '#7A1F2B', contact: 'Tom Ellery', branch: 'Kensington' },
      { id: 'p3', name: 'Oppida Estates', short: 'Oppida', colour: '#1F6F5F', contact: 'Hana Weiss', branch: 'Islington' },
      { id: 'p4', name: 'Purespace Group', short: 'Purespace', colour: '#5B3FA0', contact: 'Marcus Lee', branch: 'Canary Wharf' },
      { id: 'p5', name: 'Relo Redac Strattons', short: 'Strattons', colour: '#B35C00', contact: 'Dee Okafor', branch: 'Hackney' },
    ];
    const engineers = [
      { id: 'e1', name: 'Ismail', initials: 'IS', van: 'LV19 FSU', area: 'West and South West', phone: '07453 570 782', rating: 4.9 },
      { id: 'e2', name: 'Ali', initials: 'AL', van: 'LV21 FSU', area: 'North and East', phone: '07931 217 860', rating: 4.9 },
      { id: 'e3', name: 'Dev', initials: 'DV', van: 'LV23 FSU', area: 'Central and Docklands', phone: '07984 670 782', rating: 4.8 },
    ];
    const props = [
      ['p1', 'Flat 3, 41 Parsons Green Lane', 'SW6 4HH', 'Sophie Marsh'],
      ['p1', '12 Moore Park Road', 'SW6 2JW', 'Daniel Okoro'],
      ['p1', 'Flat 7, Imperial Wharf', 'SW6 2SY', 'Leah Brennan'],
      ['p2', 'Flat 2, 18 Kensington Church St', 'W8 4EP', 'Camille Roux'],
      ['p2', '9 Abingdon Villas', 'W8 6BX', 'Harriet Cole'],
      ['p2', 'Flat 5, Holland Park Gardens', 'W14 8EA', 'Yusuf Demir'],
      ['p3', 'Flat 1, 66 Upper Street', 'N1 0NY', 'Megan Doyle'],
      ['p3', '23 Canonbury Square', 'N1 2AL', 'Arjun Patel'],
      ['p3', 'Flat 9, Highbury Corner', 'N5 1RA', 'Nia Thomas'],
      ['p4', 'Apt 1204, Pan Peninsula', 'E14 9HN', 'Ben Whitlock'],
      ['p4', 'Apt 806, Landmark West', 'E14 9SJ', 'Isla Ferguson'],
      ['p5', '7 Wilton Way', 'E8 1BG', 'Kofi Mensah'],
      ['p5', 'Flat 4, Mare Street Studios', 'E8 3RH', 'Rosa Alvarez'],
    ];
    const properties = props.map((p, i) => ({ id: 'pr' + (i + 1), partnerId: p[0], address: p[1], postcode: p[2], tenant: p[3], tenantPhone: '07' + String(400000000 + i * 7351) }));

    let n = 0;
    const ref = () => 'FS-' + String(24810 + (n++));
    const mk = (o) => Object.assign({
      id: 'j' + Math.random().toString(36).slice(2, 8), ref: ref(), appliance: 'Washing machine', service: 'next',
      price: PRICES.next, paid: true, parts: [], photos: 0, notes: '', timeline: [], engineerId: null,
    }, o);
    const tl = (job, dayOffset, h, m, text, who) => job.timeline.push({ at: at(dayOffset, h, m), text, who: who || 'System' });

    const jobs = [];
    // Earlier this month and last month: completed work that feeds the dashboard numbers.
    const history = [
      [-27, 'pr4', 'e1', 'Bosch', 'Not draining', 'Drain pump', 68], [-26, 'pr10', 'e3', 'Samsung', 'Error code', null, 0],
      [-25, 'pr7', 'e2', 'Hotpoint', 'Leaking', 'Door seal', 59], [-24, 'pr1', 'e1', 'Miele', 'Drum noise', 'Drum bearings kit', 96],
      [-22, 'pr12', 'e2', 'Indesit', 'Won\'t start', null, 0], [-21, 'pr5', 'e1', 'Siemens', 'Door won\'t open', 'Door lock', 42],
      [-20, 'pr9', 'e2', 'LG', 'Not spinning', 'Carbon brushes', 28], [-19, 'pr11', 'e3', 'Bosch', 'Not heating', 'Heating element', 54],
      [-18, 'pr2', 'e1', 'Zanussi', 'Not draining', null, 0], [-17, 'pr13', 'e2', 'Hoover', 'Leaking', null, 0],
      [-15, 'pr6', 'e1', 'AEG', 'Error code', 'Control module', 148], [-14, 'pr8', 'e2', 'Bosch', 'Not draining', 'Drain pump', 68],
      [-13, 'pr3', 'e1', 'Samsung', 'Drum noise', null, 0], [-12, 'pr10', 'e3', 'Miele', 'Not spinning', null, 0],
      [-11, 'pr1', 'e1', 'Hotpoint', 'Won\'t start', null, 0], [-10, 'pr7', 'e2', 'Indesit', 'Not draining', 'Drain pump', 68],
      [-9, 'pr12', 'e2', 'Bosch', 'Door won\'t open', 'Door lock', 42], [-8, 'pr4', 'e1', 'LG', 'Leaking', 'Inlet valve', 38],
      [-7, 'pr11', 'e3', 'Siemens', 'Not heating', 'Heating element', 54], [-6, 'pr5', 'e1', 'Bosch', 'Error code', null, 0],
      [-5, 'pr9', 'e2', 'Zanussi', 'Not spinning', null, 0], [-4, 'pr2', 'e1', 'Miele', 'Not draining', null, 0],
      [-3, 'pr13', 'e2', 'Hotpoint', 'Leaking', 'Door seal', 59], [-2, 'pr6', 'e1', 'Samsung', 'Drum noise', null, 0],
      [-1, 'pr10', 'e3', 'Bosch', 'Won\'t start', 'Carbon brushes', 28], [-1, 'pr8', 'e2', 'AEG', 'Not draining', null, 0],
    ];
    history.forEach(([d, pr, e, brand, fault, part, partPrice]) => {
      const prop = properties.find((p) => p.id === pr);
      const j = mk({ propertyId: pr, partnerId: prop.partnerId, brand, fault, status: 'done', engineerId: e, day: d, window: 'am',
        service: d % 3 === 0 ? 'same' : 'next', price: d % 3 === 0 ? PRICES.same : PRICES.next, photos: 2,
        notes: part ? `${part} replaced and tested on a full cycle.` : 'Fault cleared on site and tested on a full cycle.' });
      if (part) j.parts.push({ name: part, price: partPrice, approved: true, fitted: true });
      tl(j, d - 1, 16, 10, 'Booked through the partner portal', prop.partnerId);
      tl(j, d - 1, 16, 12, 'Payment taken, tenant texted the slot');
      tl(j, d, 8, 40, 'Engineer on the way', e);
      tl(j, d, 9, 15, 'Arrived on site', e);
      tl(j, d, 10, 20, 'Repair complete, 6-month guarantee started', e);
      jobs.push(j);
    });
    const tweak = (i, o) => Object.assign(jobs[i], o);
    tweak(3, { appliance: 'Washer dryer' }); tweak(7, { appliance: 'Tumble dryer', fault: 'Not heating' }); tweak(10, { appliance: 'Dishwasher', fault: 'Not draining' });
    tweak(14, { appliance: 'Fridge freezer', fault: 'Not cooling' }); tweak(19, { appliance: 'Oven or cooker', fault: 'Not heating' });
    [5, 12, 17].forEach((i) => tweak(i, { service: 'steam', price: PRICES.steam, fault: 'Steam clean and sanitise', notes: 'Steam cleaned at 105°C: drum, door seal, soap drawer, pump filter. Machine smells fresh, tested on a hot cycle.' }));

    // Today: a live day in progress.
    const t1 = mk({ propertyId: 'pr1', partnerId: 'p1', brand: 'Bosch', fault: 'Not draining', status: 'done', engineerId: 'e1', day: 0, window: 'am', service: 'same', price: PRICES.same, photos: 3,
      notes: 'Coin and hair grip blocking the pump filter. Cleared, pump tested, full drain cycle run.' });
    tl(t1, -1, 18, 5, 'Booked through the partner portal', 'p1'); tl(t1, -1, 18, 6, 'Payment taken, tenant texted the slot');
    tl(t1, 0, 7, 55, 'Engineer on the way', 'e1'); tl(t1, 0, 8, 25, 'Arrived on site', 'e1'); tl(t1, 0, 9, 10, 'Repair complete, 6-month guarantee started', 'e1');
    const t2 = mk({ propertyId: 'pr2', partnerId: 'p1', brand: 'Miele', fault: 'Drum noise', status: 'onsite', engineerId: 'e1', day: 0, window: 'am' });
    tl(t2, -1, 11, 30, 'Booked through the partner portal', 'p1'); tl(t2, -1, 11, 31, 'Payment taken, tenant texted the slot');
    tl(t2, 0, 9, 20, 'Engineer on the way', 'e1'); tl(t2, 0, 9, 48, 'Arrived on site', 'e1');
    const t3 = mk({ propertyId: 'pr4', partnerId: 'p2', brand: 'Siemens', fault: 'Door won\'t open', status: 'scheduled', engineerId: 'e1', day: 0, window: 'mid' });
    tl(t3, -1, 14, 2, 'Booked through the partner portal', 'p2'); tl(t3, -1, 14, 3, 'Payment taken, tenant texted the slot'); tl(t3, -1, 17, 0, 'Assigned to Ismail');
    const t4 = mk({ propertyId: 'pr5', partnerId: 'p2', brand: 'Hotpoint', fault: 'Leaking', status: 'scheduled', engineerId: 'e1', day: 0, window: 'pm' });
    tl(t4, -2, 9, 12, 'Booked through the partner portal', 'p2'); tl(t4, -2, 9, 13, 'Payment taken, tenant texted the slot'); tl(t4, -1, 17, 0, 'Assigned to Ismail');
    const t5 = mk({ propertyId: 'pr7', partnerId: 'p3', brand: 'Hotpoint', fault: 'Not heating', status: 'parts', engineerId: 'e2', day: 0, window: 'am', photos: 2,
      notes: 'Heating element open circuit. Needs a new element, 20 minutes to fit on the return visit.' });
    t5.parts.push({ name: 'Heating element', price: 54, approved: false, fitted: false });
    tl(t5, -1, 10, 0, 'Booked through the partner portal', 'p3'); tl(t5, -1, 10, 1, 'Payment taken, tenant texted the slot');
    tl(t5, 0, 8, 5, 'Engineer on the way', 'e2'); tl(t5, 0, 8, 35, 'Arrived on site', 'e2'); tl(t5, 0, 9, 5, 'Parts quoted: Heating element £54, waiting for approval', 'e2');
    const t6 = mk({ propertyId: 'pr9', partnerId: 'p3', brand: 'LG', fault: 'Not spinning', status: 'enroute', engineerId: 'e2', day: 0, window: 'mid' });
    tl(t6, -1, 15, 40, 'Booked through the partner portal', 'p3'); tl(t6, -1, 15, 41, 'Payment taken, tenant texted the slot'); tl(t6, 0, 9, 50, 'Engineer on the way', 'e2');
    const t7 = mk({ propertyId: 'pr12', partnerId: 'p5', brand: 'Indesit', fault: 'Won\'t start', status: 'scheduled', engineerId: 'e2', day: 0, window: 'pm' });
    tl(t7, -1, 8, 20, 'Booked through the partner portal', 'p5'); tl(t7, -1, 8, 21, 'Payment taken, tenant texted the slot'); tl(t7, -1, 17, 0, 'Assigned to Ali');
    const t8 = mk({ propertyId: 'pr10', partnerId: 'p4', brand: 'Samsung', fault: 'Error code', status: 'done', engineerId: 'e3', day: 0, window: 'am', photos: 2, notes: 'Error 4E, blocked inlet filter. Cleaned and tested.' });
    tl(t8, -1, 12, 0, 'Booked through the partner portal', 'p4'); tl(t8, -1, 12, 1, 'Payment taken, tenant texted the slot');
    tl(t8, 0, 8, 0, 'Engineer on the way', 'e3'); tl(t8, 0, 8, 30, 'Arrived on site', 'e3'); tl(t8, 0, 9, 0, 'Repair complete, 6-month guarantee started', 'e3');
    const t9 = mk({ propertyId: 'pr11', partnerId: 'p4', brand: 'Bosch', fault: 'Not draining', status: 'scheduled', engineerId: 'e3', day: 0, window: 'mid' });
    tl(t9, -1, 19, 30, 'Booked through the partner portal', 'p4'); tl(t9, -1, 19, 31, 'Payment taken, tenant texted the slot'); tl(t9, -1, 19, 40, 'Assigned to Dev');
    const s1 = mk({ propertyId: 'pr11', partnerId: 'p4', brand: 'Bosch', appliance: 'Washing machine', fault: 'Steam clean and sanitise', detail: 'Tenant reports a musty smell and black marks on the seal', status: 'scheduled', engineerId: 'e3', day: 0, window: 'pm', service: 'steam', price: PRICES.steam });
    tl(s1, -1, 13, 0, 'Booked through the partner portal', 'p4'); tl(s1, -1, 13, 1, 'Payment taken, tenant texted the slot'); tl(s1, -1, 17, 0, 'Assigned to Dev');
    const s2 = mk({ propertyId: 'pr3', partnerId: 'p1', brand: 'Samsung', appliance: 'Washer dryer', fault: 'Steam clean and sanitise', status: 'scheduled', engineerId: 'e1', day: 0, window: 'pm', service: 'steam', price: PRICES.steam });
    tl(s2, -1, 9, 40, 'Booked through the partner portal', 'p1'); tl(s2, -1, 9, 41, 'Payment taken, tenant texted the slot'); tl(s2, -1, 17, 0, 'Assigned to Ismail');
    const d1 = mk({ propertyId: 'pr5', partnerId: 'p2', brand: 'Bosch', appliance: 'Dishwasher', fault: 'Not draining', status: 'scheduled', engineerId: 'e2', day: 1, window: 'pm' });
    tl(d1, 0, 10, 5, 'Booked through the partner portal', 'p2'); tl(d1, 0, 10, 6, 'Payment taken, tenant texted the slot'); tl(d1, 0, 10, 20, 'Assigned to Ali');
    const t10 = mk({ propertyId: 'pr13', partnerId: 'p5', brand: 'Zanussi', fault: 'Leaking', status: 'booked', engineerId: null, day: 0, window: 'pm', service: 'same', price: PRICES.same });
    tl(t10, 0, 7, 48, 'Booked through the partner portal', 'p5'); tl(t10, 0, 7, 49, 'Payment taken, tenant texted the slot');
    // Tomorrow, already in the diary.
    const m1 = mk({ propertyId: 'pr3', partnerId: 'p1', brand: 'Samsung', fault: 'Error code', status: 'scheduled', engineerId: 'e1', day: 1, window: 'am' });
    tl(m1, 0, 8, 10, 'Booked through the partner portal', 'p1'); tl(m1, 0, 8, 11, 'Payment taken, tenant texted the slot'); tl(m1, 0, 8, 30, 'Assigned to Ismail');
    const m2 = mk({ propertyId: 'pr8', partnerId: 'p3', brand: 'Bosch', fault: 'Not spinning', status: 'booked', engineerId: null, day: 1, window: 'mid' });
    tl(m2, 0, 9, 2, 'Booked through the partner portal', 'p3'); tl(m2, 0, 9, 3, 'Payment taken, tenant texted the slot');
    const m3 = mk({ propertyId: 'pr6', partnerId: 'p2', brand: 'AEG', fault: 'Not draining', status: 'return', engineerId: 'e1', day: 1, window: 'pm', photos: 2,
      notes: 'Drain pump seized. Part approved by Chestertons, fitting on the return visit.' });
    m3.parts.push({ name: 'Drain pump', price: 68, approved: true, fitted: false });
    tl(m3, -2, 10, 0, 'Booked through the partner portal', 'p2'); tl(m3, -1, 9, 0, 'Arrived on site', 'e1'); tl(m3, -1, 9, 30, 'Parts quoted: Drain pump £68, waiting for approval', 'e1');
    tl(m3, -1, 10, 15, 'Parts approved by Tom Ellery, return visit booked', 'p2');
    jobs.push(t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, s1, s2, d1, m1, m2, m3);

    const reviews = [
      { who: 'Andrea Peers', text: 'Job well done! Arrived on time! Very polite and helpful!', when: '9 Nov' },
      { who: 'Neel Gupta', text: 'Great service provided by Ismail repairing our washing machine. Easy to arrange appointment. Reasonable price.', when: '8 Nov' },
      { who: 'Lindsey Porter', text: 'Excellent service. Honest and quick. Have used twice and would highly recommend.', when: '17 Oct' },
      { who: 'JJ Jordan', text: 'Called in the morning and they came out in the afternoon to fix a drain issue with my Hotpoint washer dryer, fantastic service.', when: '4 Oct' },
    ];

    return { version: 4, seededOn: iso(today()), partners, engineers, properties, jobs, reviews, events: [] };
  }

  let state = null;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.version === 4 && s.seededOn === iso(today())) { state = s; return state; } }
    } catch (e) { /* storage blocked, run in memory */ }
    state = seed(); save(); return state;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* in memory only */ } }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} state = seed(); save(); notify(); }

  const listeners = [];
  function notify() { listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } }); }
  function subscribe(fn) {
    listeners.push(fn);
    if (listeners.length === 1) {
      window.addEventListener('storage', (ev) => { if (ev.key === KEY) { try { state = JSON.parse(ev.newValue); } catch (e) { return; } notify(); } });
    }
  }
  function commit(text, who) {
    if (text) state.events.unshift({ at: Date.now(), text, who: who || 'System' });
    state.events = state.events.slice(0, 40);
    save(); notify();
  }

  // Lookups
  const get = () => state || load();
  const job = (id) => get().jobs.find((j) => j.id === id);
  const prop = (id) => get().properties.find((p) => p.id === id);
  const partner = (id) => get().partners.find((p) => p.id === id);
  const eng = (id) => get().engineers.find((e) => e.id === id);
  const win = (id) => WINDOWS.find((w) => w.id === id);
  const slotDate = (j) => { const d = today(); d.setDate(d.getDate() + j.day); return d; };
  const slotLabel = (j) => `${dayName(j.day)}, ${win(j.window).label}`;
  const dayName = (off) => off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : off === -1 ? 'Yesterday' : slotDate({ day: off }).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const total = (j) => j.price + j.parts.filter((p) => p.approved).reduce((s, p) => s + p.price, 0);
  const timeStr = (ts) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const money = (n) => '£' + n.toLocaleString('en-GB');

  // Actions
  function book(input, who) {
    const s = get();
    let property = input.propertyId ? prop(input.propertyId) : null;
    if (!property) {
      property = { id: 'pr' + Math.random().toString(36).slice(2, 7), partnerId: input.partnerId, address: input.address, postcode: input.postcode, tenant: input.tenant, tenantPhone: input.tenantPhone || '' };
      s.properties.push(property);
    } else if (input.tenant) { property.tenant = input.tenant; property.tenantPhone = input.tenantPhone || property.tenantPhone; }
    const refNo = 'FS-' + (24810 + s.jobs.length + 3);
    const j = {
      id: 'j' + Math.random().toString(36).slice(2, 8), ref: refNo, propertyId: property.id, partnerId: input.partnerId,
      appliance: input.appliance, brand: input.brand, fault: input.fault, detail: input.detail || '', access: input.access || '',
      service: input.service, day: input.day, window: input.window, price: PRICES[input.service], paid: true,
      status: 'booked', engineerId: null, parts: [], photos: 0, notes: '', timeline: [],
    };
    const now = Date.now();
    j.timeline.push({ at: now, text: 'Booked through the partner portal', who: who || input.partnerId });
    j.timeline.push({ at: now + 1000, text: `Payment of ${money(j.price)} taken on the partner account, tenant texted the slot` });
    // Same-day bookings get picked up by whoever has the slot free, so the diary shows it straight away.
    const free = s.engineers.find((e) => !s.jobs.some((o) => o.engineerId === e.id && o.day === j.day && o.window === j.window && o.status !== 'cancelled' && o.status !== 'done'));
    if (free && input.autoAssign !== false) { j.engineerId = free.id; j.status = 'scheduled'; j.timeline.push({ at: now + 2000, text: `Assigned to ${free.name}` }); }
    s.jobs.push(j);
    commit(`${partner(j.partnerId).short} booked ${j.ref} at ${property.postcode}`, j.partnerId);
    return j;
  }
  function assign(jobId, engineerId) {
    const j = job(jobId); const e = eng(engineerId);
    j.engineerId = e.id; j.status = j.status === 'booked' ? 'scheduled' : j.status;
    j.timeline.push({ at: Date.now(), text: `Assigned to ${e.name}`, who: 'Office' });
    commit(`${j.ref} assigned to ${e.name}`, 'Office');
  }
  function advance(jobId, next, extra) {
    const j = job(jobId); const e = eng(j.engineerId); const now = Date.now(); const p = prop(j.propertyId);
    const texts = {
      enroute: `Engineer on the way, ${p.tenant} texted a live arrival time`,
      onsite: 'Arrived on site',
      done: j.service === 'steam' ? 'Steam clean complete, report and photos sent' : 'Repair complete, 6-month guarantee started',
      parts: null, return: 'Parts approved, return visit booked', cancelled: 'Cancelled',
    };
    if (next === 'parts') {
      j.parts.push({ name: extra.part.name, price: extra.part.price, approved: false, fitted: false });
      j.notes = extra.notes || j.notes; j.photos = (j.photos || 0) + (extra.photos || 0);
      j.timeline.push({ at: now, text: `Parts quoted: ${extra.part.name} ${money(extra.part.price)}, waiting for approval`, who: e ? e.id : 'System' });
      j.status = 'parts';
      commit(`${e ? e.name : 'Engineer'} quoted ${extra.part.name} on ${j.ref}, approval needed`, e ? e.id : 'System');
      return;
    }
    if (next === 'done') { j.notes = (extra && extra.notes) || j.notes; j.photos = (j.photos || 0) + ((extra && extra.photos) || 0); j.parts.forEach((pt) => { if (pt.approved) pt.fitted = true; }); }
    j.status = next;
    j.timeline.push({ at: now, text: texts[next], who: e ? e.id : 'System' });
    commit(`${j.ref}: ${STATUS[next].label}${e ? ' (' + e.name + ')' : ''}`, e ? e.id : 'System');
  }
  function approveParts(jobId, approve, who) {
    const j = job(jobId); const now = Date.now(); const part = j.parts.find((p) => !p.approved && !p.declined);
    if (!part) return;
    if (approve) {
      part.approved = true;
      // The return visit lands on the next free slot.
      let day = Math.max(j.day, 0) + 1, w = 'am';
      j.day = day; j.window = w; j.status = 'return';
      j.timeline.push({ at: now, text: `Parts approved by ${who}, return visit booked for ${slotLabel(j)}`, who: j.partnerId });
      commit(`${partner(j.partnerId).short} approved ${part.name} on ${j.ref}`, j.partnerId);
    } else {
      part.declined = true; j.status = 'done';
      j.timeline.push({ at: now, text: `Parts declined by ${who}, job closed with a report`, who: j.partnerId });
      commit(`${partner(j.partnerId).short} declined parts on ${j.ref}`, j.partnerId);
    }
  }

  // Derived numbers for the dashboard and portal.
  function stats(partnerId) {
    const s = get(); const js = s.jobs.filter((j) => !partnerId || j.partnerId === partnerId);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const inMonth = js.filter((j) => slotDate(j) >= monthStart && j.day <= 0);
    const todayJobs = js.filter((j) => j.day === 0 && j.status !== 'cancelled');
    const done = js.filter((j) => j.status === 'done');
    const firstTime = done.length ? Math.round(100 * done.filter((j) => j.parts.length === 0 || j.parts.every((p) => p.fitted)).length / done.length) : 0;
    const open = js.filter((j) => !['done', 'cancelled'].includes(j.status));
    const spendMonth = inMonth.filter((j) => j.status !== 'cancelled').reduce((sum, j) => sum + total(j), 0);
    const approvals = js.filter((j) => j.status === 'parts');
    const unassigned = js.filter((j) => j.status === 'booked' && !j.engineerId);
    const sameDay = js.filter((j) => j.service === 'same').length;
    const steam = js.filter((j) => j.service === 'steam' && j.status !== 'cancelled').length;
    return { todayJobs, done, firstTime, open, spendMonth, approvals, unassigned, inMonth, sameDayShare: js.length ? Math.round(100 * sameDay / js.length) : 0, steam };
  }
  function weekSeries() {
    const s = get(); const out = [];
    for (let d = -6; d <= 0; d++) {
      const js = s.jobs.filter((j) => j.day === d && j.status !== 'cancelled');
      out.push({ day: slotDate({ day: d }).toLocaleDateString('en-GB', { weekday: 'short' }), jobs: js.length, revenue: js.reduce((a, j) => a + total(j), 0) });
    }
    return out;
  }

  global.FS = {
    KEY, WINDOWS, PRICES, SERVICE_LABEL, STEAM_STEPS, APPLIANCES, BRANDS, FAULTS, PARTS, STATUS,
    load, get, reset, subscribe, job, prop, partner, eng, win, slotLabel, dayName, total, timeStr, money, stats, weekSeries,
    book, assign, advance, approveParts,
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    initials: (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  };
})(window);
