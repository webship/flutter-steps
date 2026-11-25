@must-fail
Feature: Assertions on the app, its controls and its lists that must fail
  Each scenario asserts something that is not true of the sample apps, at its last step.

  Scenario: The app on another route
    Fails with: Expected the app to be on "/settings", but it is on "/".
    Given I am on "/counter/"
    Then the app should be on "/settings"

  Scenario: The app built for the other target
    Fails with: Expected the app to run as WebAssembly, but it runs as JavaScript.
    Given I am on "/counter/"
    Then the app should run as WebAssembly

  Scenario: A message the app never announced
    Fails with: Expected the app to announce "Saved", but it did not.
    Given I am on "/counter/"
    When I tap "Increment"
    Then the app should announce "Saved"

  Scenario: A control the app does not have
    Fails with: Expected a control named "Decrement" in the app's accessibility tree, but there is none.
    Given I am on "/counter/"
    When I tap "Decrement"

  Scenario: A control of another kind
    Fails with: Expected a link named "Increment" in the app's accessibility tree, but there is none.
    Given I am on "/counter/"
    When I tap the "Increment" link

  Scenario: A row the list does not have
    Fails with: Expected a row named "Item 999" in the app's accessibility tree, but there is none.
    Given I am on "/testing_app/"
    When I tap the button in the "Item 999" row

  Scenario: An identifier the app does not give
    Fails with: Expected an element identified as "increment" in the app's accessibility tree, but there is none.
    Given I am on "/counter/"
    When I tap the element identified as "increment"

  Scenario: A button that is not shown
    Fails with: Expected the app to show the button "Decrement", but its accessibility tree has none.
    Given I am on "/counter/"
    Then the app should show the "Decrement" button

  Scenario: A button that is shown
    Fails with: Expected the app not to show the button "Increment", but it does.
    Given I am on "/counter/"
    Then the app should not show the "Increment" button

  Scenario: An enabled button is not disabled
    Fails with: Expected the app's button "Increment" to be disabled, but it is enabled.
    Given I am on "/counter/"
    Then the app's "Increment" button should be disabled

  Scenario: A checkbox not checked yet
    Fails with: Expected the app's checkbox "I agree to the terms of service." to be checked, but it is not checked.
    Given I am on "/form_app/"
    When I tap "Validation"
    Then the app's "I agree to the terms of service." checkbox should be checked

  Scenario: A tab that is not selected
    Fails with: Expected the app's tab "Color" to be selected, but it is not selected.
    Given I am on "/material_3_demo/"
    Then the app's "Color" tab should be selected

  Scenario: The buttons of the list have no name
    Fails with: Expected the app to have no unnamed buttons, but
    Given I am on "/testing_app/"
    Then the app should have no unnamed buttons

  Scenario: A row the list never reaches
    Fails with: Expected to see "Item 999" in the app after scrolling, but it never showed.
    Given I am on "/testing_app/"
    When I scroll the app until I see "Item 999"
