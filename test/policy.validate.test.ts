import { describe, expect, it } from "vitest";
import { resolveManagedA2APluginConfig } from "../src/config.js";
import { ManagedA2AError } from "../src/errors.js";
import { parseManagedA2ARequest } from "../src/policy/validate.js";

describe("parseManagedA2ARequest", () => {
  it("normalizes a valid single-turn request", () => {
    const config = resolveManagedA2APluginConfig(undefined);
    const request = parseManagedA2ARequest(
      {
        request_id: "req_001",
        requester_agent_id: "domain-dsp-ops",
        target_agent_id: "domain-multimedia-ops",
        question: "Health check: reply only OK",
        mode: "orchestrated_internal",
        ttl_seconds: 30,
        hop: 1,
        visited_agents: ["domain-dsp-ops", "domain-dsp-ops"],
        publish_contract: "evidence_only",
        external_announce: "forbidden",
      },
      config,
    );

    expect(request.visited_agents).toEqual(["domain-dsp-ops"]);
    expect(request.timeout_seconds).toBe(config.defaultTimeoutSeconds);
  });

  it("rejects loops through visited_agents", () => {
    const config = resolveManagedA2APluginConfig(undefined);

    expect(() =>
      parseManagedA2ARequest(
        {
          request_id: "req_001",
          requester_agent_id: "domain-dsp-ops",
          target_agent_id: "domain-multimedia-ops",
          question: "Health check: reply only OK",
          mode: "orchestrated_internal",
          ttl_seconds: 30,
          hop: 1,
          visited_agents: ["domain-dsp-ops", "domain-multimedia-ops"],
          publish_contract: "evidence_only",
          external_announce: "forbidden",
        },
        config,
      ),
    ).toThrowError(ManagedA2AError);
  });

  it("rejects timeout values that exceed ttl", () => {
    const config = resolveManagedA2APluginConfig(undefined);

    expect(() =>
      parseManagedA2ARequest(
        {
          request_id: "req_001",
          requester_agent_id: "domain-dsp-ops",
          target_agent_id: "domain-multimedia-ops",
          question: "Health check: reply only OK",
          mode: "orchestrated_internal",
          ttl_seconds: 30,
          timeout_seconds: 40,
          hop: 1,
          visited_agents: ["domain-dsp-ops"],
          publish_contract: "evidence_only",
          external_announce: "forbidden",
        },
        config,
      ),
    ).toThrowError(ManagedA2AError);
  });
});
