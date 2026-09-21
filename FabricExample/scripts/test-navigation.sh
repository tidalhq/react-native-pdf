#!/usr/bin/env bash
set -euo pipefail

# Requires the freshly built example to be open in an agent-device session.
# Usage: npm run test:e2e -- pdf-ios-qa
session=${1:?Pass an active agent-device session name}
artifacts=${2:-/tmp/pdf-navigation-${session}}
mkdir -p "$artifacts"

press() {
  agent-device press "role=button label=\"$1\"" --settle --session "$session"
}
page() {
  agent-device wait "id=\"Status\" text=\"Scenario: $1 | page: $2/21 | prop: $3\"" 15000 --session "$session"
  agent-device wait 'id="Error" text="Error: none"' 15000 --session "$session"
}

press overlay
page overlay 1 1
press 'Page 2'
page overlay 2 1
agent-device screenshot "$artifacts/overlay-page2.png" --session "$session"
press 'Page 3'
page overlay 3 1
press 'Controlled 2'
page overlay 2 2

press on-load
page on-load 2 1
press hidden
agent-device wait 'id="Request" text="Request: setPage(3)"' 15000 --session "$session"
press Show
page hidden 3 1
agent-device screenshot "$artifacts/hidden-page3.png" --session "$session"

press wrapper
page wrapper 1 1
press 'Page 2'
page wrapper 2 1
press legacy
page legacy 1 1
press 'Page 2'
page legacy 2 1
press native
page native 1 1
press 'Page 2'
page native 2 1
agent-device screenshot "$artifacts/native-page2.png" --session "$session"

press single
page single 1 1
press 'Page 3'
page single 1 1

press overlay
page overlay 1 1
press Direction
press 'Page 2'
page overlay 2 1
agent-device screenshot "$artifacts/horizontal-page2.png" --session "$session"
press Unmount
press Mount
page overlay 1 1

echo "Navigation checks passed for $session. Screenshots: $artifacts"
