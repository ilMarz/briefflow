# Visual review

ROUND 1
Seen in one second: central workflow graph between a request and its evidence.
Idea: the brief's consulting dossier unfolds as an observable execution path.
Live thing: event playback and node inspection.
Layout: request=form / graph=branching canvas / details=inspector / timeline=event strip.
Scores: design 7 · usability 7 · creativity 7 · content 8 → overall 7.1.
Caps applied: none from app-screen workflow; photography and landing-page display rules do not apply.

| Before | After | Why |
| --- | --- | --- |
| Vertical graph 785px tall, labels shrinking at fit | Compact 560px topology, 16px node titles | Improve recording legibility |
| Scaled desktop graph on phone | Readable dedicated node list with every outgoing branch and loop | Keep topology and states legible |
| 9–10px metadata and edge labels | 11px floor, no decorative INPUT/INSPECT labels | Inspector found tiny text |

ROUND 2
Seen in one second: central graph, now readable with replay controls in the first desktop viewport.
Scores: design 7.5 · usability 8 · creativity 7 · content 8 → overall 7.6.
Inspector: 0 FAIL, 2 WARN at 1440/768/390. IBM Plex Sans and Mono loaded as intended. Warnings: many secondary labels 11–12px; empty-state graph has no traversed data hue. Both are deliberate: substantive form/node text is larger; traversed teal appears only after an actual route event.
Evidence: .taste-skill/verified/{desktop,tablet,mobile}-fold.jpg and report.json. Desktop and mobile captures opened and inspected. Independent functional/E2E review is coordinator-owned.
Limits: recording should use desktop presentation mode; mobile is an accessible topology list, not a drag editor. Google Fonts is external; Next emits a custom-font lint warning with no errors.
