# Renderer regression checks

Use this app to test the local library, not an installed registry version. The
fixture is bundled `test.pdf`; no third-party PDF URL is required.

## Build

```sh
cd FabricExample
npm install
bundle install
cd ios && bundle exec pod install && cd ..
npm start
# In another terminal, from FabricExample:
npm run ios
```

The example uses React Native 0.86.3 / React 19.2.3 and enables the New Architecture.
Use a Node version supported by RN 0.86 and a current Ruby/Bundler installation.
The iOS app adopts UIScene lifecycle, required by iOS 27. On Android the fork always uses the JS
page renderer, including the scenario labelled `native`; native PDFKit regression
coverage is iOS-only.

## Acceptance matrix

The status reports **observed page**, total pages, and the independent controlled
`page` prop. `Page 1/2/3` only invoke the public ref API. They never update that
prop. Page status updates only from `onPageChanged`; also inspect the rendered
PDF and overlay to verify actual positioning.

| Scenario | Check |
| --- | --- |
| overlay | Tap Page 2 and Page 3; visible PDF and overlay change while `prop: 1` stays unchanged. |
| native | On iOS, repeat navigation without an overlay. No JS-renderer-only behavior should be needed. |
| wrapper | Repeat navigation through a custom FlatList. Outer pinch is intentionally disabled; navigation still works. |
| legacy | iOS `usePDFKit=false`: navigation works and the PDF fills its original measuring wrapper. |
| single | Page 3 must not scroll beyond the one-item thumbnail list or crash. Thumbnail selection is unchanged. |
| on-load | Immediately requests page 2 from `onLoadComplete`, before assuming the list ref is ready. Expect page 2 with `prop: 1`. |
| hidden | Loads in a zero-size container and requests page 3. Tap Show; expect page 3 after layout becomes usable. |

In overlay mode also check:

- Page 3, then Controlled 2: the later controlled change navigates to page 2.
- Rapid Page 2/Page 3: the latest request wins.
- Hide, Page 3, Show: request survives unavailable layout.
- Zoom and Direction: overlays remain aligned; scroll and default pinch work.
- Annotations: visibility changes on pages containing annotations.
- Unmount/Mount: the PDF loads again; no native-command ref errors or crashes.

## Repeatable device checks

After installing the freshly built app, start Metro on an unused port, then open
a dedicated device session (replace the device name with your own):

```sh
npm start -- --port 8087
agent-device open org.reactjs.native.example.FabricExample --platform ios \
  --device 'PDF QA iPhone' --session pdf-ios-qa --metro-port 8087 --relaunch
npm run test:e2e -- pdf-ios-qa
# Android app id: com.fabricexample; use a separate Android session.
```

`test:e2e` requires agent-device >= 0.20.0. It asserts observed pages, independent
controlled props and the absence of `onError` messages, then saves screenshots.
It is not a pixel-diff suite or a complete native-error detector.

## Verified on 2026-09-21

- RN 0.86.3 Debug builds: Xcode 27 / iOS Simulator; Android API 34 arm64 emulator.
- The navigation script passed on both iOS 27 and Android 14: overlay imperative
  navigation, controlled updates, on-load requests, zero-size layout recovery,
  custom wrapper, legacy route, single-page bounds, horizontal navigation and
  unmount/remount. Native PDFKit navigation additionally passed on iOS.
- Screenshots confirmed that the PDF pixels and page overlays matched the
  requested second/third page. The horizontal viewport regression discovered
  during testing was fixed by stretching the list within its pinch container.
- iOS pinch visibly changed scale; Android programmatic zoom worked. The Android
  automation pinch did not establish a scale change and still needs manual
  multi-touch verification. Annotation appearance toggling needs a dedicated
  annotated fixture; the included book is not sufficient coverage.
- Runtime console capture showed RN deep-import deprecation warnings for the
  library's codegen utilities. No `dispatchCommand` ref error was observed.
- The first fresh Android emulator boot displayed system/System UI ANR dialogs;
  after dismissing them the navigation suite completed. These were OS dialogs,
  not a PDF app exception.

Do not treat a status update alone as proof of correct pixels. Capture screenshots
for page positions and overlay alignment, and inspect runtime errors. Selection
support, pre-download command queuing, and general native document lifecycle
races are not claimed fixed by these checks.
