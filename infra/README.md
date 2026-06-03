# Infra

The full story is in the [top-level README](../README.md#deploy-to-azure).
Quick reference for what's in this directory:

| File | Role |
| --- | --- |
| `main.bicep` | Standard-env (Sweden Central): managed env, server, STT (GPU), TTS (GPU), UAMI, sandbox group. |
| `express.bicep` | Express-env (West Central US): one container app per agent, fed the per-sandbox `adcproxy.io` URL. |
| `acr-role.bicep` | Grants AcrPull to the UAMI on the existing `simon` ACR (cross-RG). Used by `main.bicep` only. |
| `sandbox-bootstrap.sh` | Idempotent: lays down `/opt/sandbox_wrapper.py`, the runner, and the GH-token env file inside a sandbox. Invoked by `New-CopilotSandbox.ps1`. |
| `New-CopilotSandbox.ps1` | Provision a single GitHub-Copilot-preset sandbox with all MCP connectors attached. The aca CLI cannot wire connectors; this calls the data-plane management API directly. |
| `Recycle-Sandbox.ps1` | Delete + recreate a single agent's sandbox via `New-CopilotSandbox.ps1` and PUT the new URL on its relay container app. |
| `deploy.ps1` | One-shot orchestrator. RGs → ACR builds → main → sandboxes (snapshot or `New-CopilotSandbox.ps1`) → express → agent registration. |

## Sandbox provisioning: the connector problem

Our agent sandboxes need three GitHub Copilot MCP connectors attached at create
time (Calendar / Mail / Teams via `Microsoft.Web/connectorGateways/.../mcpserverconfigs`).
Two facts force us off the `aca` CLI default path:

1. **`aca sandbox create` cannot attach connectors.** The CLI / YAML schema has
   no `connections` or `gatewayConnections` fields. There is no subcommand for
   it either.
2. **Connectors are immutable post-create.** PATCH against a single sandbox
   resource ID returns 404 for `gatewayConnections`. The only ways to attach
   them are (a) the data-plane "preset" PUT to the sandbox collection
   (no id) or (b) restoring from a snapshot of a sandbox that already has them.

We use option (a). The portal hits this endpoint when you create a sandbox
through the UI:

```
PUT https://management.{region}.azuredevcompute.io/subscriptions/{sub}/
    resourceGroups/{rg}/sandboxGroups/{sg}/sandboxes?api-version=2026-02-01-preview
Authorization: Bearer <token for resource https://management.azuredevcompute.io>
{
  "presetSandboxType": "GitHubCopilot",
  "labels": { "agent-id": "nova" },
  "gatewayConnections": [
    { "resourceId": ".../mcpserverconfigs/Work-IQ-Calendar-MCP-zen-rug" },
    { "resourceId": ".../mcpserverconfigs/Work-IQ-Mail-MCP-fig-yam" },
    { "resourceId": ".../mcpserverconfigs/Work-IQ-Teams-MCP-joy-pot" }
  ]
}
```

`New-CopilotSandbox.ps1` wraps this. It also discovers the connector list at
runtime by querying ARM for all `mcpserverconfigs` on the gateway whose name
matches `-ConnectorFilter` (default `Work-IQ-*-MCP-*`), so it copes with the
random suffixes the gateway adds (e.g. `-zen-rug`, `-fig-yam`).

The preset gives the sandbox the GitHub Copilot CLI baked in — but **not** our
HTTP wrapper at `/opt/sandbox_wrapper.py`. The helper still uploads the wrapper
and runs `sandbox-bootstrap.sh` to wire the GH token and start the runner.

## Sandbox auto-suspend gotcha

The `GitHubCopilot` preset defaults the auto-suspend interval to **300 seconds**.
`aca sandbox create` defaults it to **600 seconds**. Either way, when a sandbox
transitions to `Idle`, the public adcproxy URL returns
`HTTP 502 {"error":"Sandbox is not available"}` until the sandbox is explicitly
resumed via the control plane (`aca sandbox resume --id …`). The proxy does
**not** wake the sandbox on inbound traffic — it's data-plane only, and the
agent relays have no managed identity for control-plane resume.

For our long-lived demo agents we therefore set:

```
aca sandbox lifecycle set --id <id> --auto-suspend 31536000 --mode Memory
```

`New-CopilotSandbox.ps1` does this on every sandbox it creates. When you recycle
a sandbox by hand, **always** use `Recycle-Sandbox.ps1` — it calls the helper.

## Express environment notes

- `environmentMode: 'Express'` is set in `express.bicep`; Bicep can't yet
  validate this property so we suppress `BCP037` there.
- Only `westcentralus` and `eastasia` are supported by Express today.
- Express envs have **no managed identity** support, so `express.bicep` pulls
  images using the ACR admin user/password. `deploy.ps1` enables admin on the
  ACR and feeds the creds to the deployment.
- Express envs reject `--secrets` passed at create time; the bicep template
  declares them on the container app itself, which works.

## Sandbox snapshots

Snapshots live in the same sandbox group. The captured demo uses:

```
aca --sandbox-group voiceconnect-sb sandbox snapshot --id <agent-sandbox-id> --name aria-demo-YYYY-MM-DD
```

Restore via:

```
aca --sandbox-group voiceconnect-sb sandbox create --label agent-id=aria --snapshot aria-demo-YYYY-MM-DD
```

The `deploy.ps1 -AriaSnapshot ... -NovaSnapshot ...` flags wrap this.
