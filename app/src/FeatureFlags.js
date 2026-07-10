/** Feature flags for switching on/off features in an environment aware manner */
const FeatureFlags = {
  testEnv: {
    paypalUpdate: true,
    quickbooksOnline: true,
  },
  prodEnv: {
    paypalUpdate: true,
    quickbooksOnline: false,
  },
};

export default FeatureFlags;
