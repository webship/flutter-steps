@must-fail
Feature: Assertions on the app's text, fields and dialogs that must fail
  Each scenario asserts something that is not true of the sample apps, at its last step.

  Scenario: A count the app does not show
    Fails with: Expected the app to show "You have pushed the button this many times: 7", but its accessibility tree has no such text.
    Given I am on "/counter/"
    Then the app should show "You have pushed the button this many times: 7"

  Scenario: A text the app shows
    Fails with: Expected the app not to show "You have pushed", but it does.
    Given I am on "/counter/"
    Then the app should not show "You have pushed"

  Scenario: A field that holds another word
    Fails with: Expected the app's field "Enter an adjective" to contain "slow", but it holds "quick".
    Given I am on "/form_app/"
    When I tap "Validation"
    And I enter "quick" in the app's "Enter an adjective" field
    Then the app's "Enter an adjective" field should contain "slow"

  Scenario: A field that is not empty
    Fails with: Expected the app's field "Enter an adjective" to be empty, but it holds "quick".
    Given I am on "/form_app/"
    When I tap "Validation"
    And I enter "quick" in the app's "Enter an adjective" field
    Then the app's "Enter an adjective" field should be empty

  Scenario: A field before the form is checked
    Fails with: Expected the app's field "Enter a noun" to be shown as invalid, but it is shown as valid.
    Given I am on "/form_app/"
    And I tap "Validation"
    Then the app's "Enter a noun" field should be shown as invalid

  Scenario: A message the field does not show
    Fails with: Expected the app's field "Enter a noun" to show the message "Not a valid noun.", but it does not.
    Given I am on "/form_app/"
    When I tap "Validation"
    And I tap "Submit"
    Then the app's "Enter a noun" field should show the message "Not a valid noun."

  Scenario: A field the page does not have
    Fails with: Expected a field named "Email" in the app's accessibility tree, but there is none.
    Given I am on "/form_app/"
    When I tap "Validation"
    And I enter "reader@example.com" in the app's "Email" field

  Scenario: A dialog that is not open
    Fails with: Expected the app to show a dialog titled "Your story", but it shows none.
    Given I am on "/form_app/"
    And I tap "Validation"
    Then the app should show the "Your story" dialog

  Scenario: An open dialog
    Fails with: Expected the app to show no dialog, but it shows 1.
    Given I am on "/form_app/"
    When I tap "Validation"
    And I enter "quick" in the app's "Enter an adjective" field
    And I enter "time" in the app's "Enter a noun" field
    And I check the "I agree to the terms of service." checkbox
    And I tap "Submit"
    Then the app should show no dialog

  Scenario: A dialog that is open
    Fails with: Expected the app not to show the dialog "Your story", but it does.
    Given I am on "/form_app/"
    When I tap "Validation"
    And I enter "quick" in the app's "Enter an adjective" field
    And I enter "time" in the app's "Enter a noun" field
    And I check the "I agree to the terms of service." checkbox
    And I tap "Submit"
    Then the app should not show the "Your story" dialog

  Scenario: A text the dialog does not show
    Fails with: Expected the app's dialog "Your story" to show "slow", but it does not.
    Given I am on "/form_app/"
    When I tap "Validation"
    And I enter "quick" in the app's "Enter an adjective" field
    And I enter "time" in the app's "Enter a noun" field
    And I check the "I agree to the terms of service." checkbox
    And I tap "Submit"
    Then the app's "Your story" dialog should show "slow"

  Scenario: A button the dialog does not have
    Fails with: Expected a control named "Cancel" in the "Your story" dialog, but there is none.
    Given I am on "/form_app/"
    When I tap "Validation"
    And I enter "quick" in the app's "Enter an adjective" field
    And I enter "time" in the app's "Enter a noun" field
    And I check the "I agree to the terms of service." checkbox
    And I tap "Submit"
    When I tap "Cancel" in the "Your story" dialog

  Scenario: A field that had the focus before the tree was turned on
    Fails with: The app took "quick" in the field "Enter an adjective", but its accessibility tree shows the field empty
    Given I am on "/form_app/#/validation"
    When I enter "quick" in the app's "Enter an adjective" field
