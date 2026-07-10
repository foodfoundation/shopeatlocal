// Error classification for the retry policy, plus a small contract test that
// pins the 'intuit-oauth' surface and error shapes our adapters depend on.

import OAuthClient from "intuit-oauth";
import { CdClassifyError, CkAmbiguousError, TextError } from "../../src/QuickBooks/Client.js";

describe("CdClassifyError", () => {
  it("classifies auth failures for refresh/reauthorization", () => {
    expect(CdClassifyError({ code: "401" })).toBe("Auth");
    expect(CdClassifyError({ code: "403" })).toBe("Auth");
  });

  it("classifies throttling for Retry-After backoff", () => {
    expect(CdClassifyError({ code: "429" })).toBe("Throttle");
    // The SDK maps 429 to this named code:
    expect(CdClassifyError({ code: "RATE_LIMIT_EXCEEDED" })).toBe("Throttle");
  });

  it("classifies transient server and transport failures for retry", () => {
    expect(CdClassifyError({ code: "500" })).toBe("Transient");
    expect(CdClassifyError({ code: "503" })).toBe("Transient");
    // SDK-named codes for 500, timeout, and connection failures:
    expect(CdClassifyError({ code: "INTERNAL_SERVER_ERROR" })).toBe("Transient");
    expect(CdClassifyError({ code: "TIMEOUT_ERROR" })).toBe("Transient");
    expect(CdClassifyError({ code: "NETWORK_ERROR" })).toBe("Transient");
  });

  it("treats QuickBooks validation faults as permanent", () => {
    expect(CdClassifyError({ code: "6240" })).toBe("Validation");
    expect(CdClassifyError({ code: "400" })).toBe("Validation");
    expect(CdClassifyError({})).toBe("Validation");
  });
});

describe("CkAmbiguousError", () => {
  it("marks timeouts and network drops as ambiguous writes", () => {
    expect(CkAmbiguousError({ code: "TIMEOUT_ERROR" })).toBe(true);
    expect(CkAmbiguousError({ code: "NETWORK_ERROR" })).toBe(true);
    expect(CkAmbiguousError({ code: "500" })).toBe(false);
    expect(CkAmbiguousError({ code: "400" })).toBe(false);
  });
});

describe("TextError", () => {
  it("includes message, code, fault details, and intuit_tid", () => {
    const oText = TextError({
      message: "Bad Request",
      code: "6240",
      intuitTid: "tid-123",
      fault: {
        errors: [{ code: "6240", message: "Duplicate Name Exists Error", detail: "The name exists" }],
      },
    });
    expect(oText).toContain("Bad Request");
    expect(oText).toContain("code=6240");
    expect(oText).toContain("Duplicate Name Exists Error");
    expect(oText).toContain("intuit_tid=tid-123");
  });

  it("never explodes on sparse errors and caps length", () => {
    expect(TextError(undefined)).toContain("QuickBooks request failed");
    expect(TextError({ message: "x".repeat(5000) }).length).toBeLessThanOrEqual(2000);
  });
});

describe("intuit-oauth contract", () => {
  it("exposes the OAuth surface the adapters use", () => {
    expect(typeof OAuthClient).toBe("function");
    expect(OAuthClient.scopes.Accounting).toBe("com.intuit.quickbooks.accounting");
    for (const oName of ["authorizeUri", "createToken", "refreshUsingToken", "revoke", "makeApiCall", "setToken", "getToken"])
      expect(typeof OAuthClient.prototype[oName]).toBe("function");
  });

  it("builds environment-aware authorization URIs with state", () => {
    const oClient = new OAuthClient({
      clientId: "id",
      clientSecret: "secret",
      environment: "sandbox",
      redirectUri: "http://localhost:3000/quickbooks/callback",
    });
    const oURL = oClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: "state-token",
    });
    expect(oURL).toContain("https://appcenter.intuit.com/connect/oauth2");
    expect(oURL).toContain("state=state-token");
    expect(oURL).toContain("com.intuit.quickbooks.accounting");
    expect(oURL).toContain("response_type=code");
  });

  it("keeps token payload shape stable", () => {
    const oClient = new OAuthClient({
      clientId: "id",
      clientSecret: "secret",
      environment: "sandbox",
      redirectUri: "http://localhost:3000/quickbooks/callback",
    });
    oClient.setToken({
      token_type: "bearer",
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
      x_refresh_token_expires_in: 8726400,
      realmId: "12345",
      createdAt: Date.now(),
    });
    const oToken = oClient.getToken().getToken();
    expect(oToken.access_token).toBe("at");
    expect(oToken.refresh_token).toBe("rt");
    expect(oToken.realmId).toBe("12345");
  });
});
