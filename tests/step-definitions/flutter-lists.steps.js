'use strict';

// Long lists, and the controls a screen reader cannot name.
//
// A list of the app keeps in its accessibility tree only the rows near the screen (and a few below
// it): a row further down is not there until the list scrolls, and a row that is there may still be
// below the screen. So "until I see" scrolls with the mouse wheel, as a person does, until the row's
// whole box is inside the screen and its list, not only in the tree.

const { When, Then } = require('@cucumber/cucumber');
const h = require('./flutter-helpers');

/**
 * Scroll the app with the mouse wheel until a text (its start), or a control of a kind by its name,
 * shows inside the screen: each scrolling area in turn, the largest first, down to its end, then up
 * to its start. What is already on the screen needs no scrolling.
 *
 * Example #1: When I scroll the app until I see "Item 25"
 * Example #2: When I scroll the app until I see the "Option 2" radio button
 * Example #3: And I scroll the app until I see "Show dialog"
 * Example #4: When we scroll the app until I see "Item 49"
 * Example #5: When I scroll the app until I see the "Show dialog" button
 */
When(/^(?:I |we )?scroll the app until I see (?:the "([^"]*)" (button|link|heading|tab|checkbox|radio button|switch|text field|image|menu item|slider)|"([^"]*)")$/, async function (name, kind, plain) {
  await h.ensureTree(this);
  const text = kind ? name : plain;
  const deadline = Date.now() + h.budget(this) * 3;
  const seen = async () => {
    const found = await h.call(this, 'locateText', text, kind || null);
    if (found.visible) return true;
    return found.ref ? h.scrollTo(this, found.ref) : false;
  };
  if (await seen()) return;
  // Every scrolling area shown moves a step in turn (two columns of a page side by side), down to its
  // end, then up to its start, until the text shows or every area has been through.
  const areas = (await h.call(this, 'scrollables')).map((a) => ({ ...a, direction: 1, done: false }));
  while (Date.now() < deadline && areas.some((a) => !a.done)) {
    for (const area of areas.filter((a) => !a.done)) {
      const before = await h.call(this, 'signature', area.ref);
      await this.page.mouse.move(area.x + area.w / 2, area.y + area.h / 2);
      const step = Math.max(Math.round((area.vertical ? area.h : area.w) * 0.6), 100);
      if (area.vertical) await this.page.mouse.wheel(0, area.direction * step);
      else await this.page.mouse.wheel(area.direction * step, 0);
      await h.settle(this);
      if (await seen()) return;
      // The area did not move: it is at its end this way; up it goes, then it is done.
      if (await h.call(this, 'signature', area.ref) === before) {
        if (area.direction === 1) area.direction = -1;
        else area.done = true;
      }
    }
  }
  const texts = await h.call(this, 'texts');
  throw h.failure(this.page, `Expected to see ${kind ? `the ${kind} "${text}"` : `"${text}"`} in the app after scrolling, but it never showed.`, {
    found: `the texts on the screen: ${h.listed(texts, 20)}`,
    hint: 'the text is matched from its start; a row left out of the app\'s accessibility tree never shows to a screen reader either.',
  });
});

/**
 * The app has no button (or no control of any kind) without a name: a control a screen reader can
 * only call "button". The step lists each one with the place a person would read it by (the named
 * row, group, region or dialog it sits in): an accessibility finding about the app.
 *
 * Example #1: Then the app should have no unnamed buttons
 * Example #2: Then the app should have no unnamed controls
 * Example #3: And the app should have no unnamed buttons
 * Example #4: And the app should have no unnamed controls
 * Example #5: Then the app should have no unnamed buttons
 */
Then(/^the app should have no unnamed (buttons|controls)$/, async function (kinds) {
  await h.ensureTree(this);
  await h.settle(this);
  const list = await h.call(this, 'unnamed', kinds);
  if (!list.length) return;
  throw h.failure(this.page, `Expected the app to have no unnamed ${kinds}, but ${list.length} ${list.length === 1 ? 'has' : 'have'} no name: ${list.slice(0, 10).join('; ')}${list.length > 10 ? `; and ${list.length - 10} more` : ''}.`, {
    hint: 'give each one a label a screen reader can read: a tooltip, a semanticLabel, or Semantics(label: ...). Until then, a step reaches it by its row: "I tap the button in the "..." row".',
  });
});
