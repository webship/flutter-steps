'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It puts the page side of the
// pack (flutter-probe.js) into every page the World opens, and holds the plumbing the steps use and
// that a project can require for its own steps: the wait budgets, the poll on the page, turning the
// app's accessibility tree on, finding a control by the name a person reads, tapping it with a real
// pointer, waiting until the app has settled, and the failure messages.
//
// The waits are the point of the pack. The app sends the page no event when its widgets change: it
// asks the browser for a frame whenever something changes or moves, and updates its tree at the end
// of that frame. So after an input the steps wait for the app's next frame, then for two quiet frames
// (no frame scheduled, no change in the tree); and every assertion waits for what it expects up to
// its budget, so an endless animation (a spinner) cannot hang a step and an early quiet cannot fail
// one. No step sleeps for a fixed time.
//
// Everything builds on webship-js's own helpers (`onNewPage`, `friendly`, `failure`) so the steps
// fail the way the core webship-js steps do.

const webship = require('webship-js/tests/step-definitions/webship');
const { appProbe } = require('./flutter-probe');

const { friendly, failure, onNewPage } = webship;

/** The page side as a script: it installs `window.__webshipApp`. */
const PROBE = `(${appProbe.toString()})();`;

// Every page the World opens gets the probe before its own scripts run, so the app's frames are
// counted from its first one.
if (typeof onNewPage === 'function') {
  onNewPage(async (world, page) => {
    try { await page.addInitScript(PROBE); } catch (e) { /* a closed page needs nothing */ }
  });
}

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 10 seconds. Kept below
 * webship-js's 45 second step timeout. COMPONENT_WAIT_MS sets it outright (the run of the assertions
 * that must fail uses a short one: each of them waits its whole budget).
 */
function budget(world) {
  const fixed = Number(process.env.COMPONENT_WAIT_MS);
  if (Number.isFinite(fixed) && fixed > 0) return Math.min(fixed, 40000);
  const page = world && world.minWaitTime && world.minWaitTime.page;
  return Math.min(Math.max(page || 0, 10000), 40000);
}

/** How long a step waits for the app to settle after its action before it goes on (5 seconds at
 * most): what comes next waits for what it expects anyway. */
function settleBudget(world) {
  return Math.min(budget(world), 5000);
}

/** White space collapsed, typographic quotes made plain: the way the page side compares texts. */
function norm(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A list for a failure message: `"a", "b"` or `(none)`. */
function listed(values, max) {
  const items = [...new Set((values || []).map(norm).filter(Boolean))];
  const limit = max || 12;
  if (!items.length) return '(none)';
  const shown = items.slice(0, limit).map((v) => `"${v}"`).join(', ');
  return items.length > limit ? `${shown} and ${items.length - limit} more` : shown;
}

/** Shorten a text for a message. */
function excerpt(text, max) {
  const clean = norm(text);
  const limit = max || 160;
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Put the probe into the current page when it is not there yet (a page opened before this pack was
 * loaded). It counts the app's frames only from then on. */
async function ensureProbe(world) {
  let there = false;
  try {
    there = await world.page.evaluate(() => !!(window.__webshipApp && window.__webshipApp.lib));
  } catch (e) {
    there = false;
  }
  if (!there) {
    try { await world.page.evaluate(PROBE); } catch (e) { /* the page is navigating: the next call retries */ }
  }
}

/** Run a function of the page side's library: `call(world, 'find', 'button', 'Increment')`. */
async function call(world, name, ...args) {
  await ensureProbe(world);
  return world.page.evaluate(([fn, list]) => window.__webshipApp.lib[fn](...list), [name, args]);
}

/**
 * Look at the page every 50 ms, from Node (a timer in the page would be counted by webship-js as
 * pending work), until `probe` returns a value with `done: true` or the time is up. The probe runs in
 * the page with `lib` (the page side's library) and `arg`. Returns the last value it gave.
 */
async function poll(world, probe, arg, timeout) {
  const deadline = Date.now() + timeout;
  const source = probe.toString();
  let last = { done: false };
  for (;;) {
    let value;
    try {
      value = await world.page.evaluate(([src, a]) => {
        const C = window.__webshipApp;
        if (!C || !C.lib) return { done: false, missing: true };
        // eslint-disable-next-line no-new-func
        return (new Function(`return (${src})`))()(C.lib, a);
      }, [source, arg]);
    } catch (e) {
      value = { done: false, error: e.message };
    }
    if (value && value.missing) await ensureProbe(world);
    else if (value) last = value;
    if (value && value.done) return value;
    if (Date.now() + 50 >= deadline) return last;
    await sleep(50);
  }
}

/** Wait until the app has settled: no frame scheduled and nothing changed for two frames, at least
 * one frame after the last input (or 100 ms of nothing). Returns the last state; never fails. */
async function settle(world, timeout) {
  return poll(world, (lib) => {
    const s = lib.state();
    return { done: s.settled, state: s };
  }, null, timeout || settleBudget(world));
}

/** The app's tree, turned on if it is not: what every step of the pack needs first. */
async function ensureTree(world) {
  const result = await poll(world, (lib) => {
    const s = lib.state();
    if (s.placeholder && !s.nodes) lib.enable();
    return { done: s.view && !s.placeholder && s.nodes > 0, state: s };
  }, null, budget(world));
  if (!result.done) {
    const s = result.state || {};
    throw failure(world.page, !s.view
      ? 'Expected an app that draws on a canvas, with an accessibility tree, but the page has no app view.'
      : 'Expected the app\'s accessibility tree to be on, but it holds no element.', {
      found: s.view ? `the button that turns it on is ${s.placeholder ? 'still there' : 'gone'}; ${s.nodes || 0} elements in the tree` : 'no app view (flutter-view) on the page',
      hint: s.view ? 'an app that leaves out its accessibility tree cannot be tested this way, as it cannot be used with a screen reader.' : 'check the address: the app may still be loading, or the page is not this kind of app.',
    });
  }
  await settle(world);
}

/** A handle on an element of the tree, from its ref. */
async function handleOf(world, ref) {
  const handle = await world.page.evaluateHandle((r) => window.__webshipApp.lib.deref(r), ref);
  const element = handle.asElement();
  if (!element) {
    await handle.dispose();
    return null;
  }
  return element;
}

/** Bring an element into the viewport the way a person does: the mouse wheel over the scrolling area
 * it is in, a step at a time, until its whole box shows. */
async function scrollTo(world, ref) {
  const deadline = Date.now() + budget(world);
  for (let i = 0; i < 60 && Date.now() < deadline; i += 1) {
    const where = await world.page.evaluate((r) => {
      const lib = window.__webshipApp.lib;
      const el = lib.deref(r);
      if (!el) return null;
      if (lib.inViewport(r)) return { done: true };
      const b = el.getBoundingClientRect();
      const area = lib.scrollable(Math.min(Math.max(b.x + b.width / 2, 1), innerWidth - 1), Math.min(Math.max(b.y + b.height / 2, 1), innerHeight - 1));
      return { done: false, area, below: b.y + b.height > (area ? area.y + area.h : innerHeight), right: b.x + b.width > (area ? area.x + area.w : innerWidth) };
    }, ref);
    if (!where) return false;
    if (where.done) return true;
    const area = where.area || { x: 0, y: 0, w: 1280, h: 800, vertical: true };
    const before = await call(world, 'signature');
    await world.page.mouse.move(area.x + area.w / 2, area.y + area.h / 2);
    const step = Math.max(Math.round((area.vertical ? area.h : area.w) * 0.6), 100);
    if (area.vertical) await world.page.mouse.wheel(0, where.below ? step : -step);
    else await world.page.mouse.wheel(where.right ? step : -step, 0);
    await settle(world);
    // The list did not move: it goes no further that way.
    if (await call(world, 'signature') === before) break;
  }
  return call(world, 'inViewport', ref);
}

/** Note how many announcements the app made before an action, so a step after it reads only the
 * ones that came since. */
async function markAnnouncements(world) {
  try { world.appAnnounceMark = await call(world, 'announceCount'); } catch (e) { world.appAnnounceMark = 0; }
}

/**
 * Tap an element of the tree with a real pointer at the middle of its box, once the whole box is in
 * the viewport, then let the app settle. The app decides what a pointer at that place touches, as it
 * does for a person: the elements of its tree lie over each other (a row over its own controls), so
 * the step does not ask the browser which element is on top.
 */
async function tapRef(world, ref, what) {
  const inView = await scrollTo(world, ref);
  const centre = await call(world, 'centre', ref);
  if (!centre) {
    throw failure(world.page, `Could not tap ${what}: it left the app's accessibility tree.`, {
      hint: 'the app redrew it: the step looks for it again when it runs again.',
    });
  }
  if (!inView) {
    throw failure(world.page, `Could not tap ${what}: it does not come into the screen.`, {
      found: `its box is at ${Math.round(centre.x)},${Math.round(centre.y)}`,
      hint: 'the list that holds it may not scroll with the mouse wheel: scroll it first ("I scroll the app until I see "..."").',
    });
  }
  await markAnnouncements(world);
  try {
    await world.page.mouse.click(centre.x, centre.y);
  } catch (e) {
    throw friendly({ action: 'tap', target: what, cause: e, hint: 'the page may be navigating.' });
  }
  await settle(world);
}

/** The words a step uses for a kind of control. */
/** The plural of a kind of control, for the messages: "checkboxes", "radio buttons". */
function plural(kind) {
  return /(x|s|ch|sh)$/.test(kind) ? `${kind}es` : `${kind}s`;
}

const KIND_PATTERN = '(button|link|heading|tab|checkbox|radio button|switch|text field|image|menu item|slider)';

module.exports = {
  PROBE,
  budget,
  settleBudget,
  norm,
  listed,
  excerpt,
  sleep,
  ensureProbe,
  call,
  poll,
  settle,
  ensureTree,
  handleOf,
  scrollTo,
  markAnnouncements,
  tapRef,
  plural,
  KIND_PATTERN,
  failure: (page, message, details) => failure(page, message, details),
  friendly: (input, cause) => friendly(input, cause),
};
