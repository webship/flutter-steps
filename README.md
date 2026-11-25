<p align="center"><img src="https://raw.githubusercontent.com/webship/flutter-steps/2.0.x/assets/logo.svg" alt="Flutter logo" width="96"></p>

# flutter-steps

Cucumber step definitions for Flutter web apps, for [webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD
browser automation harness built on Playwright and Cucumber-js.

A Flutter web app draws its interface on a canvas: its text, its buttons and its lists are pixels, not elements of
the page. The steps test a built app as a person gets it in a browser, through the accessibility tree Flutter builds
for screen readers: its roles, its names, its states and the identifiers the app gives its widgets. They tap with a
real pointer, type with the keyboard, scroll with the mouse wheel, and wait on the app's own frames, never for a
fixed time.

That tree is also their limit, and the pack says so. A widget the app leaves out of the tree is out of the steps'
reach, as it is out of a screen reader's: a step that does not find it says so as an accessibility finding about the
app, not as a fault of the test. `Then the app should have no unnamed buttons` lists the controls a screen reader
cannot name, each with its place.

No step phrase names the framework: a scenario reads `When I tap "Increment"`, `When I enter "quick" in the app's
"Enter an adjective" field` and `Then the app should show the "Your story" dialog`.

CI builds four sample apps for the web in a pinned Flutter SDK image (3.50.1), once for JavaScript (CanvasKit) and
once for WebAssembly (skwasm), serves each build, and runs the whole suite against it twice, then the assertions
that must fail; see [`.github/workflows/test.yml`](.github/workflows/test.yml).

## The accessibility tree, and turning it on

Flutter keeps its accessibility tree off until something asks for it. Before that, the page holds the canvas and one
hidden button, "Enable accessibility", for assistive technology to activate. `Given the app's accessibility tree is
on` activates it the way assistive technology does, with a click on that element (a DOM click, as a screen reader's
activation is, not a pointer at its place: the button is one pixel, off the screen). Every step of the pack does it
first when it has not been done, and an app that turns its tree on by itself needs nothing. The app is neither
rebuilt nor instrumented: that click is the one thing the pack changes.

What a keyboard user meets: Flutter puts the keyboard focus in its view when the app starts, and the first presses of
Tab move through the app's own focus order, drawn on the canvas. On the counter, the 4th Tab reaches "Enable
accessibility", and Enter or Space on it turns the tree on; from there, Tab moves through the tree's controls in
order.

## From nothing to a green run

What the machine needs: git, Node.js 24 or later with npm, Python 3 to serve the apps, and Docker to build them (or
a Flutter web app that is built and served already).

**1. An app.** Any Flutter web app works (step 5 points the suite at it). To start, build the sample apps of this
repository: the counter of `flutter create`, and three apps of the official Flutter samples (a form, a long list, a
gallery of Material 3 components). The script builds them in a container with the Flutter SDK 3.50.1, whose image it
builds first (once; about 3 GB):

```bash
git clone https://github.com/webship/flutter-steps.git
cd flutter-steps
npm run samples:build
npm run samples:serve
```

The apps answer at `http://127.0.0.1:8080/counter/`, `/form_app/`, `/testing_app/` and `/material_3_demo/`; leave the
server running in its own terminal. None of the apps has accounts: the steps need none.

**2. A test project**, in another folder:

```bash
mkdir flutter-tests && cd flutter-tests
npm init -y
npm install --save-dev webship-js @webship-js/flutter-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and
the `npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run
changes nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the
tags that keep the lanes of this repository out of a normal run, and the address of the apps.

```javascript
module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/flutter-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: ['tests/features/**/*.feature'],
    // Work in progress, the assertions that must fail and the scenarios of WebAssembly builds stay out.
    tags: 'not @wip and not @must-fail and not @webassembly',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://127.0.0.1:8080',
      // Browser errors are reported, not failed.
      javascript: { mode: 'warn', levels: ['error'] },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
    },
  },
};
```

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: The counter counts each tap
    Given I am on "/counter/"
    And the app's accessibility tree is on
    Then the app should show "You have pushed the button this many times: 0"
    When I tap "Increment"
    Then the app should show "You have pushed the button this many times: 1"

  Scenario: A form shows what is missing
    Given I am on "/form_app/"
    When I tap "Validation"
    And I tap "Submit"
    Then the app's "Enter a noun" field should show the message "Please enter a noun."
```

**5. Run it.** Set `LAUNCH_URL` to the address of the apps:

```bash
LAUNCH_URL=http://127.0.0.1:8080 npm test
```

A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two
scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
11 steps (11 passed)
0m05.447s (executing steps: 0m05.415s)
[webship-js] HTML report → …/flutter-tests/tests/reports/cucumber_report.html
```

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under
`node_modules/@webship-js/flutter-steps/tests/features/`): together they use every step of the pack, against the
sample apps.

### On an app of your own

Point `LAUNCH_URL` at the address the app is served at, and write the features from what its tree gives: the steps
name things as a screen reader does. A step that does not find a name lists the names it found, and `Then the app
should have no unnamed controls` lists the controls without one.

- **A control without a name** is reached through the named row, group or region it sits in (`When I tap the button
  in the "Item 5" row`). Better, give it a name in the app (a tooltip, a `semanticLabel`, a `Semantics` label), or an
  identifier (`Semantics(identifier: 'favorite-5')`, kept in a release build) for `When I tap the element identified
  as "favorite-5"`.
- **Routes**: `Then the app should be on "/validation"` reads the route after the `#` of an app with hash addresses,
  and the path under the app's base of one with path addresses (its server must answer every path with
  `index.html`).
- **WebAssembly**: CI serves the WebAssembly builds with the cross-origin isolation headers
  (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`), which the renderer of a
  WebAssembly build needs to run on several threads; served without them, Chromium still runs the build as
  WebAssembly. `Then the app should run as WebAssembly` says which build the browser runs.

### What the suite tests

The features of this repository run every step of the pack against the four sample apps, built for JavaScript and for
WebAssembly, in CI on every change:

- the counter: its heading, its count, the button tapped three times (one tap each), what the app holds by role and
  name, no unnamed button, and the build it runs as;
- the validation page of the forms sample: the form sent empty with the message of each field, a word entered and one
  typed key by key, a checkbox checked and unchecked, a field cleared, the story's dialog closed with its button and
  with Escape, and the app's own Back button;
- the testing sample: a list of a hundred rows scrolled down to a row and back to the top, a row's button reached
  through its row (the buttons have no name), the message announced after each tap, the favourites page at its own
  address, and the browser's back button;
- the Material 3 gallery: tabs, buttons enabled and disabled, a dialog that asks and goes with its button, a
  full-screen dialog that goes with Escape, and radio buttons beside checkboxes of the same names;
- an address that opens a page of an app directly.

Not tested: what the app draws but leaves out of its tree (colours, layout, pictures, text drawn without semantics),
hover effects, text selection, dragging, sliders and switches (found by their role like the other controls, but the
samples' sliders and switches have no name of their own), and the page elements an app embeds (platform views).

## Requirements

- Node.js 24 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A Flutter web app, built and served over HTTP (proven on Flutter 3.50.1, built for JavaScript and for WebAssembly)

## Install

```bash
npm install --save-dev @webship-js/flutter-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`, after webship-js's own:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/flutter-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the app:

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://app.example.com',
   },
   ```

3. Write a feature from what the app shows:

```gherkin
Feature: Signing in
  Scenario: The form asks for a password
    Given I am on "/"
    And the app's accessibility tree is on
    When I enter "ada@example.com" in the app's "Email" field
    And I tap "Sign in"
    Then the app's "Password" field should show the message "Enter your password."
```

Run `npx cucumber-js --dry-run` once: it reports any undefined or ambiguous step before a browser opens.

## Test users

None. The sample apps have no sign-in, and the steps need no account (an app's own sign-in form is filled in with
the steps of the pack, like any other form). `cucumber.js` lists no accounts and no scenario signs in:

```json
{}
```

## What is included

| File | Steps | Covers |
| --- | --- | --- |
| `flutter-app.steps.js` | 5 | The accessibility tree turned on, the wait for the app to settle, the app's route, the build it runs as (JavaScript or WebAssembly), and what the app announces to a screen reader. |
| `flutter-controls.steps.js` | 9 | A tap on a control by its name, by its kind and name, by the named row, group or region it sits in, or by the identifier the app gives it; a checkbox checked or unchecked; a control shown or not, enabled or disabled, checked or not; a tab selected or not. |
| `flutter-text.steps.js` | 7 | A text shown or not; a field: a text entered or typed key by key, cleared, what it holds, empty, shown as valid or invalid, the message it shows. |
| `flutter-dialogs.steps.js` | 5 | A dialog by its title: shown or not, none shown, what it shows, a control tapped in it, dismissed with Escape. |
| `flutter-lists.steps.js` | 2 | Scrolling until a text or a control is on the screen; no unnamed buttons (or controls). |
| `flutter-helpers.js` | | Shared plumbing for the files above and for your own steps: the wait budgets, the poll on the page, the wait for the app to settle, the tree turned on, scrolling into view, taps, the failure messages. It registers no step. |
| `flutter-probe.js` | | The page side: put into every page before the app's own scripts, it watches the app's frames, its accessibility tree and its announcements, and finds what the steps name. It registers no step. |

webship-js's own steps still go to an address (`Given I am on "/counter/"`), go back (`When I go back`), set the
viewport and press keys. Its steps that read the page (`I should see "..."`, `I fill in "..." with "..."`) look for
elements that an app drawn on a canvas does not have: use this pack's steps for what the app shows.

## How the steps find things and wait

- **By role and name, as a screen reader does.** A control by its role (button, link, tab, checkbox, radio button,
  switch, menu item, text field, slider, heading, image) and its accessible name: its label, its tooltip or its
  text. A name matches exactly, then without regard to case and spaces, then by its start; never by a part in the
  middle ("Add" never matches "Address"). A tooltip that joins a button's name after a hover ("Increment Increment")
  still matches by the start. A text field is named by its label (its hint follows the label in its name). When the
  app shows several controls of a kind with the same name (a gallery that shows each button enabled and disabled),
  `should be enabled` and `should be disabled` pass when one of them is.
- **A dialog by its title.** Flutter gives its dialogs the role of a dialog but no name, so a step names a dialog by
  its title: the first heading or line of text in it.
- **The states of the tree**: `aria-checked`, `aria-selected`, `aria-invalid`, `aria-disabled`, and the identifier
  the app gives a widget (`flt-semantics-identifier`). The engine's own elements and ids are never in a step.
- **Taps are a real pointer's.** A control is scrolled into the screen first, then tapped with the mouse at the
  middle of its box: the app's own gesture handling decides what that touches, as it does for a mouse user.
- **Typing goes to the field's own input**, as a keyboard user's does: `enter` puts the text in at once, `type`
  presses a key for each character. The step checks that the field holds the text afterwards.
- **On the app's own frames.** Flutter draws a frame when something has changed, and updates its tree at the end of
  it. The page side of the pack, put in before the app's scripts, watches the frames the app asks the browser for:
  after an action, a step waits for at least one frame, then for two quiet ones (no frame asked for, nothing changed
  in the tree), or for 100 milliseconds of nothing at all.
- **Then steps wait for what they expect**, up to the step's budget (`minWaitTime.page`, at least 10 seconds),
  looking every 50 milliseconds from Node.js: an endless animation cannot hold a step up, and a step that looks too
  early does not fail.
- **"Until I see" means on the screen.** A list keeps the rows near the screen in the tree too. `When I scroll the
  app until I see "Item 25"` scrolls until the row's box is inside the window and inside the areas it scrolls in,
  moving each scrolling area of the screen in turn with the mouse wheel, down to its end and back up.
- **Failures say what was found.** `Expected a button named "Decrement" in the app's accessibility tree, but there is
  none.` with the buttons the tree holds, and a hint on where to look.

### Notes on waits

What Flutter does that a test must wait past, found by recording the frames and the tree in a real browser:

- **The tree follows a frame later.** Right after a tap, the tree still shows the old count: a step waits for the
  frames after its action, not for the click to return.
- **The first frame can come late.** The app may ask for its first frame after a step has looked and seen none: a
  step waits for a frame after its action, or 100 milliseconds of nothing, before it counts quiet frames.
- **A tap's ink ripple asks for frames** for about 450 milliseconds; a dialog takes about 220 to go. The steps wait
  for both.
- **Short messages.** "Added to favorites." enters the tree about 350 milliseconds after the tap, is announced to
  screen readers, and leaves when its time is up. The page side records the announcements from the page's start, so
  `Then the app should announce "..."` finds one that has gone again; it reads the ones made since the last action.
- **Scrolling areas.** After a pointer event, Flutter turns the browser's scrolling of its scrolling areas off for
  half a second; the steps scroll with the mouse wheel over the area, as a person does.
- **A field that had the keyboard focus before the tree was on** is edited by the app in a hidden element of its own,
  and the field in the tree stays empty. `enter` and `type` report that as an accessibility finding; open the page of
  that field after the tree is on (the features tap "Validation" on the home page of the forms sample).

## Steps

One example of each step; the JSDoc block above each definition holds five or more.

### `flutter-app.steps.js` (5)

- `Given the app's accessibility tree is on`
- `When I wait for the app to settle`
- `Then the app should be on "/validation"`
- `Then the app should run as WebAssembly`
- `Then the app should announce "Added to favorites."`

### `flutter-controls.steps.js` (9)

- `When I tap "Increment"`
- `When I tap the "Back" button`
- `When I tap the button in the "Item 5" row`
- `When I tap the element identified as "favorite-5"`
- `When I check the "I agree to the terms of service." checkbox`
- `Then the app should show the "Increment" button`
- `Then the app's "Elevated" button should be disabled`
- `Then the app's "I agree to the terms of service." checkbox should be checked`
- `Then the app's "Components" tab should be selected`

### `flutter-text.steps.js` (7)

- `Then the app should show "You have pushed the button this many times: 1"`
- `When I enter "quick" in the app's "Enter an adjective" field`
- `When I clear the app's "Enter a noun" field`
- `Then the app's "Enter a noun" field should contain "fox"`
- `Then the app's "Enter a noun" field should be empty`
- `Then the app's "Enter a noun" field should be shown as invalid`
- `Then the app's "Enter a noun" field should show the message "Not a valid noun."`

### `flutter-dialogs.steps.js` (5)

- `Then the app should show the "Your story" dialog`
- `Then the app should show no dialog`
- `When I tap "Done" in the "Your story" dialog`
- `Then the app's "Your story" dialog should show "The quick developer saw a time"`
- `When I dismiss the "Your story" dialog`

### `flutter-lists.steps.js` (2)

- `When I scroll the app until I see "Item 25"`
- `Then the app should have no unnamed buttons`

## What the steps report about an app

The honest step of the pack fails on the testing sample, whose favourite buttons have no name:

```
Expected the app to have no unnamed buttons, but 17 have no name: button in the "Item 0" group; button in the
"Item 1" group; … and 7 more.
```

A screen reader announces each of them as "button", and nothing else. The features reach them through their rows,
and the must-fail lane keeps the finding in sight.

## Phrases shared with other packs

None of this pack's phrases matches one of webship-js (`npm run test:examples` checks it), nor one of the 51 step
packs published so far: they say "the app" where the packs of the frameworks of web pages say "the dialog" or "the
field", so the pack loads beside any of them.

## Flutter's own tests and this pack

Flutter's own tests run inside the app: its widget tests, and its integration tests (the `integration_test` package,
run in a browser with `flutter drive`), are Dart code that finds widgets in the widget tree by their key, their type
or their text, and pumps frames until none is scheduled. They need the app's source and a debug or profile build.
This pack tests the release build as it is served, from outside, through what a screen reader gets: the two do not
replace each other. The samples' own tests, and the features that cover the same ground:

| The samples' own tests | In this pack |
| --- | --- |
| The counter's `test/widget_test.dart` of `flutter create`: a tap adds one | `counter.feature`: three taps, one each, and what the app holds by role and name |
| `testing_app/integration_test/app_test.dart`: finding an item further down the list, the favourite buttons and their messages, an item added to the favourites, the remove button | `list.feature`: a row further down scrolled to, made a favourite with its message, removed on the favourites page; the same button adds and removes |
| `testing_app/test/home_test.dart`: the list, scrolling, the icon buttons, the way to the favourites | `list.feature` and `routes.feature`: back to the top of the list, the favourites page at its own address, the browser's back |
| `material_3_demo/test/component_screen_test.dart`: the components of the main page, the navigation rail at a narrow and a wide window | `components.feature`: tabs, buttons enabled and disabled, a dialog and a full-screen dialog, radio buttons and checkboxes |
| `form_app/test/form_app_test.dart`: signing in, with a good and a bad password | not in this pack: the features take the validation page of the same app |

Where a test of the samples finds a widget by its key (`find.byKey(ValueKey('icon_5'))`), a feature finds it as a
person does, through the row it sits in (`the button in the "Item 5" row`): keys are not in a built app.

## Testing this package

```bash
npm install
npm run samples:build      # the four sample apps for JavaScript, in samples/site/
npm run samples:serve &    # served at http://127.0.0.1:8080
npm run test:examples      # the examples and the features against the step patterns
npm run test:paths         # a feature or a scenario named on the command line runs alone
npx cucumber-js --dry-run  # no undefined and no ambiguous step
LAUNCH_URL=http://127.0.0.1:8080 npm test                 # the suite
LAUNCH_URL=http://127.0.0.1:8080 npm run test:must-fail   # assertions that must fail, each with its message
```

The WebAssembly lane builds the same apps with `--wasm` and serves them with the cross-origin isolation headers:

```bash
npm run samples:build:wasm   # in samples/site-wasm/
npm run samples:serve:wasm & # at http://127.0.0.1:8080, isolated
CUCUMBER_TAGS='not @wip and not @must-fail and not @javascript' LAUNCH_URL=http://127.0.0.1:8080 npm test
```

`tests/must-fail/` holds scenarios that assert something that is not true of the sample apps. `npm run
test:must-fail` runs them and checks that each one fails at its last step, with the message it announces and a hint:
a step that cannot fail proves nothing. It runs them with a wait of 3 seconds (`COMPONENT_WAIT_MS`), since each of
them waits its whole budget.

`LAUNCH_URL` points the suite at another address; `npx cucumber-js tests/features/list.feature` runs one feature and
`npx cucumber-js tests/features/list.feature:<line>` one scenario (the line of its `Scenario:`); `FEATURES` runs a
subset too (`FEATURES=tests/features/list.feature npm test`); `CUCUMBER_TAGS=@critical` runs the smoke lane;
`HEADLESS=false` shows the browser.

The suite leaves the apps as it found them: each scenario starts the app afresh in its own browser, and the apps
keep their state there.

## The sample apps

The apps are built, not kept in this repository. [`.github/scripts/build-samples.sh`](.github/scripts/build-samples.sh)
creates the counter with `flutter create`, checks out three apps of the official Flutter samples at a pinned commit
(`form_app`, `testing_app` and `material_3_demo`), and builds each for the web into `samples/`. The SDK image,
[`.github/sdk/Dockerfile`](.github/sdk/Dockerfile), starts from Debian (bookworm, slim) pinned by its digest, and
checks the Flutter 3.50.1 archive against the checksum of Flutter's list of releases.

- The [Flutter samples](https://github.com/flutter/samples) are released under the BSD-3-Clause licence by the
  Flutter authors. Their code was read and built, and nothing of it is in this repository: the steps and the features
  of this pack are its own.

## How the steps were written

Everything a step relies on was seen in a real browser first, on release builds of the sample apps: the tree Flutter
builds and when it changes, the frames after each input, where the keyboard focus goes, what a keyboard user meets.
The steps were written from that, and are proven on Flutter 3.50.1, built for JavaScript (CanvasKit) and for
WebAssembly (skwasm), in English, with Chromium.

## License

MIT (see `LICENSE`).

## Logo

The Flutter logo in this README comes from Simple Icons 16.37.0, filled with the colour the set lists for the brand;
the set is CC0-1.0 and points to Flutter's brand guidelines (https://flutter.dev/brand). The Flutter name and logo
are trademarks of their owner; this pack is not affiliated with or endorsed by them.
