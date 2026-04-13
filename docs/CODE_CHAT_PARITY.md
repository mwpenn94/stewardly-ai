# Code Chat Parity Matrix (Scope #2)

> Tracks scope #2. Reference benchmark = **Claude Code**. Stewardly's code chat is not aiming to replace a general-purpose IDE — it's aiming to be the best in-app advisor-facing code surface for customizing calculators, templates, and integrations within a regulated context. That scope determines which competitor rows are realistically `n/a`.

### A. Context awareness
| Capability | Tier | Stewardly | Claude Code | Cursor | Copilot | Cody | Windsurf | Aider | Continue | Replit Agent | Devin | v0/Bolt |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Repo-aware context (file-level) | M | absent | match | match | match | match | match | match | match | match | match | partial |
| Repo-aware context (semantic / cross-file) | M | absent | match | match | partial | superior | match | partial | partial | match | match | absent |
| Visible scope indicator | M | absent | match | match | partial | match | match | match | partial | partial | partial | absent |
| Manual file/folder pinning | N | absent | match | match | match | match | match | match | match | partial | absent | absent |
| Codebase semantic search from chat | N | absent | match | match | partial | superior | match | partial | partial | match | match | absent |
| Symbol navigation from chat | N | absent | partial | match | match | match | match | partial | match | partial | absent | absent |
| Project memory file (CLAUDE.md / .cursorrules) | M | absent | match | match | partial | partial | match | match | match | absent | partial | absent |

### B. Editing & change management
| Capability | Tier | Stewardly | Claude Code | Cursor | Copilot | Cody | Windsurf | Aider | Continue | Replit Agent | Devin | v0/Bolt |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Multi-file edits in one turn | M | absent | match | match | match | match | match | match | match | match | match | match |
| Diff preview before apply | M | absent | match | match | match | match | match | match | match | partial | partial | match |
| Cherry-pick which hunks to apply | N | absent | match | match | partial | partial | match | partial | partial | absent | absent | absent |
| Undo last shipped change | M | absent | match | match | partial | partial | match | match (git) | partial | match | match | match |
| Refactor across files | N | absent | match | match | partial | match | match | match | partial | partial | match | absent |
| Test generation | N | absent | match | match | match | match | match | match | match | partial | match | absent |
| Documentation generation | N | absent | match | match | match | match | match | match | match | partial | partial | absent |
| PR review / explain mode | N | absent | match | partial | superior | match | partial | absent | partial | absent | match | absent |

### C. Execution environment
| Capability | Tier | Stewardly | Claude Code | Cursor | Copilot | Cody | Windsurf | Aider | Continue | Replit Agent | Devin | v0/Bolt |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Terminal / shell access | M | absent | match | match | partial | partial | match | partial | partial | match | match | partial |
| Command transparency | M | absent | match | match | match | match | match | match | match | match | match | match |
| Test runner integration | M | absent | match | match | partial | partial | match | match | partial | match | match | partial |
| Lint / type-check awareness | M | absent | match | match | match | match | match | match | match | partial | match | partial |
| Browser tool / live web preview | N | absent | partial | partial | partial | absent | partial | absent | absent | match | match | match |
| Database operations from chat | N | absent | partial | partial | partial | absent | partial | absent | absent | match | partial | partial |
| Hot-reload / live preview | N | absent | partial | partial | partial | absent | partial | absent | absent | match | partial | match |

### D. Agent loop & planning
| Capability | Tier | Stewardly | Claude Code | Cursor | Copilot | Cody | Windsurf | Aider | Continue | Replit Agent | Devin | v0/Bolt |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Continuous agentic loop | M | absent | match | match | match | partial | match | match | partial | match | superior | partial |
| Plan-then-execute mode | M | absent | match | match | match | partial | match | partial | partial | match | match | partial |
| Multi-step decomposition with progress visibility | M | absent | match | match | match | partial | match | partial | partial | match | superior | partial |
| Background / async execution | N | absent | partial | partial | match | absent | partial | absent | absent | partial | match | partial |
| Sub-agent spawning | N | absent | match | partial | partial | absent | partial | absent | absent | absent | match | absent |
| Per-task cost tracking | N | absent | match | partial | partial | absent | partial | match | partial | absent | partial | absent |
| Stop / interrupt mid-execution | M | absent | match | match | match | match | match | match | match | match | partial | match |

### E. Surface integrations
| Capability | Tier | Stewardly | Claude Code | Cursor | Copilot | Cody | Windsurf | Aider | Continue | Replit Agent | Devin | v0/Bolt |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Web (in-browser) surface | M | absent | partial | absent | match | match | absent | absent | absent | match | match | match |
| VSCode extension | N | absent | match | n/a | match | match | n/a | absent | match | absent | partial | absent |
| JetBrains plugin | N | absent | match | partial | match | match | partial | absent | match | absent | absent | absent |
| Terminal / CLI surface | M | absent | superior | partial | match | partial | partial | superior | partial | partial | partial | absent |
| Mobile app or mobile-web | N | absent | absent | absent | partial | absent | absent | absent | absent | match | partial | match |
| Slack / chat-tool surface | N | absent | match | absent | absent | absent | absent | absent | absent | absent | match | absent |

### F. Customization & extension
| Capability | Tier | Stewardly | Claude Code | Cursor | Copilot | Cody | Windsurf | Aider | Continue | Replit Agent | Devin | v0/Bolt |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Custom slash commands | M | absent | match | match | match | partial | match | partial | match | partial | partial | absent |
| MCP server support | M | absent | match | partial | partial | absent | partial | absent | match | absent | partial | absent |
| Custom system prompt / persona | M | absent | match | match | match | match | match | match | match | partial | partial | absent |
| Pluggable model (BYO API key) | N | absent | partial | match | partial | match | match | match | superior | partial | absent | absent |
| Custom tools / functions | N | absent | match | match | match | match | match | match | match | partial | match | absent |

### G. Code rendering & UX
| Capability | Tier | Stewardly | Claude Code | Cursor | Copilot | Cody | Windsurf | Aider | Continue | Replit Agent | Devin | v0/Bolt |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Syntax highlight >=10 languages | M | absent | match | match | match | match | match | match | match | match | match | match |
| Copy button on code blocks | M | absent | match | match | match | match | match | match | match | match | match | match |
| Multi-file diff rendering | M | absent | match | match | match | match | match | match | match | match | match | match |
| Mobile code blocks scrollable, layout intact (390x844) | M | absent | n/a | n/a | partial | n/a | n/a | n/a | n/a | match | partial | match |
| Image input (screenshot/design -> code) | N | absent | match | match | match | partial | match | partial | partial | match | match | superior |
| Code explanation depth | N | absent | match | match | match | match | match | partial | partial | partial | match | partial |

### H. Collaboration & deploy
| Capability | Tier | Stewardly | Claude Code | Cursor | Copilot | Cody | Windsurf | Aider | Continue | Replit Agent | Devin | v0/Bolt |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Git ops from chat (commit/branch/PR) | M | absent | match | match | match | partial | match | superior | partial | match | match | partial |
| Auto-create PR with description | N | absent | match | partial | match | partial | partial | partial | absent | partial | match | absent |
| Deploy from chat | N | absent | partial | absent | absent | absent | partial | absent | absent | superior | partial | match |
| Share running session / pair-program | N | absent | absent | absent | absent | absent | absent | absent | absent | match | absent | absent |

### I. Stewardly-differentiating (in-app advisor code chat)
| Capability | Tier | Stewardly | Notes |
|---|---|---|---|
| Code chat scoped to advisor's calculator/template customizations | M | absent | most users not engineers; scope reduces footgun |
| Code chat can edit any calculator from scope #4 with safety guardrails | M | absent | scope #4 + #2 integration |
| Changes auto-version with rollback to prior advisor-tested state | M | absent | risk management for non-engineer authors |
| Suggestions cite compliance constraints | M | absent | scope #7 + #2 |
| Mobile parity for read-only code review | N | absent | persona 4; most coding agents fail this |
| Plain-English explanation mode for non-engineer advisors | M | absent | bridges scope #1 and #2 |

---

## Row-Update-Log

## Row-Current-State
