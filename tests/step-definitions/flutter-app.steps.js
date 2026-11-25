'use strict';

// The app itself: its accessibility tree turned on, its frames waited for, its route, how it was
// built, and what it announces to screen readers.
//
// An app of this kind draws on a canvas and builds an accessibility tree for screen readers only
// when one asks for it. The first step of a scenario turns that tree on the way assistive technology
// does (a click on the app's "Enable accessibility" button); every other step of the pack turns it on
// too when it is not, so a scenario may start with any of them.

const { Given, When, Then } = require('@cucumber/cucumber');
const h = require('./flutter-helpers');

/**
 * The app's accessibility tree is on: the step waits for the app to load, clicks its "Enable
 * accessibility" button as assistive technology does (nothing when the app turned the tree on
 * itself), and waits until the tree holds the app's elements and the app has settled.
 *
 * Example #1: Given the app's accessibility tree is on
 * Example #2: When I turn on the app's accessibility tree
 * Example #3: And the app's accessibility tree is on
 * Example #4: When we turn on the app's accessibility tree
 * Example #5: Given the app's accessibility tree is on
 */
Given(/^(?:the app's accessibility tree is on|(?:I |we )?turn on the app's accessibility tree)$/, async function () {
  await h.ensureTree(this);
});

/**
 * Wait until the app has settled: no frame scheduled and nothing changed in its tree for two frames,
 * at least one frame after the last input. Every step of the pack waits so already; this is for the
 * steps of other packs in between.
 *
 * Example #1: When I wait for the app to settle
 * Example #2: And I wait for the app to settle
 * Example #3: When we wait for the app to settle
 * Example #4: Then I wait for the app to settle
 * Example #5: When I wait for the app to settle
 */
When(/^(?:I |we )?wait for the app to settle$/, async function () {
  await h.ensureTree(this);
  const s = await h.settle(this, h.budget(this));
  if (!s.done) {
    const st = s.state || {};
    throw h.failure(this.page, 'Expected the app to settle, but it keeps drawing frames.', {
      found: `${st.scheduled || 0} frame(s) scheduled, the last change ${st.quietMs || 0} ms ago`,
      hint: 'something moves without end (a spinner, an animation): wait for what you expect instead, with a Then step.',
    });
  }
});

/**
 * The app is on a route: the path of its address after the `#` of a hash address (`#/validation`),
 * or below the app's base for a path address. The step waits for it.
 *
 * Example #1: Then the app should be on "/validation"
 * Example #2: Then the app should be on "/"
 * Example #3: And the app should be on "/favorites"
 * Example #4: Then the app should be on "/sign_in_http"
 * Example #5: Then the app should be on "/books/popular"
 */
Then(/^the app should be on "([^"]*)"$/, async function (wanted) {
  await h.ensureTree(this);
  const want = (wanted.startsWith('/') ? wanted : `/${wanted}`).replace(/(.)\/$/, '$1');
  const result = await h.poll(this, (lib, a) => {
    const route = lib.route().replace(/(.)\/$/, '$1');
    return { done: route === a.want, route };
  }, { want }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, `Expected the app to be on "${want}", but it is on "${result.route}".`, {
    found: `the address: ${this.page.url()}`,
    hint: 'a route is read from the hash of a hash address (#/route) or from the path below the app\'s base.',
  });
});

/**
 * How the app was built: its code compiled to WebAssembly (the faster build, where the browser has
 * what it needs) or to JavaScript (every other build, and the fallback of a WebAssembly build).
 *
 * Example #1: Then the app should run as WebAssembly
 * Example #2: Then the app should run as JavaScript
 * Example #3: And the app should run as WebAssembly
 * Example #4: And the app should run as JavaScript
 * Example #5: Then the app should run as WebAssembly
 */
Then(/^the app should run as (WebAssembly|JavaScript)$/, async function (wanted) {
  await h.ensureTree(this);
  const runs = await h.call(this, 'runsAs');
  if (runs === wanted) return;
  throw h.failure(this.page, `Expected the app to run as ${wanted}, but it runs as ${runs}.`, {
    hint: wanted === 'WebAssembly'
      ? 'a WebAssembly build falls back to JavaScript in a browser without what it needs, or when the server does not send the Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers it asks for.'
      : 'the app was built for WebAssembly, and this browser runs it.',
  });
});

/**
 * The app announces a message to screen readers (a polite or an assertive announcement, or a live
 * region of its tree): a part of it, without regard to case and spaces. Announcements are recorded
 * as they come, so a message announced after the last action and gone already counts; one from
 * before that action does not.
 *
 * Example #1: Then the app should announce "Added to favorites."
 * Example #2: Then the app should announce "Removed from favorites."
 * Example #3: And the app should announce "Saved"
 * Example #4: Then the app should announce "Item 5 added"
 * Example #5: Then the app should announce "added to favorites"
 */
Then(/^the app should announce "([^"]*)"$/, async function (text) {
  await h.ensureTree(this);
  const result = await h.poll(this, (lib, a) => {
    const r = lib.announced(a.text, a.from);
    return { done: r.hit, heard: r.heard };
  }, { text, from: this.appAnnounceMark || 0 }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, `Expected the app to announce "${text}", but it did not.`, {
    found: `what it announced: ${h.listed(result.heard)}`,
    hint: 'a message shown without an announcement (no live region) is not heard by a screen reader: check it with "the app should show".',
  });
});
