'use strict';

// Dialogs of the app: shown or not, what they show, a control tapped in one, and dismissing one.
//
// A dialog is an element of the app's accessibility tree with the dialog or alertdialog role (modal).
// The tree gives that element no name of its own: the route inside it carries a generic one
// ("Alert"), and its title is its first heading or line of text. So a dialog is named by its title
// ("Your story", "What is a dialog?"), or by those other names. A bottom sheet is not a dialog in the
// tree (only a region named "Dialog"): reach what it holds by its controls and its text.

const { When, Then } = require('@cucumber/cucumber');
const h = require('./flutter-helpers');

async function resolveDialog(world, title) {
  await h.ensureTree(world);
  const result = await h.poll(world, (lib, a) => {
    const d = lib.findDialog(a.title);
    return { done: !!d.ref, ref: d.ref, titles: d.titles };
  }, { title }, h.budget(world));
  if (result.ref) return result.ref;
  throw h.failure(world.page, `Expected the app to show a dialog titled "${title}", but it shows ${result.titles.length ? `others` : 'none'}.`, {
    found: `the dialogs here: ${h.listed(result.titles)}`,
    hint: 'a dialog is named by its title: its first heading, or its first line of text.',
  });
}

/**
 * The app shows a dialog titled so (or does not show it). The step waits for it to open, or to go.
 *
 * Example #1: Then the app should show the "Your story" dialog
 * Example #2: Then the app should not show the "Your story" dialog
 * Example #3: Then the app should show the "What is a dialog?" dialog
 * Example #4: And the app should show the "Full-screen dialog" dialog
 * Example #5: Then the app should not show the "What is a dialog?" dialog
 */
Then(/^the app should( not)? show the "([^"]*)" dialog$/, async function (not, title) {
  await h.ensureTree(this);
  const result = await h.poll(this, (lib, a) => {
    const d = lib.findDialog(a.title);
    return { done: a.not ? !d.ref : !!d.ref, titles: d.titles };
  }, { title, not: !!not }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, not
    ? `Expected the app not to show the dialog "${title}", but it does.`
    : `Expected the app to show a dialog titled "${title}", but it shows ${result.titles.length ? 'others' : 'none'}.`, {
    found: `the dialogs here: ${h.listed(result.titles)}`,
    hint: not ? 'a dialog goes once it is dismissed: "I dismiss the "..." dialog", or a tap on one of its buttons.' : 'a dialog is named by its title: its first heading, or its first line of text.',
  });
});

/**
 * The app shows no dialog. The step waits for every dialog to go.
 *
 * Example #1: Then the app should show no dialog
 * Example #2: And the app should show no dialog
 * Example #3: Then the app should show no dialog
 * Example #4: And the app should show no dialog
 * Example #5: Then the app should show no dialog
 */
Then(/^the app should show no dialog$/, async function () {
  await h.ensureTree(this);
  const result = await h.poll(this, (lib) => {
    const list = lib.dialogs();
    return { done: list.length === 0, titles: list };
  }, null, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, `Expected the app to show no dialog, but it shows ${result.titles.length}.`, {
    found: `the dialogs here: ${h.listed(result.titles)}`,
    hint: 'dismiss it first, or tap one of its buttons.',
  });
});

/**
 * Tap a control of a dialog of the app, by its name: the step waits for the dialog, taps the control
 * in it with a real pointer, and waits until the app has settled (a dialog that closes goes after an
 * animation).
 *
 * Example #1: When I tap "Done" in the "Your story" dialog
 * Example #2: When I tap "Okay" in the "What is a dialog?" dialog
 * Example #3: And I tap "Dismiss" in the "What is a dialog?" dialog
 * Example #4: When we tap "Close" in the "Full-screen dialog" dialog
 * Example #5: When I tap "Done" in the "Your story" dialog
 */
When(/^(?:I |we )?tap "([^"]*)" in the "([^"]*)" dialog$/, async function (name, title) {
  const dialog = await resolveDialog(this, title);
  const result = await h.poll(this, (lib, a) => {
    const r = lib.find(null, a.name, a.scope);
    return { done: !!r.ref, ref: r.ref, names: r.names };
  }, { name, scope: dialog }, h.budget(this));
  if (!result.ref) {
    throw h.failure(this.page, `Expected a control named "${name}" in the "${title}" dialog, but there is none.`, {
      found: `the controls named there: ${h.listed(result.names)}`,
      hint: 'a control is named by its label or its text, matched from its start.',
    });
  }
  await h.tapRef(this, result.ref, `"${name}" in the "${title}" dialog`);
});

/**
 * A dialog of the app shows a text: a part of it, without regard to case and spaces. The step waits
 * for it.
 *
 * Example #1: Then the app's "Your story" dialog should show "The quick developer saw a time"
 * Example #2: Then the app's "What is a dialog?" dialog should show "critical information"
 * Example #3: And the app's "Your story" dialog should show "quick"
 * Example #4: Then the app's "Full-screen dialog" dialog should show "Close"
 * Example #5: Then the app's "What is a dialog?" dialog should show "prompt for a decision"
 */
Then(/^the app's "([^"]*)" dialog should show "([^"]*)"$/, async function (title, text) {
  const dialog = await resolveDialog(this, title);
  const result = await h.poll(this, (lib, a) => {
    const t = lib.dialogText(a.ref);
    return { done: lib.norm(t).toLowerCase().includes(lib.norm(a.text).toLowerCase()), text: t };
  }, { ref: dialog, text }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, `Expected the app's dialog "${title}" to show "${text}", but it does not.`, {
    found: `what it shows: "${h.excerpt(result.text, 200)}"`,
    hint: 'a text is matched by a part of it, without regard to case.',
  });
});

/**
 * Dismiss a dialog of the app with Escape, pressed with the keyboard focus in it as a keyboard user's
 * is; the step waits for it to go. A dialog that must be answered stays: the step says so.
 *
 * Example #1: When I dismiss the "Your story" dialog
 * Example #2: When I dismiss the "What is a dialog?" dialog
 * Example #3: And I dismiss the "Full-screen dialog" dialog
 * Example #4: When we dismiss the "Your story" dialog
 * Example #5: When I dismiss the "What is a dialog?" dialog
 */
When(/^(?:I |we )?dismiss the "([^"]*)" dialog$/, async function (title) {
  const dialog = await resolveDialog(this, title);
  await h.call(this, 'focusIn', dialog);
  await h.markAnnouncements(this);
  await this.page.keyboard.press('Escape');
  await h.settle(this);
  const result = await h.poll(this, (lib, a) => {
    const d = lib.findDialog(a.title);
    return { done: !d.ref, titles: d.titles };
  }, { title }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, `Expected the dialog "${title}" to go after Escape, but it stays.`, {
    found: `the dialogs here: ${h.listed(result.titles)}`,
    hint: 'a dialog that must be answered ignores Escape: tap one of its buttons instead.',
  });
});
