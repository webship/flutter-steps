@routes
Feature: Routes and the browser's history
  An app's pages have addresses of their own (after a `#` here): a tap takes the app to one, the
  browser's back button returns, and an address opens its page directly.

  @critical
  Scenario: A page of its own, and the browser's back
    Given I am on "/testing_app/"
    And the app's accessibility tree is on
    Then the app should be on "/"
    When I tap "Favorites"
    Then the app should be on "/favorites_page"
    When I go back
    Then the app should be on "/"
    And the app should show "Item 0"

  Scenario: An address opens its page directly
    Given I am on "/form_app/#/validation"
    And the app's accessibility tree is on
    Then the app should be on "/validation"
    And the app should show the "📖 Story Generator" heading
    When I tap the "Back" button
    Then the app should be on "/"
    And the app should show the "Validation" button
