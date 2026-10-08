#!/usr/bin/env python3
"""Explicit, opt-in deployment to an EXISTING Bitrix24 VibeCode server.

No server creation, no implicit target choice, no automatic cost-incurring operations.
Requires a private environment key; never bundle credentials with the browser game.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://vibecode.bitrix24.tech/v1'


def api(path, key, token, body=None):
    headers = {'X-Api-Key': key, 'Accept': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if body is not None:
        headers['Content-Type'] = 'application/json'
    request = Request(BASE + path, headers=headers,
                      data=json.dumps(body).encode() if body is not None else None,
                      method='POST' if body is not None else 'GET')
    try:
        with urlopen(request, timeout=900) as response:
            result = json.load(response)
    except HTTPError as error:
        # Errors can contain useful hints; never print request headers.
        raise RuntimeError(f'API HTTP {error.code}: {error.read(4000).decode(errors="replace")}') from None
    except URLError as error:
        raise RuntimeError(f'API transport failed: {error.reason}') from None
    if not result.get('success'):
        raise RuntimeError('API rejected request: ' + json.dumps(result.get('error', {})))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', required=True, help='Existing server/application ID')
    parser.add_argument('--confirm-target', required=True,
                        help='Repeat the EXACT target ID to allow replacement')
    args = parser.parse_args()
    if args.target != args.confirm_target or not args.target.strip():
        parser.error('Target confirmation does not match; no deployment performed')
    key = os.environ.get('VIBE_API_KEY', '')
    if not key:
        parser.error('Set VIBE_API_KEY in the shell (never in the repository)')
    token = os.environ.get('VIBE_SESSION_TOKEN', '')
    archive = ROOT / 'vibecode-bundle.tar.gz'
    if not archive.is_file():
        parser.error('Build and run scripts/package_vibecode.py first')
    api('/me', key, token)  # Authentication/capability preflight.
    server = api('/infra/servers/' + args.target, key, token)['data']
    if server.get('kind') not in ('STANDALONE', 'GALAXY_APP'):
        raise RuntimeError('Target is not a deployable application server')
    if server.get('id') != args.target:
        raise RuntimeError('Server identity mismatch')
    print('Deploying to existing', server['kind'], 'target', server['id'])
    content = base64.b64encode(archive.read_bytes()).decode('ascii')
    if len(content) > 90 * 1024 * 1024:
        raise RuntimeError('Inline bundle too large; use source storage/versionId')
    payload = {
        'source': {'content': content},
        'runtime': 'node20',
        'start': 'node server.mjs',
        'port': 3000,
        'healthPath': '/healthz',
        'displayName': 'Svetlogorsk TD',
        'description': 'Four-lane cooperative-inspired tower defense prototype',
    }
    response = api('/infra/servers/' + args.target + '/deploy', key, token, payload)
    print('Deploy operation returned:', json.dumps(response.get('data', {}), ensure_ascii=False))
    print('Review /infra/servers/{id}/logs and the app URL before declaring success.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError) as error:
        sys.exit('ERROR: ' + str(error))
