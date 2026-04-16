module.exports = {
  dependencies: {
    // iOS-only: uses App Group shared preferences for widget data.
    // Android widget bridge uses AsyncStorage instead.
    // The package's build.gradle is incompatible with Gradle 9+ (SDK 55).
    "react-native-shared-group-preferences": {
      platforms: {
        android: null,
      },
    },
  },
};
