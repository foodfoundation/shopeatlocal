import { FeatureFlags } from "../src/FeatureFlags";

const _testEnv = FeatureFlags.testEnv;
const _prodEnv = FeatureFlags.prodEnv;

describe("FeatureFlags", () => {
  const FeatureFlagsTest = {
    ...FeatureFlags,
    testEnv: {
      ..._testEnv,
      testFlag: true,
    },
    prodEnv: {
      ..._prodEnv,
      testFlag: false,
    },
  };

  it("should have testEnv and prodEnv properties", () => {
    expect(FeatureFlagsTest).toHaveProperty("testEnv");
    expect(FeatureFlagsTest).toHaveProperty("prodEnv");
  });

  it('should have "testFlag" flag in testEnv and prodEnv', () => {
    expect(FeatureFlagsTest.testEnv).toHaveProperty("testFlag");
    expect(FeatureFlagsTest.prodEnv).toHaveProperty("testFlag");
  });

  it('should have "testFlag" flag set to true in testEnv', () => {
    expect(FeatureFlagsTest.testEnv.testFlag).toBe(true);
  });

  it('should have "testFlag" flag set to false in prodEnv', () => {
    expect(FeatureFlagsTest.prodEnv.testFlag).toBe(false);
  });
});
