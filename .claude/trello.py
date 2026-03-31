#!/usr/bin/env python3
"""
Trello helper for TrueReturn pipeline.
Reads credentials from environment (TRELLO_API_KEY, TRELLO_TOKEN).

Usage:
  python3 .claude/trello.py list_cards
  python3 .claude/trello.py list_lists
  python3 .claude/trello.py get_comments <card_id>
  python3 .claude/trello.py move_card <card_id> <list_id>
  python3 .claude/trello.py post_comment <card_id> <text>
  python3 .claude/trello.py create_card <list_id> <name> [desc]
"""

import os, sys, json
from urllib.request import urlopen, Request
from urllib.parse import urlencode

BOARD_ID = '69b7e3713cffb258db3af275'

def creds():
    return os.environ['TRELLO_API_KEY'], os.environ['TRELLO_TOKEN']

def auth_params(extra=None):
    key, token = creds()
    p = {'key': key, 'token': token}
    if extra:
        p.update(extra)
    return urlencode(p)

def get(path, extra=None):
    url = f'https://api.trello.com/1{path}?{auth_params(extra)}'
    with urlopen(url) as r:
        return json.loads(r.read())

def post(path, body):
    url = f'https://api.trello.com/1{path}?{auth_params()}'
    data = json.dumps(body).encode()
    req = Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    with urlopen(req) as r:
        return json.loads(r.read())

def put(path, body):
    url = f'https://api.trello.com/1{path}?{auth_params()}'
    data = json.dumps(body).encode()
    req = Request(url, data=data, headers={'Content-Type': 'application/json'}, method='PUT')
    with urlopen(req) as r:
        return json.loads(r.read())

def cmd_list_cards():
    cards = get(f'/boards/{BOARD_ID}/cards', {'filter': 'open'})
    for c in cards:
        print(f"{c['id']} | {c['idList']} | {c['name']}")

def cmd_list_lists():
    lists = get(f'/boards/{BOARD_ID}/lists')
    for l in lists:
        print(f"{l['id']} | {l['name']}")

def cmd_get_comments(card_id):
    actions = get(f'/cards/{card_id}/actions', {'filter': 'commentCard'})
    for a in actions:
        print(f"{a['date']} | {a['memberCreator']['fullName']} | {a['data']['text']}")

def cmd_move_card(card_id, list_id):
    result = put(f'/cards/{card_id}', {'idList': list_id})
    if result.get('idList') == list_id:
        print(f"Moved card {card_id} to list {list_id}")
    else:
        print(f"Move failed: {result.get('idList', result.get('message'))}", file=sys.stderr)
        sys.exit(1)

def cmd_post_comment(card_id, text):
    result = post(f'/cards/{card_id}/actions/comments', {'text': text})
    if result.get('type') == 'commentCard':
        print(f"Comment posted to {card_id}")
    else:
        print(f"Comment failed: {result}", file=sys.stderr)
        sys.exit(1)

def cmd_create_card(list_id, name, desc=''):
    result = post('/cards', {'idList': list_id, 'name': name, 'desc': desc})
    print(f"{result['id']} | {result['shortUrl']}")

if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    cmd = args[0]
    try:
        if cmd == 'list_cards':
            cmd_list_cards()
        elif cmd == 'list_lists':
            cmd_list_lists()
        elif cmd == 'get_comments' and len(args) == 2:
            cmd_get_comments(args[1])
        elif cmd == 'move_card' and len(args) == 3:
            cmd_move_card(args[1], args[2])
        elif cmd == 'post_comment' and len(args) >= 3:
            cmd_post_comment(args[1], ' '.join(args[2:]))
        elif cmd == 'create_card' and len(args) >= 3:
            cmd_create_card(args[1], args[2], args[3] if len(args) > 3 else '')
        else:
            print(f"Unknown command or wrong args: {args}", file=sys.stderr)
            print(__doc__)
            sys.exit(1)
    except KeyError as e:
        print(f"Missing environment variable: {e}", file=sys.stderr)
        sys.exit(1)
