# Arkitype — Orbit

How Orbit is constituted, in layers, specified rather than summarized. The test these files have to
pass: hand `00`–`04` to a build agent with no access to this repository and it can rebuild Orbit —
same schema, same commands, same behaviour.

Layers are numbered in build order, infrastructure outward:

| File | Layer |
| --- | --- |
| [00-arkitype.md](00-arkitype.md) | Identity and profile — everything specific to *this* product |
| [01-infrastructure.md](01-infrastructure.md) | Runtime, shell, packaging, CI, release |
| [02-database.md](02-database.md) | Storage schema, current and intended |
| [03-software.md](03-software.md) | Commands, service, scanners, merge rules, toggles |
| [04-interface.md](04-interface.md) | Window, views, sizing, the extension popup |
| [agent.local.md](agent.local.md) | What was verified, what was not, and by whom |

Two rules carried over from the method, because they are what keep this set useful:

1. **`01`–`04` hold nothing product-specific.** Names, colours, ports, provider lists and toggles
   live in the `SITE PROFILE` in `00`, and the layer files consume them by reference. The test: could
   `01`–`04` be reused verbatim for a sibling companion app by swapping only `00`?
2. **Surface assumptions, don't resolve them silently.** Anything undecided appears under an
   `open_decisions` key in the layer it belongs to, not as an invented answer.

`agent.local.md` is exempt from rule 1 — it is a record of this environment and this agent.
