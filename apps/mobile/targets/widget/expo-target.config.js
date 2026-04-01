/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  name: "WohnlyWidget",
  bundleIdentifier: "app.wohnly.widget",
  deploymentTarget: "17.0",
  frameworks: ["WidgetKit", "SwiftUI"],
  entitlements: {
    "com.apple.security.application-groups": ["group.app.wohnly"],
  },
};
