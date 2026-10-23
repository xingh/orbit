---
issue: 17
title: The robot as a declarative genome
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/17
arkitype: [04]
prerequisites: []
---

# Robot genome

## What

The robot becomes a humanoid assembled from a declarative configuration — a DNA-like JSON of
colour, shape and feature, with parts that react to specific values — rather than the fixed
procedural geometry it is now. It should be able to iterate and mutate between forms.

## Where it stands

`Robot.tsx` is procedural Three.js geometry, written as a prototype stand-in. As of 2026-10-23 it
is lazy-loaded behind a toggle, in its own chunk, with a single `active` prop. That is the seam a
genome-driven renderer plugs into.

## The one constraint worth defending

**Keep the prop surface thin.** If the rest of the app starts reaching into the robot — reading its
internals, driving its parts directly — the swap gets expensive and the mutation story dies. One
input (a genome), one state flag.

## Open questions

```yaml
- what does a feature "react to"? a value from the workspace (how many chats, which provider was
  used last), or a value in the genome itself?
- is a genome authored, generated, or inherited/mutated from another?
- does a genome travel with a shared workspace, so a team sees each other's robots?
- geometry budget: the current robot is a constant GPU draw. A genome must not be able to specify
  something that melts a laptop, and on mobile it should default off entirely.
```

## Done when

A genome file renders a robot, two genomes render visibly different robots, and nothing outside the
component knows how either was built.
