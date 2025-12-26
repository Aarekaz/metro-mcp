# Metro MCP

A remote Model Context Protocol (MCP) server that interfaces with the Washington, DC, Metro (WMATA) APIs. Built for integration with MCP-compatible clients. Configured to deploy on Cloudflare Workers.

## Features

Ask natural questions about the Metro:

**Real-Time Transit Information**

- Check train arrivals: "When is the next Red Line train at Dupont Circle?"
- Get service alerts: "Are there any delays on the Blue Line right now?"
- Find elevator/escalator outages: "Are all the elevators working at Union Station?"

**Station Information & Navigation**

- Search for stations: "Where is the Smithsonian Metro station?"
- Get stations by line: "Show me all the stations on the Green Line"

**Trip Planning & Accessibility**

- Route planning: "How do I get from Capitol South to Bethesda?"
- Check accessibility: "Are there any elevator outages between here and National Airport?"
- Real-time predictions: "What are the next 3 trains arriving at Gallery Place?"

**Service Monitoring**

- Current incidents: "Any Metro delays right now?"
- Line-specific issues: "Is the Orange Line running normally?"
- Construction updates: "What stations are closed for construction?"

**Geographic & System Info**

- Get all stations: Complete list of Metro stations with their coordinates
- Line information: Details about all six Metro lines

## Deployment

### Prerequisites

- [WMATA API Key](https://developer.wmata.com/) (required)
- [Cloudflare Account](https://dash.cloudflare.com/) (free tier works)
- [Bun](https://bun.sh/) or Node.js installed
- [GitHub OAuth App](https://github.com/settings/developers) (for authentication)

### Quick Start

**1. Install dependencies:**

```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

**2. Generate JWT secret:**

```bash
openssl rand -hex 32
```

**3. Create GitHub OAuth App:**

- Go to [github.com/settings/developers](https://github.com/settings/developers)
- Click "New OAuth App"
- Set **Homepage URL**: `https://metro-mcp.your-subdomain.workers.dev`
- Set **Authorization callback URL**: `https://metro-mcp.your-subdomain.workers.dev/callback`
- Save the **Client ID** and **Client Secret**

**4. Configure environment variables:**

Create `wrangler.toml` from the example:

```toml
name = "metro-mcp"
main = "src/index.ts"
compatibility_date = "2024-12-18"
workers_dev = true

[vars]
WMATA_API_KEY = "your-wmata-api-key"
GITHUB_CLIENT_ID = "your-github-client-id"
GITHUB_CLIENT_SECRET = "your-github-client-secret"
JWT_SECRET = "your-jwt-secret-from-step-2"
OAUTH_REDIRECT_URI = "https://metro-mcp.your-subdomain.workers.dev/callback"
```

**5. Build and deploy:**

```bash
# Build TypeScript
bunx tsc

# Deploy to Cloudflare Workers
bunx wrangler deploy
```

## MCP Client Integration

### Claude Desktop (Automatic OAuth)

**Simple Setup:**

Just add the server URL to Claude Desktop:

```text
https://metro-mcp.aarekaz.workers.dev
```

Claude Desktop will automatically:

1. Discover OAuth endpoints via `/.well-known/oauth-authorization-server`
2. Register as a client
3. Open your browser for GitHub authentication
4. Receive and store the access token
5. Connect to the MCP server

**No manual token copying required!**

### Other MCP Clients

For MCP clients that support OAuth 2.1 with automatic discovery:

**Server URL:**

```text
https://metro-mcp.aarekaz.workers.dev
```

The client will handle authentication automatically via the OAuth flow.

### Manual Token Authentication (Legacy)

If your MCP client doesn't support OAuth, you can still authenticate manually:

1. Visit `https://metro-mcp.aarekaz.workers.dev/authorize` in your browser
2. Authorize via GitHub
3. Copy the JWT token displayed
4. Configure your client with:
   - Server URL: `https://metro-mcp.aarekaz.workers.dev/sse`
   - Authorization Header: `Bearer your-jwt-token-here`

## OAuth Endpoints

The server implements OAuth 2.1 with PKCE for secure authentication:

- Discovery: `/.well-known/oauth-authorization-server`
- Registration: `/register` (Dynamic client registration - RFC 7591)
- Authorization: `/authorize` (GitHub OAuth integration)
- Token: `/token` (Authorization code exchange with PKCE verification)
- Callback: `/callback` (GitHub OAuth callback)

### Security Features

- PKCE (S256) required for all authorization flows
- Persistent client registration via Cloudflare KV
- JWT tokens with 90-day expiration
- Rate limiting and origin validation

## API Documentation

The MCP server interfaces with the official WMATA APIs. Vist WMATA's developer documentation for details.

- Station predictions: Real-time train arrival information
- Station information: Station names, codes, and locations
- Incidents: Service disruptions and advisories
- Elevator/escalator outages: Accessibility information

## License

MIT License - see LICENSE file for details.
