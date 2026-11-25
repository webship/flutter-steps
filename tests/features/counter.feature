@counter
Feature: The counter
  The app of `flutter create`, built for the web: a heading, a line that counts, and a button. The app
  draws on a canvas; the steps read the accessibility tree it builds for screen readers, which the
  first step turns on as assistive technology does.

  Background:
    Given I am on "/counter/"
    And the app's accessibility tree is on

  @critical
  Scenario: The button adds one to the count, once per tap
    Then the app should show the "Flutter Demo Home Page" heading
    And the app should show "You have pushed the button this many times: 0"
    When I tap "Increment"
    Then the app should show "You have pushed the button this many times: 1"
    When I tap the "Increment" button
    And I tap "Increment"
    Then the app should show "You have pushed the button this many times: 3"
    And the app should not show "You have pushed the button this many times: 4"

  Scenario: What the app holds, by role and name
    Then the app should show the "Increment" button
    And the app's "Increment" button should be enabled
    And the app should not show the "Decrement" button
    And the app should have no unnamed buttons
    And the app should be on "/"

  @javascript
  Scenario: The app runs as JavaScript
    Then the app should run as JavaScript

  @webassembly
  Scenario: The app runs as WebAssembly where the browser can
    Then the app should run as WebAssembly
