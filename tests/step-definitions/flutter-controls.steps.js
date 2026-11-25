'use strict';

// Controls: tapping them, and their states, as the app's accessibility tree gives them.
//
// A control is found by its role and its name, the way a screen reader names it: its label, or its
// own text. A name matches exactly, then without regard to case, then by its start; never by a part
// in the middle ("Add" does not match "Address"). A control that has no name is reached by the named
// row, group or region it sits in ("the button in the "Item 5" row"); `the app should have no unnamed
// buttons` reports it as an accessibility finding. A tap is a real pointer's: the app's own gesture
// handling gets it, as a mouse user's. A control below the screen is first scrolled into view with the
// mouse wheel.

const { When, Then } = require('@cucumber/cucumber');
const h = require('./flutter-helpers');

async function resolveControl(world, kind, name, scopeRef) {
  await h.ensureTree(world);
  const result = await h.poll(world, (lib, a) => {
    const r = lib.find(a.kind, a.name, a.scope);
    return { done: !!r.ref, ref: r.ref, names: r.names };
  }, { kind: kind || null, name, scope: scopeRef || 0 }, h.budget(world));
  if (result.ref) return result.ref;
  const noun = kind || 'control';
  throw h.failure(world.page, `Expected a ${noun} named "${name}" in the app's accessibility tree, but there is none.`, {
    found: `the ${kind ? h.plural(kind) : 'controls'} named here: ${h.listed(result.names, 20)}`,
    hint: 'a control is named by its label or its text, matched from its start. A control with no name is out of a screen reader\'s reach too: reach it by its row ("the button in the "..." row"), and report it ("the app should have no unnamed buttons").',
  });
}

async function tapControl(world, kind, name, scopeRef, where) {
  const ref = await resolveControl(world, kind, name, scopeRef);
  const d = await h.call(world, 'describe', ref);
  const what = `the ${kind || d.role || 'control'} "${name}"${where || ''}`;
  if (d.disabled) {
    throw h.failure(world.page, `Could not tap ${what}: it is disabled.`, {
      hint: 'wait for what makes it enabled first: "the app\'s "..." button should be enabled".',
    });
  }
  await h.tapRef(world, ref, what);
}

/**
 * Tap a control of the app by its name: a button, a link, a tab, a checkbox, a radio button, a switch
 * or a menu item. The step waits for it, scrolls it into view, taps it with a real pointer and waits
 * until the app has settled.
 *
 * Example #1: When I tap "Increment"
 * Example #2: When I tap "Validation"
 * Example #3: And I tap "Favorites"
 * Example #4: When we tap "Submit"
 * Example #5: When I tap "Sign in with HTTP"
 */
When(/^(?:I |we )?tap "([^"]*)"$/, async function (name) {
  await tapControl(this, null, name);
});

/**
 * Tap a control of a kind, by its name: when two controls share a name ("Elevated" is a button and
 * a tab), the kind says which.
 *
 * Example #1: When I tap the "Back" button
 * Example #2: When I tap the "Color" tab
 * Example #3: When I tap the "I agree to the terms of service." checkbox
 * Example #4: And we tap the "Favorites" button
 * Example #5: When I tap the "Typography" tab
 */
When(/^(?:I |we )?tap the "([^"]*)" (button|link|tab|checkbox|radio button|switch|menu item)$/, async function (name, kind) {
  await tapControl(this, kind, name);
});

/**
 * Tap the control of a kind that sits in a named row, group, item or region: the way to reach a
 * control that has no name of its own (an icon button without a label), or one whose name repeats
 * in every row. There must be one control of that kind there.
 *
 * Example #1: When I tap the button in the "Item 5" row
 * Example #2: When I tap the button in the "Item 0" row
 * Example #3: And I tap the checkbox in the "Settings" group
 * Example #4: When we tap the button in the "Share" item
 * Example #5: When I tap the switch in the "Notifications" region
 */
When(/^(?:I |we )?tap the (button|link|checkbox|radio button|switch|menu item) in the "([^"]*)" (row|group|item|region)$/, async function (kind, container, noun) {
  await h.ensureTree(this);
  const box = await h.poll(this, (lib, a) => {
    const c = lib.findContainer(a.name);
    return { done: !!c.ref, ...c };
  }, { name: container }, h.budget(this));
  if (!box.ref) {
    throw h.failure(this.page, `Expected a ${noun} named "${container}" in the app's accessibility tree, but there is none.`, {
      found: `the named rows, groups and regions here: ${h.listed(box.names, 20)}`,
      hint: 'a row is named by its label or its first line of text, matched from its start.',
    });
  }
  const inside = await h.poll(this, (lib, a) => {
    const r = lib.findControls(a.kind, null, a.scope);
    return { done: r.refs.length > 0, refs: r.refs, names: r.names };
  }, { kind, scope: box.ref }, h.budget(this));
  if (inside.refs.length !== 1) {
    throw h.failure(this.page, inside.refs.length
      ? `Expected one ${kind} in the "${container}" ${noun}, but there are ${inside.refs.length}.`
      : `Expected a ${kind} in the "${container}" ${noun}, but there is none.`, {
      found: `the ${h.plural(kind)} named there: ${h.listed(inside.names)}`,
      hint: inside.refs.length ? `name the one you mean: "I tap the "..." ${kind}".` : 'check the row: its control may be of another kind.',
    });
  }
  await h.tapRef(this, inside.refs[0], `the ${kind} in the "${container}" ${noun}`);
});

/**
 * Tap the element the app gives an identifier (its widget's `Semantics(identifier: ...)`): the hook a
 * developer adds for tests, kept in a release build.
 *
 * Example #1: When I tap the element identified as "favorite-5"
 * Example #2: When I tap the element identified as "increment"
 * Example #3: And I tap the element identified as "submit"
 * Example #4: When we tap the element identified as "story-done"
 * Example #5: When I tap the element identified as "favorites-tab"
 */
When(/^(?:I |we )?tap the element identified as "([^"]*)"$/, async function (id) {
  await h.ensureTree(this);
  const result = await h.poll(this, (lib, a) => {
    const r = lib.identified(a.id);
    return { done: !!r.ref, ...r };
  }, { id }, h.budget(this));
  if (!result.ref) {
    throw h.failure(this.page, `Expected an element identified as "${id}" in the app's accessibility tree, but there is none.`, {
      found: `the identifiers here: ${h.listed(result.ids, 20)}`,
      hint: 'the identifier is the one the app gives a widget with Semantics(identifier: ...).',
    });
  }
  await h.tapRef(this, result.ref, `the element identified as "${id}"`);
});

/**
 * Check or uncheck a checkbox of the app: it is tapped only when it is not in that state already,
 * and the step waits for the new state. (A switch or a radio button is tapped with "I tap the "..."
 * switch", and its state read with "the app's "..." switch should be on".)
 *
 * Example #1: When I check the "I agree to the terms of service." checkbox
 * Example #2: When I uncheck the "I agree to the terms of service." checkbox
 * Example #3: And I check the "Remember me" checkbox
 * Example #4: When we uncheck the "Remember me" checkbox
 * Example #5: When I check the "I agree" checkbox
 */
When(/^(?:I |we )?(check|uncheck) the "([^"]*)" checkbox$/, async function (verb, name) {
  await setChecked(this, 'checkbox', name, verb === 'check');
});

async function setChecked(world, kind, name, wanted) {
  const ref = await resolveControl(world, kind, name);
  const d = await h.call(world, 'describe', ref);
  if (d.checked !== wanted) {
    if (d.disabled) {
      throw h.failure(world.page, `Could not ${wanted ? 'check' : 'uncheck'} the ${kind} "${name}": it is disabled.`, {
        hint: 'wait for what makes it enabled first: "the app\'s "..." ' + kind + ' should be enabled".',
      });
    }
    await h.tapRef(world, ref, `the ${kind} "${name}"`);
  }
  const result = await h.poll(world, (lib, a) => {
    const s = lib.describe(a.ref);
    return { done: s.exists && s.checked === a.wanted, state: s };
  }, { ref, wanted }, h.budget(world));
  if (result.done) return;
  throw h.failure(world.page, `Expected the ${kind} "${name}" to be ${wanted ? 'checked' : 'unchecked'} after the tap, but it is not.`, {
    found: `checked: ${result.state && result.state.checked ? 'yes' : 'no'}`,
    hint: 'the app may refuse the change (a rule of the form), or ask for something first.',
  });
}

/**
 * The app shows a control, a heading or an image of a kind, by its name (or does not show it): in its
 * accessibility tree, with a box on the page. The step waits for it.
 *
 * Example #1: Then the app should show the "Increment" button
 * Example #2: Then the app should show the "Flutter Demo Home Page" heading
 * Example #3: Then the app should not show the "Back" button
 * Example #4: Then the app should show the "Enter a noun" text field
 * Example #5: And the app should show the "Components" tab
 */
Then(/^the app should( not)? show the "([^"]*)" (button|link|heading|tab|checkbox|radio button|switch|text field|image|menu item|slider)$/, async function (not, name, kind) {
  await h.ensureTree(this);
  const result = await h.poll(this, (lib, a) => {
    const r = lib.find(a.kind, a.name);
    return { done: a.not ? !r.ref : !!r.ref, names: r.names };
  }, { kind, name, not: !!not }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, not
    ? `Expected the app not to show the ${kind} "${name}", but it does.`
    : `Expected the app to show the ${kind} "${name}", but its accessibility tree has none.`, {
    found: `the ${h.plural(kind)} here: ${h.listed(result.names, 20)}`,
    hint: not ? 'it may go after an animation: the step waits for that.' : 'a widget left out of the app\'s accessibility tree is out of a screen reader\'s reach as well: that is a finding about the app.',
  });
});

/**
 * A control of the app is enabled or disabled (`aria-disabled`). The step waits for the state. When the
 * app shows several controls of that kind with that name (a gallery that shows each button enabled and
 * disabled), the step passes when one of them is in that state.
 *
 * Example #1: Then the app's "Elevated" button should be disabled
 * Example #2: Then the app's "Submit" button should be enabled
 * Example #3: And the app's "Filled" button should be enabled
 * Example #4: Then the app's "Enter a noun" text field should be enabled
 * Example #5: Then the app's "Outlined" button should be disabled
 */
Then(/^the app's "([^"]*)" (button|link|tab|checkbox|radio button|switch|text field|menu item|slider) should be (enabled|disabled)$/, async function (name, kind, wanted) {
  await h.ensureTree(this);
  const result = await h.poll(this, (lib, a) => {
    const r = lib.findControls(a.kind, a.name);
    const states = r.refs.map((x) => lib.describe(x));
    const hit = states.find((s) => s.disabled === (a.wanted === 'disabled'));
    return { done: !!hit, count: r.refs.length, names: r.names };
  }, { kind, name, wanted }, h.budget(this));
  if (result.done) return;
  const other = wanted === 'enabled' ? 'disabled' : 'enabled';
  throw h.failure(this.page, !result.count
    ? `Expected a ${kind} named "${name}" in the app's accessibility tree, but there is none.`
    : result.count === 1
      ? `Expected the app's ${kind} "${name}" to be ${wanted}, but it is ${other}.`
      : `Expected one of the app's ${result.count} ${h.plural(kind)} "${name}" to be ${wanted}, but all of them are ${other}.`, {
    found: `the ${h.plural(kind)} here: ${h.listed(result.names, 20)}`,
    hint: 'a disabled control carries aria-disabled="true".',
  });
});

/**
 * A checkbox, a radio button or a switch of the app is checked (on), or not (`aria-checked`). The
 * step waits for the state.
 *
 * Example #1: Then the app's "I agree to the terms of service." checkbox should be checked
 * Example #2: Then the app's "I agree to the terms of service." checkbox should not be checked
 * Example #3: Then the app's "Dark mode" switch should be on
 * Example #4: Then the app's "Dark mode" switch should not be on
 * Example #5: And the app's "Express delivery" radio button should be checked
 */
Then(/^the app's "([^"]*)" (checkbox|radio button|switch) should( not)? be (checked|on)$/, async function (name, kind, not, word) {
  const ref = await resolveControl(this, kind, name);
  const wanted = !not;
  const result = await h.poll(this, (lib, a) => {
    const s = lib.describe(a.ref);
    return { done: s.exists && s.checked === a.wanted, state: s };
  }, { ref, wanted }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, `Expected the app's ${kind} "${name}" ${not ? 'not ' : ''}to be ${word}, but it is ${wanted ? 'not' : ''} ${word}.`.replace(/\s+\./, '.').replace(/  +/g, ' '), {
    found: `aria-checked: ${result.state && result.state.checked ? 'true' : 'false'}`,
    hint: kind === 'checkbox' ? 'use "I check the "..." checkbox", which taps it only when it is not checked yet.' : `tap it: "I tap the "${name}" ${kind}".`,
  });
});

/**
 * A tab of the app is selected (`aria-selected`), or not. The step waits for the state.
 *
 * Example #1: Then the app's "Components" tab should be selected
 * Example #2: Then the app's "Color" tab should not be selected
 * Example #3: And the app's "Typography" tab should be selected
 * Example #4: Then the app's "Elevation" tab should not be selected
 * Example #5: Then the app's "Color" tab should be selected
 */
Then(/^the app's "([^"]*)" tab should( not)? be selected$/, async function (name, not) {
  const ref = await resolveControl(this, 'tab', name);
  const wanted = !not;
  const result = await h.poll(this, (lib, a) => {
    const s = lib.describe(a.ref);
    return { done: s.exists && s.selected === a.wanted, state: s };
  }, { ref, wanted }, h.budget(this));
  if (result.done) return;
  throw h.failure(this.page, `Expected the app's tab "${name}" ${not ? 'not ' : ''}to be selected, but it is ${result.state && result.state.selected ? '' : 'not '}selected.`, {
    hint: 'tap it first: "I tap the "..." tab".',
  });
});
