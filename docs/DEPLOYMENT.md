# Hosting and deployment (October 2026)

## Deployment strategy

1. **GitHub Pages**: static beta with current GitHub Actions build from the repo root.
2. **VK Play HTML5**: distribution candidate after desktop/mobile UX tests and VK moderation.
3. **VK Mini Apps**: separate bridge, approvals, identity and payment requirements.
4. **Bitrix24 VibeCode**: an authenticated testing/distribution environment; do not
   assume its Black Hole subdomain is a public game storefront.

The project 30 MiB download budget is a local performance target, **not** a
verified VK Play or VK Mini Apps maximum file-size policy.

Official VK entry points: https://developers.vkplay.ru/welcome and
https://documentation.vkplay.ru/f2p_vkp/f2p_publish_vkp . SDK features,
monetization terms, moderation rules and current upload limits require
platform-side verification before publication.

## Bitrix24 VibeCode

The URL https://vibecode.bitrix24.tech/v1/me is an API discovery endpoint.
It returns JSON **only with an authenticated X-Api-Key**. Do not paste or
commit an API key; keep any OAuth session token exclusively server-side.

This repository provides a server on PORT=3000 (`deploy/vibecode/server.mjs`),
a standard tar.gz packer and an opt-in existing-server deploy helper. The
browser game itself does not access the Bitrix24 REST API.

```sh
npm run build
python3 scripts/package_vibecode.py
export VIBE_API_KEY='YOUR_PERSONAL_OR_APP_KEY'   # set securely, do not commit
# For an OAuth app key only, also set VIBE_SESSION_TOKEN securely.
python3 scripts/deploy_vibecode.py --target EXISTING_SERVER_ID   --confirm-target EXISTING_SERVER_ID
```

The helper reads GET /v1/me, validates the existing server/application id,
then POSTs JSON to `/v1/infra/servers/:id/deploy` with a base64 tar.gz archive,
`runtime: node20`, `start: node server.mjs`, `port: 3000` and
`healthPath: /healthz`. No new servers are provisioned. It intentionally does
not auto-select `deployment.standalone.reuseTarget`: inspect live code before
replacing it. A successful response still requires URL/health/gameplay checks.

Galaxy apps can accept inline `source.content` without CONNECTED status;
standalone Black Hole VMs need to be ready/connected. The platform may require
source version lineage and reject a blind overwrite with 409. Resolve the
base version and compare changes rather than retrying with an arbitrary ID.

Official references:
- https://vibecode.bitrix24.tech/docs/keys-auth/me
- https://vibecode.bitrix24.tech/docs/infra/deploy/deploy
- https://vibecode.bitrix24.tech/docs/infra/servers
- https://vibecode.bitrix24.tech/docs/infra
