/* Trade Hunter icon set: 24px line icons, 1.6 stroke, round caps. TH_ICON('bolt', 20) returns an SVG string. */
(function (global) {
  const P = {
    bolt: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z"/>',
    drop: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z"/>',
    flame: '<path d="M12 22c4 0 7-2.8 7-6.8 0-3.6-2.6-6-4-8.2-.6 2-1.6 3-3 3.5C12.6 7 11.5 4.3 9 2c0 4-4 6.6-4 12 0 4.4 3 8 7 8Z"/>',
    brick: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 9.7h18M3 14.3h18M9 5v4.7M15 9.7v4.6M9 14.3V19"/>',
    saw: '<path d="M4 18 15.5 6.5l3 3L7 21H4v-3Z"/><path d="M15.5 6.5 18 4l2 2-2.5 2.5M7 15l1.2 1.2M9.4 12.6l1.2 1.2M11.8 10.2l1.2 1.2"/>',
    roof: '<path d="M2 12 12 4l10 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
    roller: '<rect x="3" y="3" width="15" height="6" rx="1.5"/><path d="M18 6h2.5v5.5H11V15"/><rect x="9.5" y="15" width="3" height="6" rx="1"/>',
    trowel: '<path d="M3 14 14 3l4 4L7 18H3v-4Z"/><path d="m16 9 5 5-2 2-5-5"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    kitchen: '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M3 10h18M8 6.5h.01M12 6.5h.01M7 14v4M17 14v4"/>',
    bath: '<path d="M3 12h18v2a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-2Z"/><path d="M6 12V5a2 2 0 0 1 3.7-1M7 20l-1 2M17 20l1 2"/>',
    leaf: '<path d="M5 19C5 10 10 4 20 4c0 10-6 15-15 15Z"/><path d="M5 19 13 11"/>',
    key: '<circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.8-8.8M16.5 6.5l2.5 2.5M14 9l2 2"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0 5.2 5.2L21 13l-8 8-3-3 6.6-6.6"/><path d="M14.7 6.3 9 12 3 18l3 3"/><path d="M14.7 6.3A4 4 0 0 1 19.5 3l-3 3 1.5 1.5 3-3a4 4 0 0 1-3.3 4.8"/>',
    floor: '<path d="M3 21h18M3 21 8 3h8l5 18M7 13h10M5.5 17.5h13M9.2 8.5h5.6"/>',
    window: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/>',
    pipe: '<path d="M3 7h9a4 4 0 0 1 4 4v10"/><path d="M3 11h9v10M3 5v8M14 21h4"/>',
    hammer: '<path d="M14 6 6 14l4 4 8-8"/><path d="m13 3 8 8-2 2-8-8 2-2Z"/><path d="M6 14 3 17l4 4 3-3"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-4.6A8 8 0 1 1 21 12Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 9.5V20h14V9.5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Z"/><path d="M10 21h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    shield: '<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z"/><path d="m8.8 12 2.2 2.2 4.4-4.4"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8L12 3Z"/>',
    pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3v13H4V7Z"/><circle cx="12" cy="13" r="3.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pound: '<path d="M17 20H7c2-1.5 2.5-3.5 2.5-6V8.5a4 4 0 0 1 7.3-2.3M6.5 13h8"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    next: '<path d="m9 5 7 7-7 7"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z"/>',
    filter: '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    doc: '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    van: '<path d="M2 7h12v10H2zM14 10h4l3 3.5V17h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    play: '<path d="M7 5v14l12-7L7 5Z"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
    locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    fence: '<path d="M5 21V6l2-2 2 2v15M15 21V6l2-2 2 2v15M3 10h18M3 16h18"/>',
    snow: '<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  };
  global.TH_ICON = function (name, size, cls) {
    const s = size || 20;
    return '<svg class="ico ' + (cls || '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.wrench) + '</svg>';
  };
  /* Official Trade Hunter artwork (traced from the brand's own logo), served from /assets. */
  const ASSETS = (function () { try { return new URL('../assets/', document.currentScript.src).href; } catch (e) { return '../assets/'; } })();
  global.TH_ASSETS = ASSETS;
  global.TH_MARK = function (size) { const s = size || 32; return '<img class="th-mark" src="' + ASSETS + 'th-mark.svg" width="' + s + '" height="' + s + '" alt="Trade Hunter">'; };
  global.TH_LOGO = function (h) { const H = h || 32; return '<img class="th-logo" src="' + ASSETS + 'th-logo.svg" height="' + H + '" style="height:' + H + 'px;width:auto" alt="Trade Hunter">'; };
  global.TH_LOCKUP = function (w) { const W = w || 240; return '<img class="th-lockup" src="' + ASSETS + 'th-lockup.svg" width="' + W + '" style="width:' + W + 'px;height:auto" alt="Trade Hunter, build more together">'; };
})(window);
