"""Generate updated VoiceConnect architecture diagram."""
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

fig, ax = plt.subplots(figsize=(18, 10), dpi=150)
ax.set_xlim(0, 18)
ax.set_ylim(0, 10)
ax.axis('off')
fig.patch.set_facecolor('#0b0b0f')
ax.set_facecolor('#0b0b0f')

PURPLE = '#7B68EE'
PURPLE_FILL = '#2a2545'
GREEN = '#6cba6c'
ORANGE = '#e07a3c'
WHITE = '#f0f0f0'
GREY = '#7a7a85'
DASH_GREY = '#555560'

def box(x, y, w, h, label, sublabel=None, color=PURPLE, fill=PURPLE_FILL):
    p = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.04",
                       linewidth=1.6, edgecolor=color, facecolor=fill)
    ax.add_patch(p)
    ax.text(x + w/2, y + h/2 + (0.12 if sublabel else 0), label,
            ha='center', va='center', color=WHITE, fontsize=10, weight='bold')
    if sublabel:
        ax.text(x + w/2, y + h/2 - 0.18, sublabel,
                ha='center', va='center', color=GREY, fontsize=8)

def env_box(x, y, w, h, label):
    p = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05",
                       linewidth=1.2, edgecolor=DASH_GREY, facecolor='none',
                       linestyle='--')
    ax.add_patch(p)
    ax.text(x + 0.15, y + h - 0.25, label, ha='left', va='top',
            color=GREY, fontsize=9, style='italic')

def arrow(x1, y1, x2, y2, label=None, color=WHITE, style='-', lw=1.4, label_offset=(0,0.18)):
    a = FancyArrowPatch((x1, y1), (x2, y2),
                        arrowstyle='-|>', mutation_scale=14,
                        color=color, linewidth=lw, linestyle=style)
    ax.add_patch(a)
    if label:
        ax.text((x1+x2)/2 + label_offset[0], (y1+y2)/2 + label_offset[1],
                label, ha='center', va='center', color=GREY, fontsize=8)

# Title
ax.text(0.3, 9.55, 'VoiceConnect — Architecture',
        color=WHITE, fontsize=20, weight='bold')
ax.text(0.3, 9.18, 'Voice + chat multi-agent system on Azure Container Apps',
        color=GREY, fontsize=10, style='italic')

# Clients (left column)
box(0.3, 7.4, 1.6, 0.9, '🌐 Browser', 'Web UI / chat')
box(0.3, 5.6, 1.6, 0.9, '📞 Phone caller')
box(0.3, 4.3, 1.6, 0.9, 'Twilio Cloud', 'ConversationRelay')
arrow(1.1, 5.6, 1.1, 5.2, color=GREY)

# Container Apps Environment (Sweden) — top
env_box(2.6, 4.0, 14.9, 5.0, 'Container Apps Environment  ·  swedencentral')

# Multi Agent server
box(3.2, 6.3, 2.4, 1.2, 'Multi Agent\nServer', 'orbconnect-server', color=PURPLE)

# Whisper / Kokoro
box(7.0, 7.5, 1.8, 0.9, 'Whisper (STT)', 'Python · GPU')
box(9.4, 7.5, 1.8, 0.9, 'Kokoro (TTS)', 'Python · GPU')

# SRE container in Sweden CAE (standard env, alongside server/STT/TTS)
box(13.0, 5.8, 1.8, 0.9, 'SRE Agent', 'Node adapter', color=PURPLE)

# External Azure SRE Agent (right side, outside any env)
box(15.3, 5.7, 2.0, 1.0, '✦ Azure SRE Agent', 'Microsoft.App/agents', color=ORANGE, fill='#3a2818')

# Express env (lower)
env_box(2.6, 0.5, 14.9, 3.2, 'Express (opinionated defaults) Environment')

# Twilio Bridge
box(3.2, 1.7, 2.0, 1.0, 'Twilio Bridge', 'WS · audio fan-out', color=PURPLE)

# Aria / Nova
box(6.0, 2.3, 1.7, 0.9, 'Agent Aria', color=PURPLE)
box(6.0, 1.0, 1.7, 0.9, 'Agent Nova', color=PURPLE)

# Sandbox group
box(9.0, 1.5, 2.4, 1.7, 'Sandbox Group', color=PURPLE)
box(9.2, 2.2, 2.0, 0.6, 'Sandbox: Aria — Copilot CLI', color=GREY, fill='#1a1a22')
box(9.2, 1.6, 2.0, 0.6, 'Sandbox: Nova — Copilot CLI', color=GREY, fill='#1a1a22')

# App Insights strip (bottom)
box(2.6, -0.2, 14.9, 0.5, '📊 Application Insights  ·  orbconnect-law',
    color=GREEN, fill='#1a2a1a')

# === Arrows ===
# Browser -> server
arrow(1.9, 7.85, 3.2, 6.95, 'HTTPS / WS')
# Twilio cloud -> bridge
arrow(1.9, 4.75, 3.2, 2.3, 'media stream', label_offset=(0.4, 0.1))
# Bridge -> server
arrow(5.2, 2.55, 3.7, 6.3, 'turn API + WS', label_offset=(-0.7, 0))
# Server -> Whisper / Kokoro
arrow(5.6, 7.0, 7.0, 7.85, 'STT')
arrow(5.6, 6.95, 9.4, 7.85, 'TTS')
# Server -> Aria / Nova (in Express env)
arrow(4.4, 6.3, 6.0, 2.75, color=ORANGE, label='agent call', label_offset=(0.6, 0.4))
arrow(4.4, 6.3, 6.0, 1.45, color=ORANGE)
# Server -> SRE adapter (same env, Sweden)
arrow(5.6, 6.7, 13.0, 6.25, color=ORANGE)
# Aria/Nova -> Sandbox
arrow(7.7, 2.75, 9.2, 2.5, color=GREY, style='--')
arrow(7.7, 1.45, 9.2, 1.9, color=GREY, style='--')
# SRE -> Azure SRE Agent (out to managed agent)
arrow(14.8, 6.25, 15.3, 6.2, 'SignalR data plane', style='--')

# Telemetry hint (very subtle)
ax.text(9.0, 0.4, 'all containers → telemetry', ha='center', va='center',
        color=GREEN, fontsize=8, style='italic')

# Legend (compact, bottom-right)
ax.text(14.5, 9.6, 'agent traffic', color=ORANGE, fontsize=8)
ax.text(14.5, 9.4, 'platform / data', color=WHITE, fontsize=8)
ax.text(14.5, 9.2, 'observability', color=GREEN, fontsize=8)

plt.savefig('docs/architecture_v2.png', dpi=150,
            facecolor=fig.get_facecolor(), bbox_inches='tight')
print("Saved docs/architecture_v2.png")
