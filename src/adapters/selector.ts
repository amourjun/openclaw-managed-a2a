import type { ManagedA2AResolvedConfig } from "../config.js";
import type {
  ManagedA2AAdapterProbe,
  ManagedA2AAdapterSelection,
  ManagedA2ATransportAdapter,
} from "./types.js";

type ProbeWithAdapter = {
  adapter: ManagedA2ATransportAdapter;
  probe: ManagedA2AAdapterProbe;
};

function findSupported(candidate: ProbeWithAdapter[]): ProbeWithAdapter | undefined {
  return candidate.find((item) => item.probe.supported);
}

export function selectManagedA2ATransportAdapter(params: {
  config: ManagedA2AResolvedConfig;
  candidates: ProbeWithAdapter[];
}): ManagedA2AAdapterSelection {
  const { config, candidates } = params;
  const probes = candidates.map((candidate) => candidate.probe);

  if (config.preferredAdapter === "runtime_subagent") {
    const runtimeSubagent = findSupported(
      candidates.filter((candidate) => candidate.adapter.id === "runtime_subagent"),
    );
    return runtimeSubagent
      ? {
          adapter: runtimeSubagent.adapter,
          reason: "Selected preferred adapter runtime_subagent",
          probes,
          used_fallback: false,
        }
      : {
          reason: "Preferred adapter runtime_subagent is not supported",
          probes,
          used_fallback: false,
        };
  }

  if (config.preferredAdapter === "cli_fallback") {
    const cli = findSupported(
      candidates.filter((candidate) => candidate.adapter.id === "cli_fallback"),
    );
    return cli
      ? {
          adapter: cli.adapter,
          reason: "Selected preferred adapter cli_fallback",
          probes,
          used_fallback: false,
        }
      : {
          reason: "Preferred adapter cli_fallback is not supported",
          probes,
          used_fallback: false,
        };
  }

  const runtimeSubagent = findSupported(
    candidates.filter((candidate) => candidate.adapter.id === "runtime_subagent"),
  );
  if (runtimeSubagent) {
    return {
      adapter: runtimeSubagent.adapter,
      reason: "Selected primary adapter runtime_subagent",
      probes,
      used_fallback: false,
    };
  }

  if (config.allowCliFallback) {
    const cli = findSupported(
      candidates.filter((candidate) => candidate.adapter.id === "cli_fallback"),
    );
    if (cli) {
      return {
        adapter: cli.adapter,
        reason: "Selected CLI fallback adapter",
        probes,
        used_fallback: true,
      };
    }
  }

  return {
    reason: "No supported managed A2A transport adapter is available",
    probes,
    used_fallback: false,
  };
}
