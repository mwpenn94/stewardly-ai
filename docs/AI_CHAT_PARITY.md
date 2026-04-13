# AI Chat Parity Matrix (Scope #1)

> Tracks scope #1. Reference benchmark = **Claude (claude.ai)**. Stewardly aims for `match`/`superior` vs Claude on every must-have row, AND `superior` vs *any* competitor on differentiating rows. Cell schema: `absent | partial | match | superior | n/a` + `commit-SHA · evidence-path`. `[M]` must-have, `[N]` nice-to-have. Competitor-column re-verification cadence: on competitor major release or every 20 passes minimum.

### A. Core conversation
| Capability | Tier | Stewardly | Claude | ChatGPT | Gemini | Perplexity | Grok | Copilot | Le Chat |
|---|---|---|---|---|---|---|---|---|---|
| Streaming responses with stop control | M | absent | match | match | match | match | match | match | match |
| Multi-turn context with visible context-window indicator | M | absent | partial | partial | partial | n/a | partial | partial | partial |
| Model selection in-conversation | M | absent | match | match | match | n/a | match | match | match |
| Message edit + regenerate | M | absent | match | match | match | partial | partial | match | match |
| Stop generation mid-stream | M | absent | match | match | match | match | match | match | match |
| Conversation branching / fork from any turn | N | absent | absent | match | absent | absent | absent | absent | absent |
| Suggested follow-up prompts | N | absent | absent | match | match | match | partial | match | partial |
| Response cost / token visibility | N | absent | absent | n/a | absent | absent | absent | absent | absent |
| Multi-response comparison (A/B) | N | absent | absent | absent | absent | absent | absent | absent | absent |

### B. Multimodal I/O
| Capability | Tier | Stewardly | Claude | ChatGPT | Gemini | Perplexity | Grok | Copilot | Le Chat |
|---|---|---|---|---|---|---|---|---|---|
| Image upload + understanding | M | absent | match | match | match | match | match | match | partial |
| PDF upload + understanding | M | absent | match | match | match | match | partial | match | partial |
| DOCX upload + understanding | M | absent | match | match | match | partial | partial | match | partial |
| CSV / XLSX upload + understanding | M | absent | match | match | match | partial | partial | match | partial |
| Audio upload + transcription | N | absent | partial | match | match | absent | absent | match | absent |
| Video upload + understanding | N | absent | absent | partial | match | absent | absent | absent | absent |
| Voice input (live mic) | N | absent | partial | match | match | match | match | match | absent |
| Voice output (TTS) | N | absent | absent | match | match | match | match | match | absent |
| Live voice conversation mode | N | absent | absent | match | match | partial | partial | partial | absent |
| Image generation in chat | N | absent | absent | match | match | partial | match | match | partial |

### C. Knowledge & search
| Capability | Tier | Stewardly | Claude | ChatGPT | Gemini | Perplexity | Grok | Copilot | Le Chat |
|---|---|---|---|---|---|---|---|---|---|
| Web search with inline citations | M | absent | match | match | match | superior | match | match | partial |
| Source-link previews | M | absent | match | match | match | superior | partial | match | absent |
| Domain restriction | N | absent | partial | absent | absent | match | absent | partial | absent |
| Deep research / multi-step | N | absent | match | match | match | match | match | partial | absent |
| Date-bounded search | N | absent | partial | match | match | match | partial | partial | absent |

### D. Code & execution
| Capability | Tier | Stewardly | Claude | ChatGPT | Gemini | Perplexity | Grok | Copilot | Le Chat |
|---|---|---|---|---|---|---|---|---|---|
| Code blocks: syntax highlight + copy + lang detect | M | absent | match | match | match | match | match | match | match |
| Sandboxed code execution (Python) | M | absent | match | match | match | absent | absent | match | partial |
| File creation (download from chat) | M | absent | match | match | match | absent | absent | match | absent |
| Math rendering (LaTeX) | M | absent | match | match | match | match | partial | match | match |
| Mermaid / diagram rendering | N | absent | match | partial | partial | absent | absent | partial | absent |
| Sortable / filterable table rendering | N | absent | partial | partial | partial | partial | absent | partial | absent |
| Artifact / canvas (interactive output) | N | absent | match | match | match | absent | absent | absent | absent |

### E. Memory & organization
| Capability | Tier | Stewardly | Claude | ChatGPT | Gemini | Perplexity | Grok | Copilot | Le Chat |
|---|---|---|---|---|---|---|---|---|---|
| Custom instructions / system prompt | M | absent | match | match | match | partial | partial | match | match |
| Personas / saved system prompts (multiple) | N | absent | match (Projects) | match (GPTs) | match (Gems) | match (Spaces) | absent | absent | absent |
| Memory across conversations (auto) | N | absent | match | match | match | absent | partial | match | absent |
| User can view + edit auto-memory | N | absent | match | match | match | n/a | partial | partial | n/a |
| Project / workspace organization | M | absent | match | match | partial | match | absent | partial | absent |
| Search across past conversations | M | absent | match | match | match | partial | partial | match | partial |
| Folder / tag organization | N | absent | match | match | absent | match | absent | absent | absent |

### F. Sharing & export
| Capability | Tier | Stewardly | Claude | ChatGPT | Gemini | Perplexity | Grok | Copilot | Le Chat |
|---|---|---|---|---|---|---|---|---|---|
| Share via public link | M | absent | match | match | match | match | partial | match | absent |
| Share with specific collaborators | N | absent | match | match | partial | match | absent | match | absent |
| Export to markdown | M | absent | partial | partial | partial | partial | absent | partial | absent |
| Export to PDF | N | absent | absent | absent | absent | absent | absent | absent | absent |
| Continue someone else's shared chat | N | absent | match | match | partial | match | absent | partial | absent |

### G. Extension & connector ecosystem
| Capability | Tier | Stewardly | Claude | ChatGPT | Gemini | Perplexity | Grok | Copilot | Le Chat |
|---|---|---|---|---|---|---|---|---|---|
| MCP server support | M | absent | match | partial | absent | absent | absent | partial | absent |
| Native connectors (Drive/Gmail/Calendar/etc) | M | absent | match | match | superior | partial | absent | superior | absent |
| Custom tool / function-calling visible to user | M | absent | match | match | match | partial | partial | match | partial |
| Plugin / extension marketplace | N | absent | absent | match | match | absent | absent | partial | absent |

### H. Mobile, accessibility, performance
| Capability | Tier | Stewardly | Claude | ChatGPT | Gemini | Perplexity | Grok | Copilot | Le Chat |
|---|---|---|---|---|---|---|---|---|---|
| Mobile/web feature parity | M | absent | match | match | match | match | match | match | partial |
| Mobile keyboard does not obscure input (390x844) | M | absent | match | match | match | match | match | match | match |
| Slow-3G graceful degradation | M | absent | partial | partial | partial | partial | partial | partial | partial |
| Copy/regenerate/edit-last visible without scroll on 390px | M | absent | match | match | match | match | match | match | match |
| Keyboard shortcuts | N | absent | match | match | match | partial | partial | match | partial |
| WCAG 2.2 AA on conversation surface | M | absent | partial | partial | partial | partial | partial | partial | partial |
| Native mobile apps (iOS + Android) | N | absent | match | match | match | match | match | match | absent |
| PWA / offline shell | N | absent | absent | partial | absent | absent | absent | absent | absent |

### I. Stewardly-differentiating (financial advisory practice)
No competitor benchmark — Stewardly should be `superior` by domain construction. Status: `absent | partial | superior`.

| Capability | Tier | Stewardly | Notes |
|---|---|---|---|
| Chat aware of advisor's book of business (clients, products, pipeline) | M | absent | scope #7 ingestion + #1 chat integration |
| Chat can call any calculator from scope #4 inline and embed result | M | absent | scope #4 + #1 integration |
| Chat citations include compliance/source references | M | absent | due-diligence trail per skeptical-CFO persona |
| Chat respects role/channel hierarchy | M | absent | scope #8 cohesion + #1 |
| Chat can hand off conversation to client (read-only, possibly unauthenticated) | M | absent | persona 6 (client on shared link) |

---

## Row-Update-Log
<!-- Append-only log of cell status changes -->

## Row-Current-State
<!-- Cache of current row states; rebuilt on demand -->
