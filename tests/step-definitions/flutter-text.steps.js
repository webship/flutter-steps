'use strict';

// Text and fields: what the app shows, and its text fields as a person fills them in.
//
// Text is read from the app's accessibility tree, a part of it, without regard to case and spaces:
// two nodes that read as one sentence ("You have pushed the button this many times:" and "1") count as
// one. A text field of the app is a real <input> or <textarea> in that tree, named by its label (a
// label and its hint are one name: "Enter a noun i.e. a person, place or thing"); typing reaches the
// app the way a keyboard user's does. A field is shown as invalid with `aria-invalid`, and its message
// is the text that follows it in its group (a checkbox's message joins its name).

const { When, Then } = require('@cucumber/cucumber');
const h = require('./flutter-helpers');

/**
 * The app shows a text (or does not show it), anywhere in its accessibility tree: a part of a text,
 * without regard to case and spaces. The step waits for it.
 *
 * Example #1: Then the app should show "You have pushed the button this many times: 1"
 * Example #2: Then the app should not show "Item 99"
 * Example #3: And the app should show "Please enter a noun."
 * Example #4: Then the app should show "The quick developer saw a time"
 * Example #5: Then the app should not show "Please enter an adjective."
 */
Then(/^the app should( not)? show "([^"]*)"$/, async function (not, text) {
  await h.ensureTree(this);
  const result = await h.poll(this, (lib, a) => {
    const shows = lib.showsText(a.text);
    return { done: a.not ? !shows : shows, texts: lib.texts().slice(0, 40) };
  }, { text, not: !!not }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, not
    ? `Expected the app not to show "${text}", but it does.`
    : `Expected the app to show "${text}", but its accessibility tree has no such text.`, {
    found: `the texts here: ${h.listed(result.texts, 20)}`,
    hint: not ? 'it may go after an animation: the step waits for that.' : 'text the app draws without a label or a Text widget is out of a screen reader\'s reach too; a list keeps only the rows near the screen in its tree ("I scroll the app until I see "..."").',
  });
});

async function resolveField(world, name) {
  await h.ensureTree(world);
  const result = await h.poll(world, (lib, a) => {
    const f = lib.findField(a.name);
    if (f.ref) return { done: true, ref: f.ref, names: f.names };
    // A form's other fields: a checkbox, a radio button or a switch, by its name.
    for (const kind of ['checkbox', 'radio button', 'switch', 'slider']) {
      const r = lib.find(kind, a.name);
      if (r.ref) return { done: true, ref: r.ref, names: f.names };
    }
    return { done: false, names: f.names };
  }, { name }, h.budget(world));
  if (result.ref) return result.ref;
  throw h.failure(world.page, `Expected a field named "${name}" in the app's accessibility tree, but there is none.`, {
    found: `the fields here: ${h.listed(result.names, 20)}`,
    hint: 'a field is named by its label (with its hint), matched from its start.',
  });
}

/**
 * Enter a text in a field of the app: `enter` puts the whole text in at once (as a paste does),
 * `type` presses its keys one after another (as a person types). The field is tapped first, so it
 * takes the focus as it would from a person.
 *
 * Example #1: When I enter "quick" in the app's "Enter an adjective" field
 * Example #2: When I type "fox" in the app's "Enter a noun" field
 * Example #3: And I enter "reader@example.com" in the app's "Email" field
 * Example #4: When we type "time" in the app's "Enter a noun" field
 * Example #5: When I enter "dD.123123ddd" in the app's "Password" field
 */
When(/^(?:I |we )?(enter|type) "([^"]*)" in the app's "([^"]*)" field$/, async function (how, text, name) {
  const ref = await resolveField(this, name);
  await h.tapRef(this, ref, `the field "${name}"`);
  // The app takes the text where its keyboard focus is: the field's own element in the tree, a frame
  // or two after the tap; or, for a field that had the focus before the tree was turned on (an
  // autofocus field), the app's hidden editing element, which keeps it.
  const focus = await h.poll(this, (lib, a) => {
    const own = lib.describe(a.ref).focused;
    const active = document.activeElement;
    const editing = !!active && /^(INPUT|TEXTAREA)$/.test(active.tagName) && !!active.closest('flt-text-editing-host');
    return { done: own || editing, own };
  }, { ref }, h.budget(this));
  await h.markAnnouncements(this);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const element = focus.own || !focus.done
      ? await h.handleOf(this, ref)
      : (await this.page.evaluateHandle(() => document.activeElement)).asElement();
    if (!element) throw h.failure(this.page, `Could not ${how} in the field "${name}": it left the app's accessibility tree.`, { hint: 'the app redrew it: run the step again.' });
    try {
      if (how === 'enter') await element.fill(text, { timeout: h.budget(this) });
      else {
        await element.fill('', { timeout: h.budget(this) });
        await this.page.keyboard.type(text, { delay: 20 });
      }
    } catch (e) {
      throw h.friendly({ action: how, target: `the field "${name}"`, cause: e, hint: 'a field that takes no text (a checkbox, a button) cannot be filled in.' });
    } finally {
      await element.dispose();
    }
    await h.settle(this);
    // The app keeps what it took: a text it did not take is gone from the field after its frame.
    const kept = await h.poll(this, (lib, a) => {
      const s = lib.describe(a.ref);
      return { done: s.exists && lib.norm(s.value) === lib.norm(a.text), value: s.value };
    }, { ref, text }, Math.min(h.budget(this), 2000));
    if (kept.done) return;
    if (attempt === 1) {
      if (!focus.own && focus.done) {
        throw h.failure(this.page, `The app took "${text}" in the field "${name}", but its accessibility tree shows the field ${kept.value ? `holding "${h.excerpt(kept.value, 40)}"` : 'empty'}: a screen reader does not hear what is typed there.`, {
          found: 'the field had the keyboard focus before the app\'s accessibility tree was turned on (a field that takes the focus when its page opens): the app edits it in a hidden element of its own',
          hint: 'an accessibility finding about the app. A scenario can turn the tree on on a page before the one with that field.',
        });
      }
      throw h.failure(this.page, `Expected the app's field "${name}" to hold "${text}" after it was ${how === 'enter' ? 'entered' : 'typed'}, but it holds "${h.excerpt(kept.value, 60)}".`, {
        hint: 'the app may change what is typed (a mask, a limit of length), or refuse it.',
      });
    }
  }
});

/**
 * Empty a text field of the app.
 *
 * Example #1: When I clear the app's "Enter a noun" field
 * Example #2: When I clear the app's "Enter an adjective" field
 * Example #3: And I clear the app's "Email" field
 * Example #4: When we clear the app's "Search" field
 * Example #5: When I clear the app's "Password" field
 */
When(/^(?:I |we )?clear the app's "([^"]*)" field$/, async function (name) {
  const ref = await resolveField(this, name);
  await h.tapRef(this, ref, `the field "${name}"`);
  const element = await h.handleOf(this, ref);
  if (element) {
    try { await element.fill('', { timeout: h.budget(this) }); } finally { await element.dispose(); }
  }
  await h.settle(this);
});

/**
 * A text field of the app holds a text (a part of it, without regard to case), or nothing. The step
 * waits for it.
 *
 * Example #1: Then the app's "Enter a noun" field should contain "fox"
 * Example #2: Then the app's "Enter an adjective" field should contain "quick"
 * Example #3: And the app's "Email" field should contain "reader@example.com"
 * Example #4: Then the app's "Enter a noun" field should contain "time"
 * Example #5: Then the app's "Search" field should contain "Item"
 */
Then(/^the app's "([^"]*)" field should contain "([^"]*)"$/, async function (name, text) {
  await expectValue(this, name, text);
});

/**
 * A text field of the app is empty. The step waits for it.
 *
 * Example #1: Then the app's "Enter a noun" field should be empty
 * Example #2: Then the app's "Enter an adjective" field should be empty
 * Example #3: And the app's "Email" field should be empty
 * Example #4: Then the app's "Search" field should be empty
 * Example #5: Then the app's "Password" field should be empty
 */
Then(/^the app's "([^"]*)" field should be empty$/, async function (name) {
  await expectValue(this, name, null);
});

async function expectValue(world, name, text) {
  const ref = await resolveField(world, name);
  const result = await h.poll(world, (lib, a) => {
    const s = lib.describe(a.ref);
    const v = lib.norm(s.value).toLowerCase();
    return { done: s.exists && (a.text === null ? v === '' : v.includes(lib.norm(a.text).toLowerCase())), value: s.value };
  }, { ref, text }, h.budget(world));
  if (result.done) return;
  throw h.failure(world.page, text === null
    ? `Expected the app's field "${name}" to be empty, but it holds "${h.excerpt(result.value, 60)}".`
    : `Expected the app's field "${name}" to contain "${text}", but it holds "${h.excerpt(result.value, 60)}".`, {
    hint: 'the app may change what is typed (a mask, a limit of length).',
  });
}

/**
 * A field of the app is shown as invalid (`aria-invalid`, after the form was checked) or as valid.
 * The step waits for the state.
 *
 * Example #1: Then the app's "Enter a noun" field should be shown as invalid
 * Example #2: Then the app's "Enter an adjective" field should be shown as valid
 * Example #3: And the app's "I agree to the terms of service." field should be shown as invalid
 * Example #4: Then the app's "Email" field should be shown as invalid
 * Example #5: Then the app's "Enter a noun" field should be shown as valid
 */
Then(/^the app's "([^"]*)" field should be shown as (valid|invalid)$/, async function (name, wanted) {
  const ref = await resolveField(this, name);
  const result = await h.poll(this, (lib, a) => {
    const s = lib.describe(a.ref);
    return { done: s.exists && s.invalid === (a.wanted === 'invalid'), invalid: s.invalid, messages: lib.messagesOf(a.ref) };
  }, { ref, wanted }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, `Expected the app's field "${name}" to be shown as ${wanted}, but it is shown as ${result.invalid ? 'invalid' : 'valid'}.`, {
    found: `what follows it: ${h.listed(result.messages)}`,
    hint: 'a form shows its states once it is checked: after a tap on its button that sends it, or as the field is left.',
  });
});

/**
 * A field of the app shows a message: the text that follows it in its form (or joins its name), a
 * part of it, without regard to case. The step waits for it.
 *
 * Example #1: Then the app's "Enter a noun" field should show the message "Not a valid noun."
 * Example #2: Then the app's "Enter an adjective" field should show the message "Please enter an adjective."
 * Example #3: And the app's "I agree to the terms of service." field should show the message "You must agree"
 * Example #4: Then the app's "Email" field should show the message "Enter a valid email address."
 * Example #5: Then the app's "Enter a noun" field should show the message "Please enter a noun."
 */
Then(/^the app's "([^"]*)" field should show the message "([^"]*)"$/, async function (name, text) {
  const ref = await resolveField(this, name);
  const result = await h.poll(this, (lib, a) => {
    const messages = lib.messagesOf(a.ref);
    const want = lib.norm(a.text).toLowerCase();
    return { done: messages.some((m) => lib.norm(m).toLowerCase().includes(want)), messages };
  }, { ref, text }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, `Expected the app's field "${name}" to show the message "${text}", but it does not.`, {
    found: `what follows it: ${h.listed(result.messages)}`,
    hint: 'a message shows once the form is checked: tap its button that sends it first.',
  });
});
