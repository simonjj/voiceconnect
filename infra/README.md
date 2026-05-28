# Infra

The full story is in the [top-level README](../README.md#deploy-to-azure).
Quick reference for what's in this directory:

| File | Role |
| --- | --- |
| `main.bicep` | Standard-env (Sweden Central): managed env, server, STT (GPU), TTS (GPU), UAMI, sandbox group. |
| `express.bicep` | Express-env (West Central US): one container app per agent, fed the per-sandbox `adcproxy.io` URL. |
| `acr-role.bicep` | Grants AcrPull to the UAMI on the existing `simon` ACR (cross-RG). Used by `main.bicep` only. |
| `sandbox-bootstrap.sh` | Idempotent: lays down `/opt/sandbox_wrapper.py`, systemd unit, and the GH-token env file inside a sandbox. Run by `deploy.ps1` when no snapshot is provided. |
| `deploy.ps1` | One-shot orchestrator. RGs → ACR builds → main → sandboxes (snapshot or bootstrap) → express → agent registration. |

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
