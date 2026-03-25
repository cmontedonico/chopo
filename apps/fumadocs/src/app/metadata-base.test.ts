import { describe, expect, test } from "bun:test";

import { createMetadataBase } from "./metadata-base";

describe("createMetadataBase", () => {
  test("prepends https for hostnames without a scheme", () => {
    expect(createMetadataBase("example.com").toString()).toBe("https://example.com/");
  });

  test("prepends http for localhost hosts without a scheme", () => {
    expect(createMetadataBase("localhost:4000").toString()).toBe("http://localhost:4000/");
  });

  test("falls back to localhost when parsing still fails", () => {
    expect(createMetadataBase("://bad url").toString()).toBe("http://localhost:4000/");
  });
});
