@validation
Feature: A form that checks what is typed
  The validation page of the forms sample: two text fields and a checkbox, checked when the form is
  sent, and a dialog with the story the words make.

  Background:
    Given I am on "/form_app/"
    And the app's accessibility tree is on
    When I tap "Validation"

  @critical
  Scenario: A form sent empty shows what is missing, then a filled one tells the story
    Then the app should be on "/validation"
    And the app should show the "📖 Story Generator" heading
    When I tap "Submit"
    Then the app's "Enter an adjective" field should be shown as invalid
    And the app's "Enter an adjective" field should show the message "Please enter an adjective."
    And the app's "Enter a noun" field should show the message "Please enter a noun."
    And the app's "I agree to the terms of service." field should show the message "You must agree to the terms of service."
    When I enter "quick" in the app's "Enter an adjective" field
    And I type "time" in the app's "Enter a noun" field
    And I check the "I agree to the terms of service." checkbox
    Then the app's "Enter a noun" field should contain "time"
    And the app's "I agree to the terms of service." checkbox should be checked
    When I tap "Submit"
    Then the app should show the "Your story" dialog
    And the app's "Your story" dialog should show "The quick developer saw a time"
    When I tap "Done" in the "Your story" dialog
    Then the app should show no dialog
    And the app's "Enter an adjective" field should be shown as valid

  Scenario: A word that is not a noun is refused
    When I enter "quick" in the app's "Enter an adjective" field
    And I enter "fox" in the app's "Enter a noun" field
    And I tap "Submit"
    Then the app's "Enter a noun" field should show the message "Not a valid noun."
    When I clear the app's "Enter a noun" field
    Then the app's "Enter a noun" field should be empty
    When I uncheck the "I agree to the terms of service." checkbox
    Then the app's "I agree to the terms of service." checkbox should not be checked

  Scenario: Escape dismisses the story, and the app's Back leads home
    When I enter "quick" in the app's "Enter an adjective" field
    And I enter "time" in the app's "Enter a noun" field
    And I check the "I agree to the terms of service." checkbox
    And I tap "Submit"
    Then the app should show the "Your story" dialog
    When I dismiss the "Your story" dialog
    Then the app should not show the "Your story" dialog
    When I tap the "Back" button
    Then the app should be on "/"
    And the app should show the "Form Samples" heading
