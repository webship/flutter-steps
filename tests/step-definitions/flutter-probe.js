'use strict';

// The page side of the pack: put into every page before its own scripts (see flutter-helpers.js).
//
// An app of this kind draws its interface on a canvas; what a browser test can read is the
// accessibility tree the app builds for screen readers once that tree is turned on: elements with
// ARIA roles and names over the canvas, real <input> and <textarea> elements for its text fields,
// and the identifiers the app gives its widgets (`flt-semantics-identifier`). This file:
//
//   1. Wraps `requestAnimationFrame`, keeping the original for itself, so it knows whether the app
//      has a frame scheduled: the app asks for a frame only when something changes or moves. With
//      the tree's own changes and the time of the last input event, that tells when the app has
//      settled: no frame scheduled and no change for two frames, at least one frame after an input
//      (or 100 ms of nothing at all).
//   2. Records what the app announces to screen readers (its polite and assertive announcements),
//      so a short message is not missed by a step that looks after it is gone.
//   3. Reads the tree the way a person with a screen reader meets it: a control by its role and the
//      start of its name, a dialog by its title, a field with its value, state and message, the
//      controls that have no name, the app's route.
//
// The engine's own tags are used only to find the tree, the announcements, the button that turns
// the tree on and the scrolling areas; everything a step asserts is read from ARIA roles, names
// and states.
//
// Everything is reached through `window.__webshipApp.lib`; elements found by one call are kept
// under a number (`ref`) for the next ones, without touching the page's DOM.

function appProbe() {
  if (window.__webshipApp) return;

  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  const S = {
    scheduled: new Set(),
    frames: 0,
    lastFrameAt: 0,
    mutations: 0,
    lastMutationAt: 0,
    lastInputAt: 0,
    announcements: [],
  };

  // The app's frames: every request it makes, until its callback runs or it is cancelled.
  window.requestAnimationFrame = function requestAnimationFrame(callback) {
    let id = 0;
    id = raf((time) => {
      S.scheduled.delete(id);
      S.frames += 1;
      S.lastFrameAt = performance.now();
      callback(time);
    });
    S.scheduled.add(id);
    return id;
  };
  window.cancelAnimationFrame = function cancelAnimationFrame(id) {
    S.scheduled.delete(id);
    return caf(id);
  };

  // The input events a person or a step sends: the app answers them with frames.
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup', 'input', 'wheel']) {
    window.addEventListener(type, () => { S.lastInputAt = performance.now(); }, true);
  }

  const norm = (text) => String(text === null || text === undefined ? '' : text)
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // The tree and the announcements are watched from the moment they are there (a call of the
  // library looks; the page runs no timer of its own for it).
  const watched = new WeakSet();
  function watch() {
    for (const host of document.querySelectorAll('flt-semantics-host')) {
      if (watched.has(host)) continue;
      watched.add(host);
      new MutationObserver((list) => {
        S.mutations += list.length;
        S.lastMutationAt = performance.now();
      }).observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
    }
    for (const host of document.querySelectorAll('flt-announcement-host')) {
      if (watched.has(host)) continue;
      watched.add(host);
      new MutationObserver((list) => {
        for (const m of list) {
          const target = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          const text = norm(target && target.textContent);
          const kind = target && target.closest('flt-announcement-assertive') ? 'assertive' : 'polite';
          if (text && !S.announcements.some((a) => a.text === text && performance.now() - a.at < 50)) {
            S.announcements.push({ text, kind, at: performance.now() });
          }
        }
      }).observe(host, { subtree: true, childList: true, characterData: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);

  const refs = new Map();
  let nextRef = 1;
  function ref(el) {
    if (!el) return 0;
    for (const [n, e] of refs) if (e === el) return n;
    const n = nextRef;
    nextRef += 1;
    refs.set(n, el);
    return n;
  }
  const deref = (n) => {
    const el = refs.get(n);
    return el && el.isConnected ? el : null;
  };

  const hosts = () => [...document.querySelectorAll('flt-semantics-host')];
  const view = () => document.querySelector('flutter-view, flt-glass-pane');
  const placeholder = () => document.querySelector('flt-semantics-placeholder');

  // ------------------------------------------------------------------ roles and names

  const HEADINGS = /^H[1-6]$/;
  function roleOf(el) {
    const role = el.getAttribute('role');
    if (role) return role;
    if (HEADINGS.test(el.tagName)) return 'heading';
    if (el.tagName === 'A') return 'link';
    if (el.tagName === 'INPUT') return el.type === 'range' ? 'slider' : (el.type === 'checkbox' ? 'checkbox' : 'textbox');
    if (el.tagName === 'TEXTAREA') return 'textbox';
    if (el.tagName === 'IMG') return 'img';
    return '';
  }
  // A node's name: its aria-label (the lines of a label and its hint joined), else its own text.
  function nameOf(el) {
    const label = el.getAttribute('aria-label');
    if (label !== null && norm(label)) return norm(label);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return norm(el.placeholder || '');
    return norm(el.textContent);
  }
  const KINDS = {
    button: ['button'],
    link: ['link'],
    heading: ['heading'],
    tab: ['tab'],
    checkbox: ['checkbox'],
    'radio button': ['radio'],
    switch: ['switch'],
    'text field': ['textbox'],
    image: ['img'],
    'menu item': ['menuitem', 'menuitemcheckbox', 'menuitemradio'],
    slider: ['slider'],
  };
  const CONTROL_ROLES = ['button', 'link', 'tab', 'checkbox', 'radio', 'switch', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'slider', 'textbox'];
  const CONTAINER_ROLES = ['group', 'region', 'dialog', 'alertdialog', 'listitem', 'list', 'tabpanel', 'row', 'cell'];

  // Every element of the tree, in document order, with its role.
  function all() {
    watch();
    const out = [];
    for (const host of hosts()) {
      for (const el of host.querySelectorAll('*')) {
        if (el.closest('[aria-hidden="true"]')) continue;
        const role = roleOf(el);
        if (role || el.tagName === 'FLT-SEMANTICS') out.push({ el, role });
      }
    }
    return out;
  }
  function boxOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }
  const hasBox = (el) => { const b = boxOf(el); return b.w > 0 && b.h > 0; };
  // A node of the tree that holds no other node: its text may sit in a <span> of its own.
  const isLeaf = (el) => !el.querySelector('flt-semantics, input, textarea');
  const textLeaves = (root) => [...root.querySelectorAll('flt-semantics')].filter((e) => isLeaf(e) && !roleOf(e) && norm(e.textContent));
  function inViewport(el) {
    const b = boxOf(el);
    if (b.w <= 0 || b.h <= 0) return false;
    if (b.x < -1 || b.y < -1 || b.x + b.w > innerWidth + 1 || b.y + b.h > innerHeight + 1) return false;
    // Inside every scrolling area it sits in, too.
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (!/(auto|scroll)/.test(s.overflowY + s.overflowX)) continue;
      const r = p.getBoundingClientRect();
      if (b.y < r.y - 1 || b.y + b.h > r.y + r.height + 1 || b.x < r.x - 1 || b.x + b.w > r.x + r.width + 1) return false;
    }
    return true;
  }

  // Shown on the screen, for "until I see": the whole box inside the viewport and the areas it
  // scrolls in; a section taller (or wider) than what shows of them, from its top (or start) edge.
  function seen(el) {
    if (inViewport(el)) return true;
    const b = boxOf(el);
    if (b.w <= 0 || b.h <= 0) return false;
    let top = 0, bottom = innerHeight, left = 0, right = innerWidth;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const st = getComputedStyle(p);
      if (!/(auto|scroll)/.test(st.overflowY + st.overflowX) && !p.querySelector(':scope > flt-semantics-scroll-overflow')) continue;
      const r = p.getBoundingClientRect();
      top = Math.max(top, r.y); bottom = Math.min(bottom, r.y + r.height); left = Math.max(left, r.x); right = Math.min(right, r.x + r.width);
    }
    const tall = b.h > bottom - top;
    const wide = b.w > right - left;
    const topIn = b.y >= top - 1 && b.y < bottom - 20;
    const leftIn = b.x >= left - 1 && b.x < right - 20;
    return (tall && topIn && (wide ? leftIn : (b.x >= left - 1 && b.x + b.w <= right + 1))) || (wide && leftIn && !tall && b.y >= top - 1 && b.y + b.h <= bottom + 1);
  }

  // Exact, then without regard to case, then by its start (three characters or more). Never a
  // part in the middle: "Add" is not "Address".
  function pick(items, wanted, namesOf) {
    const want = norm(wanted);
    const lower = want.toLowerCase();
    const named = items.map((it) => ({ it, names: namesOf(it).map(norm).filter(Boolean) }));
    const by = (test) => named.filter((n) => n.names.some(test)).map((n) => n.it);
    let matches = by((n) => n === want);
    if (!matches.length) matches = by((n) => n.toLowerCase() === lower);
    if (!matches.length && want.length >= 3) matches = by((n) => n.toLowerCase().startsWith(lower));
    return matches;
  }
  const visibleFirst = (list) => [...list.filter((x) => inViewport(x.el)), ...list.filter((x) => !inViewport(x.el))];

  // Controls of the kinds asked (all the controls when no kind is given), named so.
  function findControls(kind, name, scopeRef) {
    const roles = kind ? KINDS[kind] || [] : CONTROL_ROLES.filter((r) => r !== 'textbox' && r !== 'slider');
    const scope = scopeRef ? deref(scopeRef) : null;
    const items = all().filter((x) => roles.includes(x.role) && (!scope || scope.contains(x.el)) && hasBox(x.el));
    const matches = name === null || name === undefined ? items : pick(items, name, (x) => [nameOf(x.el)]);
    const ordered = visibleFirst(matches);
    return {
      refs: ordered.map((x) => ref(x.el)),
      names: [...new Set(items.map((x) => nameOf(x.el)).filter(Boolean))],
    };
  }
  function find(kind, name, scopeRef) {
    const { refs: found, names } = findControls(kind, name, scopeRef);
    return { ref: found[0] || 0, count: found.length, names };
  }
  function describe(r) {
    const el = deref(r);
    if (!el) return { exists: false };
    return {
      exists: true,
      role: roleOf(el),
      name: nameOf(el),
      inViewport: inViewport(el),
      box: boxOf(el),
      disabled: el.getAttribute('aria-disabled') === 'true' || el.disabled === true,
      checked: el.getAttribute('aria-checked') === 'true' || el.checked === true,
      selected: el.getAttribute('aria-selected') === 'true',
      invalid: el.getAttribute('aria-invalid') === 'true',
      value: el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.value : (el.getAttribute('aria-valuenow') || ''),
      focused: document.activeElement === el,
    };
  }

  // A named row, group, region, list item or dialog: the containers a person reads a control by
  // when the control has no name of its own.
  function findContainer(name) {
    const items = all().filter((x) => CONTAINER_ROLES.includes(x.role) && hasBox(x.el));
    const matches = pick(items, name, (x) => [nameOf(x.el), ...titlesOf(x.el)]);
    // The innermost one that matches: a row inside a list that a person names by the row.
    const innermost = matches.filter((m) => !matches.some((o) => o !== m && m.el.contains(o.el)));
    return {
      ref: innermost.length ? ref(visibleFirst(innermost)[0].el) : 0,
      count: innermost.length,
      names: [...new Set(items.map((x) => nameOf(x.el)).filter(Boolean))].slice(0, 40),
    };
  }

  // ------------------------------------------------------------------ dialogs

  // The names a dialog goes by: its own label, the label of the route region in it, its first
  // heading, and its first line of text (its title, when it has no heading).
  function titlesOf(el) {
    const out = [];
    const own = el.getAttribute('aria-label');
    if (own) out.push(own);
    const region = el.querySelector('[role=region][aria-label]');
    if (region) out.push(region.getAttribute('aria-label'));
    const heading = [...el.querySelectorAll('*')].find((e) => roleOf(e) === 'heading');
    if (heading) out.push(nameOf(heading));
    const leaf = textLeaves(el)[0];
    if (leaf) out.push(norm(leaf.textContent));
    return out.map(norm).filter(Boolean);
  }
  function dialogs() {
    return all().filter((x) => x.role === 'dialog' || x.role === 'alertdialog').filter((x) => hasBox(x.el));
  }
  function findDialog(name) {
    const list = dialogs();
    const matches = name === null || name === undefined ? list : pick(list, name, (x) => titlesOf(x.el));
    return { ref: matches.length ? ref(matches[matches.length - 1].el) : 0, titles: list.map((x) => titlesOf(x.el)[0] || '(no title)') };
  }
  function dialogText(r) {
    const el = deref(r);
    return el ? norm([...el.querySelectorAll('*')].filter((e) => !e.firstElementChild).map((e) => e.getAttribute('aria-label') || e.textContent).join(' ')) : '';
  }

  // ------------------------------------------------------------------ text and fields

  // Every text the tree holds, a leaf at a time (labels of the controls too): what a screen
  // reader can read out.
  function texts(scopeRef) {
    const scope = scopeRef ? deref(scopeRef) : null;
    const out = [];
    for (const host of hosts()) {
      for (const el of host.querySelectorAll('*')) {
        if (scope && !scope.contains(el)) continue;
        if (el.closest('[aria-hidden="true"]')) continue;
        const label = el.getAttribute('aria-label');
        if (label) out.push(norm(label));
        if (!el.firstElementChild && norm(el.textContent)) out.push(norm(el.textContent));
        if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value) out.push(norm(el.value));
      }
    }
    return [...new Set(out)];
  }
  // The whole of the tree's text as one line (two nodes that read as one sentence).
  function fullText() {
    return norm(hosts().map((h) => [...h.querySelectorAll('*')].filter((e) => !e.firstElementChild).map((e) => e.getAttribute('aria-label') || e.textContent).join(' ')).join(' '));
  }
  function showsText(text) {
    const want = norm(text).toLowerCase();
    if (!want) return false;
    if (texts().some((t) => t.toLowerCase().includes(want))) return true;
    return fullText().toLowerCase().includes(want);
  }

  function findField(name) {
    const items = all().filter((x) => x.role === 'textbox' && hasBox(x.el));
    const matches = pick(items, name, (x) => [nameOf(x.el), ...norm(x.el.getAttribute('aria-label') || '').split(/\n/)]);
    // A label and its hint are one name ("Enter a noun i.e. a person"): its first line counts too.
    const byFirstLine = matches.length ? matches : pick(items, name, (x) => [norm((x.el.getAttribute('aria-label') || '').split('\n')[0])]);
    return { ref: byFirstLine.length ? ref(visibleFirst(byFirstLine)[0].el) : 0, names: [...new Set(items.map((x) => norm((x.el.getAttribute('aria-label') || '').split('\n')[0])))] };
  }
  // The messages of a field: the text nodes that follow it in its group before the next control,
  // and what its own name gained (a check box's message joins its name).
  function messagesOf(r) {
    const el = deref(r);
    if (!el) return [];
    const node = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? (el.closest('flt-semantics') || el) : el;
    const out = [];
    for (const leaf of textLeaves(node)) if (leaf !== el) out.push(norm(leaf.textContent));
    const group = node.parentElement ? node.parentElement.closest('flt-semantics, form, flt-semantics-host') || node.parentElement : null;
    if (group) {
      let seen = false;
      for (const e of group.querySelectorAll('flt-semantics, input, textarea')) {
        if (e === node || node.contains(e)) { seen = true; continue; }
        if (!seen) continue;
        if (CONTROL_ROLES.includes(roleOf(e)) || e.querySelector('input, textarea')) break;
        if (isLeaf(e) && norm(e.textContent)) out.push(norm(e.textContent));
      }
    }
    const described = el.getAttribute('aria-describedby');
    if (described) for (const id of described.split(/\s+/)) { const d = document.getElementById(id); if (d) out.push(norm(d.textContent)); }
    out.push(nameOf(el));
    return out.filter(Boolean);
  }

  // ------------------------------------------------------------------ accessibility findings

  // Every control with no name, with the place a person would read it by: the nearest container
  // that has a name (a row, a group, a region, a dialog).
  function unnamed(kinds) {
    const roles = kinds === 'buttons' ? ['button'] : CONTROL_ROLES;
    const out = [];
    for (const x of all()) {
      if (!roles.includes(x.role) || !hasBox(x.el)) continue;
      if (nameOf(x.el)) continue;
      let place = '';
      for (let p = x.el.parentElement; p && p.tagName !== 'FLT-SEMANTICS-HOST'; p = p.parentElement) {
        const role = roleOf(p);
        const name = CONTAINER_ROLES.includes(role) ? (nameOf(p) || (titlesOf(p)[0] || '')) : '';
        if (name) { place = `in the "${name.slice(0, 60)}" ${role === 'alertdialog' ? 'dialog' : role}`; break; }
      }
      const b = boxOf(x.el);
      out.push(`${x.role} ${place || `at ${Math.round(b.x)},${Math.round(b.y)}`}`);
    }
    return out;
  }

  // ------------------------------------------------------------------ the app

  function state() {
    watch();
    const now = performance.now();
    const quiet = now - Math.max(S.lastFrameAt, S.lastMutationAt);
    const frameAfterInput = S.lastFrameAt > S.lastInputAt;
    const graceOver = now - S.lastInputAt >= 100;
    return {
      scheduled: S.scheduled.size,
      frames: S.frames,
      quietMs: Math.round(quiet),
      settled: S.scheduled.size === 0 && quiet >= 40 && (frameAfterInput || graceOver),
      view: !!view(),
      placeholder: !!placeholder(),
      nodes: hosts().reduce((n, h) => n + h.querySelectorAll('flt-semantics').length, 0),
    };
  }
  // Turn the tree on as assistive technology does: a click on the "Enable accessibility" button.
  function enable() {
    const p = placeholder();
    if (!p) return false;
    p.click();
    return true;
  }
  // The app's route: the hash of a hash address (#/validation), else the path below the base.
  function route() {
    if (/^#\//.test(location.hash)) return location.hash.slice(1).split('?')[0];
    const base = new URL(document.baseURI).pathname.replace(/\/$/, '');
    const path = location.pathname;
    const rest = base && path.startsWith(base) ? path.slice(base.length) : path;
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  const runsAs = () => (typeof window._flutter_skwasmInstance !== 'undefined' ? 'WebAssembly' : 'JavaScript');
  // What the app announced since an announcement count (`from`: the count before the step's action),
  // and what its live regions hold now.
  function announced(text, from) {
    watch();
    const want = norm(text).toLowerCase();
    const live = [];
    for (const host of hosts()) for (const el of host.querySelectorAll('[aria-live], [role=status], [role=alert]')) live.push(norm(el.textContent));
    const recent = S.announcements.slice(Math.max(0, Number(from) || 0)).map((a) => a.text);
    const all2 = [...recent, ...live].filter(Boolean);
    return { hit: all2.some((t) => t.toLowerCase().includes(want)), heard: [...new Set(all2)].slice(-12) };
  }
  // The scrolling area under a point, or the largest one shown.
  function scrollable(x, y) {
    const list = [];
    // A scrolling area of the tree: the engine gives it an element of its own that makes it taller
    // or wider than its box (`flt-semantics-scroll-overflow`), and sets its overflow to scroll while
    // the browser may scroll it, to hidden for half a second after a pointer was used (so a wheel
    // is not taken twice): either tells it.
    for (const host of hosts()) for (const el of host.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      const marked = !!el.querySelector(':scope > flt-semantics-scroll-overflow');
      if ((marked || /(auto|scroll)/.test(s.overflowY + s.overflowX)) && hasBox(el)) list.push(el);
    }
    const under = list.filter((el) => { const b = boxOf(el); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; });
    const pickFrom = under.length ? under : list;
    pickFrom.sort((a, b) => (boxOf(b).w * boxOf(b).h) - (boxOf(a).w * boxOf(a).h));
    const el = under.length ? under[under.length - 1] : pickFrom[0];
    if (!el) return null;
    const b = boxOf(el);
    const filler = el.querySelector(':scope > flt-semantics-scroll-overflow');
    const fb = filler ? filler.getBoundingClientRect() : null;
    const sideways = fb ? fb.width > b.w + 1 && fb.height <= b.h + 1 : /(auto|scroll)/.test(getComputedStyle(el).overflowX) && !/(auto|scroll)/.test(getComputedStyle(el).overflowY);
    return { ref: ref(el), x: b.x, y: b.y, w: b.w, h: b.h, top: el.scrollTop, left: el.scrollLeft, vertical: !sideways };
  }
  // The first node whose text or name starts like the wanted text, shown in the viewport or not.
  function locateText(text, kind) {
    const want = norm(text);
    const roles = kind ? KINDS[kind] || [] : null;
    const items = all().filter((x) => hasBox(x.el) && x.el.tagName !== 'FLT-SEMANTICS-HOST' && (!roles || roles.includes(x.role)));
    const leaves = items.filter((x) => x.role || isLeaf(x.el));
    const matches = pick(leaves, want, (x) => [nameOf(x.el)]);
    const inView = matches.filter((x) => seen(x.el));
    const any = inView[0] || matches[0];
    return { ref: any ? ref(any.el) : 0, visible: inView.length > 0 };
  }
  // Where the app's content stands: the first texts shown and their heights on the screen. A
  // wheel that moved a list changes it; the scrolling element's own offset does not say so (the
  // app keeps it where it wants).
  function signature(scopeRef) {
    const scope = scopeRef ? deref(scopeRef) : null;
    const shown = all().filter((x) => (!scope || scope.contains(x.el)) && (x.role || isLeaf(x.el)) && nameOf(x.el) && inViewport(x.el)).slice(0, 8);
    return shown.map((x) => `${nameOf(x.el).slice(0, 30)}@${Math.round(boxOf(x.el).y)},${Math.round(boxOf(x.el).x)}`).join('|');
  }
  // Every scrolling area shown, the largest first.
  function scrollables() {
    const out = [];
    for (const host of hosts()) for (const el of host.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      const marked = !!el.querySelector(':scope > flt-semantics-scroll-overflow');
      if (!(marked || /(auto|scroll)/.test(s.overflowY + s.overflowX)) || !hasBox(el)) continue;
      const b = boxOf(el);
      const visible = Math.max(0, Math.min(b.x + b.w, innerWidth) - Math.max(b.x, 0)) * Math.max(0, Math.min(b.y + b.h, innerHeight) - Math.max(b.y, 0));
      if (visible <= 0) continue;
      const area = scrollable(Math.min(Math.max(b.x + b.w / 2, 1), innerWidth - 1), Math.min(Math.max(b.y + b.h / 2, 1), innerHeight - 1));
      if (area && !out.some((o) => o.ref === area.ref)) out.push({ ...area, visible });
    }
    return out.sort((a, b) => b.visible - a.visible);
  }
  function identified(id) {
    watch();
    const el = hosts().map((h) => h.querySelector(`[flt-semantics-identifier="${CSS.escape(id)}"]`)).find(Boolean);
    const ids = [];
    for (const h of hosts()) for (const e of h.querySelectorAll('[flt-semantics-identifier]')) ids.push(e.getAttribute('flt-semantics-identifier'));
    return { ref: el ? ref(el) : 0, ids: [...new Set(ids)] };
  }

  const lib = {
    norm, ref, deref, state, enable, route, runsAs, announced, announceCount: () => { watch(); return S.announcements.length; },
    find, findControls, findContainer, describe, inViewport: (r) => !!deref(r) && inViewport(deref(r)),
    findDialog, dialogs: () => dialogs().map((x) => titlesOf(x.el)[0] || '(no title)'), dialogText,
    texts, showsText, findField, messagesOf, unnamed, scrollable, scrollables, locateText, identified, signature,
    centre: (r) => { const el = deref(r); if (!el) return null; const b = boxOf(el); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; },
    focusIn: (r) => { const el = deref(r); if (!el) return false; const target = el.querySelector('[tabindex], input, textarea') || el; if (!el.contains(document.activeElement)) { if (!target.hasAttribute('tabindex') && target === el) el.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); } return el.contains(document.activeElement); },
  };
  window.__webshipApp = { lib };
}

module.exports = { appProbe };
