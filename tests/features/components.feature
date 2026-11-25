@components
Feature: Tabs, buttons and dialogs of a gallery of components
  The Material 3 sample: a gallery of components under tabs, enabled and disabled buttons, and the
  dialogs a page asks with. A dialog is named by its title.

  Background:
    Given I am on "/material_3_demo/"
    And the app's accessibility tree is on

  # The gallery shows each button twice in one section, enabled and disabled, with nothing but the state to
  # tell the two apart: "should be enabled" and "should be disabled" each pass on one of them.
  @critical
  Scenario: The tabs, and buttons enabled and disabled
    Then the app's "Components" tab should be selected
    And the app's "Color" tab should not be selected
    And the app's "Elevated" button should be enabled
    And the app's "Elevated" button should be disabled
    When I tap the "Color" tab
    Then the app's "Color" tab should be selected
    And the app's "Components" tab should not be selected

  Scenario: A dialog asks, and goes with its button
    When I scroll the app until I see "Show dialog"
    And I tap "Show dialog"
    Then the app should show the "What is a dialog?" dialog
    And the app's "What is a dialog?" dialog should show "critical information"
    And the app's "Okay" button in the "What is a dialog?" dialog should be enabled
    When I tap "Okay" in the "What is a dialog?" dialog
    Then the app should show no dialog

  Scenario: A full-screen dialog goes with Escape
    When I scroll the app until I see "Show full-screen dialog"
    And I tap "Show full-screen dialog"
    Then the app should show the "Full-screen dialog" dialog
    When I dismiss the "Full-screen dialog" dialog
    Then the app should not show the "Full-screen dialog" dialog
    And the app should show no dialog

  # The check boxes and the radio buttons of the gallery share their names ("Option 1" ...): the kind
  # says which.
  Scenario: A choice of radio buttons, and check boxes of the same names
    When I scroll the app until I see the "Option 2" radio button
    Then the app's "Option 1" radio button should be checked
    And the app's "Option 1" checkbox should be checked
    When I tap the "Option 2" radio button
    Then the app's "Option 2" radio button should be checked
    And the app's "Option 1" radio button should not be checked
