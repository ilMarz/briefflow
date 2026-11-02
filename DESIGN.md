---
name: BriefFlow
description: Un dossier operativo per decisioni osservabili.
colors:
  ground: "#eaf0f2"
  surface: "#ffffff"
  raised: "#f5f8f9"
  text: "#172a33"
  muted: "#52656e"
  accent: "#1b6c80"
  primary: "#172f3b"
  positive: "#216a50"
  negative: "#a92e36"
  warning: "#80530d"
typography:
  title:
    fontFamily: "IBM Plex Sans"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "IBM Plex Sans"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  data:
    fontFamily: "IBM Plex Mono"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.8
rounded:
  sheet: "16px"
  node: "8px"
  control: "6px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "34px"
---
## Overview
Dark framed sheet, applied to the working dossier of a consulting request. Familiar operating controls surround a dominant event-driven graph. Precision and observable transitions are the identity.
## Colors
Dark theme (the palette values above are the original light tokens; live tokens are in `globals.css`: ground #0a0f13, surface #10181d, raised #161f25, text #e8eff2, accent #52b8d1, positive #5fcf9a, warning #e8b45a, negative #ff8087). Bright teal on traversed routes and selection. Green means operational completion; amber marks human attention; red is exclusively technical failure. Out-of-scope business results stay neutral.
## Typography
IBM Plex Sans is loaded from Google Fonts. IBM Plex Mono is restricted to event sequence, JSON and identifiers. Tabular numerals on changing measurements. A 10/12/14/16/22 scale keeps the graph larger than chrome.
## Layout
Desktop received-requests column 360px + flexible graph, within an 8px outer frame; there is no details column. The timeline shares the sheet width. At 950px and below, the requests list and the graph become dedicated tabs. Presentation mode increases content emphasis while preserving controls.
## Elevation & Depth
Flat tonal layers and one-pixel edges; no resting shadows. Only the floating node detail carries a shadow. Graph nodes sit on a slightly lighter dark well.
## Shapes
Sheet 16px, controls 6px. Graph nodes are 120px circles with the label inside; connectors are curved arrows leaving and entering the circle on the side facing the next node. A faint dot field sits behind the graph. The company profile opens in a modal dialog from the header; executed runs are listed in the left column.
## Components
The same shared node IDs and topology power the graph and backend. Nodes show type, semantic status, visits and actual duration. A compact event strip at the top lists recent events. Clicking a node opens a detail card that grows out of the node (scale and radius from the circle, then staggered content) and sits beside it; on narrow screens it is a bottom sheet. New request, human questions and the final card are modal dialogs; the received-requests list (what happened, output, mail actions) lives in the left column.
## Do's and Don'ts
Derive all operational state from the visible events. Keep live control access explicit. Preserve visible keyboard focus and reduced motion. Avoid gradients, glows, invented metrics or code-like decoration outside actual data.
