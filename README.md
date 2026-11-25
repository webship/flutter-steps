<p align="center"><img src="https://raw.githubusercontent.com/webship/flutter-steps/2.0.x/assets/logo.svg" alt="Flutter logo" width="96"></p>

# flutter-steps

Cucumber step definitions for Flutter web apps, with [webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD
browser automation harness built on Playwright and Cucumber-js.

A Flutter web app draws its interface on a canvas. The steps test a built app as a person gets it in a browser,
through the accessibility tree Flutter builds for screen readers (its roles, its names and the identifiers the app
gives its widgets), with real pointer and keyboard input, and they wait on the app's own frames. A widget the app
leaves out of that tree is out of the steps' reach, as it is out of a screen reader's: a step says so as an
accessibility finding of the app.

The steps, their features, the sample apps and CI come with the first release, `2.0.0`.

## License

MIT (see `LICENSE`).

## Logo

The Flutter logo in this README comes from Simple Icons 16.37.0, filled with the colour the set lists for the brand;
the set is CC0-1.0 and points to Flutter's brand guidelines (https://flutter.dev/brand). The Flutter name and logo
are trademarks of their owner; this pack is not affiliated with or endorsed by them.
