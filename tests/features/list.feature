@list
Feature: A long list, its rows' buttons and the messages they bring
  The testing sample: a list of a hundred rows, each with a button that adds the row to the favourites
  and back, a message after each tap, and a page of the favourites. The list keeps in the app's tree
  only the rows near the screen; the rows' buttons have no name of their own, so a step reaches each one
  by its row.

  Background:
    Given I am on "/testing_app/"
    And the app's accessibility tree is on

  @critical
  Scenario: A row further down is scrolled to, made a favourite, and removed from the favourites page
    Then the app should not show "Item 60"
    When I scroll the app until I see "Item 60"
    And I tap the button in the "Item 60" row
    Then the app should announce "Added to favorites."
    When I tap "Favorites"
    Then the app should be on "/favorites_page"
    And the app should show "Item 60"
    When I tap the button in the "Item 60" row
    Then the app should announce "Removed from favorites."
    And the app should not show "Item 60"

  Scenario: The same button adds a row, then takes it away
    Then the app's button in the "Item 0" row should be enabled
    When I tap the button in the "Item 0" row
    Then the app should announce "Added to favorites."
    When I tap the button in the "Item 0" row
    Then the app should announce "Removed from favorites."

  Scenario: Back to the top of the list
    When I scroll the app until I see "Item 40"
    Then the app should not show "Item 0"
    When I scroll the app until I see "Item 2"
    Then the app should show "Item 2"
