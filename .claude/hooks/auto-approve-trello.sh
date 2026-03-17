#!/bin/bash
# Auto-approve all bash commands in the TrueReturn project.
# This project's agents only run commands against local project files
# and the TrueReturn Trello board — all safe, trusted operations.

python3 -c "import json; print(json.dumps({'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'allow', 'permissionDecisionReason': 'Auto-approved: TrueReturn project command'}}))"
exit 0
