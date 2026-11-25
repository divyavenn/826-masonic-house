#!/usr/bin/env python3
"""Small standard-library client for hosts and agents. Credentials come from env."""
import argparse, json, os, sys, urllib.request, urllib.error
parser = argparse.ArgumentParser(description=__doc__)
commands = parser.add_subparsers(dest='command', required=True)
listing = commands.add_parser('list')
for option in ['status', 'room', 'q']:
    listing.add_argument('--' + option)
listing.add_argument('--limit', type=int, default=50)
listing.add_argument('--offset', type=int, default=0)
get = commands.add_parser('get'); get.add_argument('id')
update = commands.add_parser('update'); update.add_argument('id')
update.add_argument('--status'); update.add_argument('--note'); update.add_argument('--metadata', type=json.loads)
note = commands.add_parser('note'); note.add_argument('id'); note.add_argument('text')
args = parser.parse_args()
origin = os.environ.get('HOUSE_URL', '').rstrip('/')
if not origin.startswith(('https://', 'http://localhost:', 'http://127.0.0.1:')):
    parser.error('Set HOUSE_URL to your HTTPS origin (or local test server).')
def request(path, method='GET', data=None):
    key = os.environ.get('ADMIN_PASSWORD')
    if not key: parser.error('Set ADMIN_PASSWORD.')
    headers = {'Authorization': 'Bearer ' + key, 'X-Agent-Name': os.environ.get('HOUSE_AGENT_NAME', 'api-client')}
    if data is not None: headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(origin + path, data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response: return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode()
        sys.exit(f'HTTP {error.code}: {detail}')
from urllib.parse import urlencode, quote
if args.command == 'list':
    result = request('/api/applications?' + urlencode({key: value for key, value in vars(args).items() if key != 'command' and value is not None}))
else:
    path = '/api/applications/' + quote(args.id, safe='')
    if args.command == 'get': result = request(path)
    elif args.command == 'note': result = request(path + '/notes', 'POST', {'text': args.text})
    else:
        data = {key: getattr(args, key) for key in ['status', 'note', 'metadata'] if getattr(args, key) is not None}
        if not data: parser.error('update needs --status, --note, or --metadata.')
        result = request(path, 'PATCH', data)
print(json.dumps(result, indent=2))
