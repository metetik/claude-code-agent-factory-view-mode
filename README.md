# Factory View

A Claude Code mod that turns orchestration into a little pixel-art office. Claude, the
main agent, is the manager at the gilded desk in the middle of the floor; every subagent
it starts gets a desk of its own around it. Agents at work type away while their monitor
scrolls and a thought bubble shows the kind of tool they run; agents with nothing to do
look around, doze off with a stream of Zzz, or put their feet up with a green check once
their task is done.

Every agent is the Claude Code mascot, and each one can be dressed up: 14 body colors,
18 hats (crown, top hat, wizard hat, hard hat, propeller cap, headphones, viking helmet,
...) and 8 extras (glasses, shades, monocle, tie, bow tie, mustache, scarf, blush). Agents
nobody dressed get a look of their own by lot (or, if you prefer, a look for their type:
Explore agents in safari hats, general-purpose ones in hard hats, ...). The manager keeps
its crown and tie until you change them, and nobody else draws the crown by chance.

## What you see

| On the floor | Means |
| --- | --- |
| Arms typing, code scrolling on the monitor, a bubble with an icon | working: the icon is the tool (magnifier for reading and searching, pencil for edits, a terminal for Bash, a globe for the web, a little mascot for delegating, a checklist for todos, `...` for thinking) |
| Eyes looking around, a bubble of dots | waiting: the manager waits for you; a subagent waits to start or for a message |
| Eyes closed, Zzz rising, screensaver | sleeping: idle for a while |
| Happy eyes, arms up, a green check | done: the task came back |
| X eyes, a red `!`, a red screen | failed |

The manager dozes off 90 seconds after the last turn ends; a finished subagent cheers for
20 seconds and then naps at its desk, check mark and all. Desks fill nearest the manager
first; when 24 are taken, the agent that finished longest ago goes home to make room.

The terminal draws the floor in character cells, repainted four times a second, in one of
three sizes, each with pictures of its own: **large** in half blocks, two square pixels a
cell (agents 8 cells wide); **medium**, the default, and **small** in quarter blocks, 2x2
pixels a cell (agents 6 and 4 cells wide), the same mascot, hats and extras drawn in fewer
pixels, and the bubble showing the tool by its color. A 3x3 floor takes 66, 54 or 42
columns, the smaller two with more floor between the desks. Claude Code Desktop and the mobile app draw the floor as an animated SVG with room
between the desks, scaled by the same size; hover a desk there for what that agent is
doing. **Size** under the legend, or `/factory-view size`, switches between them.

## Using it

The pane opens by itself when a session starts. Under the floor is a legend, one line per
agent. Pick one to dress it up:

- **For**: this agent alone, or every agent of its type.
- **Color**, **Hat**, **Extra**: lists to choose from (buttons that step through them in the
  mobile app, which has no lists yet).
- **Random** draws a new look, **Reset** takes the choice back, **Transcript** opens that
  subagent's transcript.

Below the legend, **Undressed agents** switches between random looks and looks by type, and
**Size** steps through small, medium and large agents. Looks chosen for the manager and for types, and
both switches, are remembered across sessions; a look chosen for one agent lasts as long as
that agent.

| Command | Does |
| --- | --- |
| `/factory-view` | open or close the pane (closing it keeps it closed in later sessions) |
| `/factory-view style <who> color=<c> hat=<h> extra=<e>` | dress the manager (`main`), every agent of a type (`Explore`, `Plan`, ...), or one agent by its name tag |
| `/factory-view reset [who]` | back to the default looks |
| `/factory-view looks random\|type` | how agents nobody dressed look: each its own by lot, or dressed for their type |
| `/factory-view size small\|medium\|large` | how big the agents are drawn (medium by default) |
| `/factory-view clear` | send finished agents home |
| `/factory-view demo` | add (or remove) six pretend agents, to see a busy floor |
| `/factory-view options` | list the colors, hats and extras |

## How it works

`hooks/register.tsx` follows the session: `turn.start` and `turn.complete` for each loop
(the main one and every subagent's), `tool.call` for the tool each agent runs, and
`$.agent.list()` every two seconds to catch anything missed. What it learns lives in
`$.state`, so the pane redraws on every change and survives a reload.

| File | Holds |
| --- | --- |
| `hooks/register.tsx` | the hooks: events, the pane, the `/factory-view` command, the animation ticker |
| `hooks/model.ts` | agents, desks, status changes and styles, as plain functions |
| `hooks/scene.ts` | the floor plan and the pixel painter |
| `hooks/sprites.ts` | colors, hats, extras and icons, drawn as strings |
| `hooks/minis.ts` | the same hats, extras and icons for the large terminal desks |
| `hooks/tinies.ts` | the hats and extras for the medium and small desks, in quarter blocks |
| `hooks/paint.ts` | the picture as terminal cells (half or quarter blocks), and as an SVG with its frames |
| `types/index.d.ts` | the shape of the mod's state |
| `tests/factory.test.ts` | the floor plan, the agents, the session and the pane |

## Developing

```sh
claude plugin validate .
claude plugin test .
claude --plugin-dir .            # a session with the mod loaded from this folder
bun scripts/preview.ts out 8 5   # the floor with 8 agents as SVG and ANSI, outside a session
```

`tsc -p .` type-checks the mod once Claude Code has loaded it from this folder, which lays
the API's declarations in `.claude-plugin/types/`.
