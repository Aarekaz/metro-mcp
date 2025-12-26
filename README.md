# 🚇 Metro MCP

> Model Context Protocol Server for Washington DC Metro

[![MCP](https://img.shields.io/badge/MCP-2025--03--26-blue)](https://modelcontextprotocol.io)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com)
[![OAuth 2.1](https://img.shields.io/badge/OAuth-2.1%20%2B%20PKCE-green)](https://oauth.net/2.1/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

A remote Model Context Protocol (MCP) server that interfaces with the Washington, DC, Metro (WMATA) APIs. Built for seamless integration with MCP-compatible clients like Claude Desktop.

**Quick Links:** [Quick Start](#quick-start) • [What You Can Do](#what-you-can-do) • [Deployment](#deployment) • [Client Integration](#mcp-client-integration)

---

## What You Can Do

Ask natural language questions about Washington DC Metro in Claude Desktop or any MCP-compatible client:

### 🚆 Real-Time Transit Information

- **Train arrivals:** *"When is the next Red Line train at Dupont Circle?"*
- **Service alerts:** *"Are there any delays on the Blue Line right now?"*
- **Elevator/escalator outages:** *"Are all the elevators working at Union Station?"*

### 🗺️ Station Information & Navigation

- **Search stations:** *"Where is the Smithsonian Metro station?"*
- **Stations by line:** *"Show me all the stations on the Green Line"*
- **Route planning:** *"How do I get from Capitol South to Bethesda?"*

### ♿ Accessibility

- **Elevator status:** *"Are there any elevator outages between here and National Airport?"*
- **Station accessibility:** *"Which stations have working elevators right now?"*

### 🔔 Service Monitoring

- **Current incidents:** *"Any Metro delays right now?"*
- **Line-specific issues:** *"Is the Orange Line running normally?"*
- **Real-time predictions:** *"What are the next 3 trains arriving at Gallery Place?"*

### 📊 System Information

- Complete list of all Metro stations with coordinates
- Information about all six Metro lines (Red, Blue, Orange, Silver, Green, Yellow)
- Historical incident tracking

---

## Quick Start

### Using the Public Server

The fastest way to get started is to use the hosted instance:

1. Open Claude Desktop
2. Add this URL: `https://metro-mcp.aarekaz.workers.dev`
3. Click "Connect" and authorize via GitHub
4. Start asking questions about DC Metro!

### Deploy Your Own

Want to run your own instance? See the [Deployment](#deployment) section below.

---

## Deployment

### Prerequisites

- [WMATA API Key](https://developer.wmata.com/) (required)
- [Cloudflare Account](https://dash.cloudflare.com/) (free tier works)
- [Bun](https://bun.sh/) or Node.js installed
- [GitHub OAuth App](https://github.com/settings/developers) (for authentication)

### Setup Steps

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

**4. Create KV Namespaces:**

```bash
# Create production KV namespace
bunx wrangler kv namespace create "OAUTH_CLIENTS"

# Create preview KV namespace
bunx wrangler kv namespace create "OAUTH_CLIENTS" --preview
```

Copy the IDs from the output and update `wrangler.toml`.

**5. Configure environment:**

Copy the example files and fill in your values:

```bash
# Copy wrangler config
cp wrangler.toml.example wrangler.toml
# Update the KV namespace IDs in wrangler.toml

# Copy local development secrets
cp .dev.vars.example .dev.vars
# Add your actual secrets to .dev.vars
```

**6. Set production secrets:**

```bash
# These are encrypted and stored securely by Cloudflare
bunx wrangler secret put WMATA_API_KEY
bunx wrangler secret put GITHUB_CLIENT_SECRET
bunx wrangler secret put JWT_SECRET
```

**7. Deploy:**

```bash
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

## Available MCP Tools

The server exposes the following tools through the MCP protocol:

| Tool | Description |
| ---- | ----------- |
| `get_next_trains` | Get real-time train predictions for a specific station |
| `get_station_info` | Retrieve detailed information about Metro stations |
| `get_incidents` | Check current service disruptions and advisories |
| `get_elevator_incidents` | Find elevator and escalator outages |
| `get_all_stations` | Get a complete list of all Metro stations |
| `get_lines` | Information about all Metro lines |

## Technical Details

### MCP Protocol

- **Version:** 2025-03-26
- **Transport:** SSE (Server-Sent Events)
- **Authentication:** OAuth 2.1 with PKCE (S256)

### WMATA APIs

The server interfaces with the official WMATA APIs. Visit [WMATA's developer documentation](https://developer.wmata.com/) for API details:

- **Station predictions:** Real-time train arrival information
- **Station information:** Station names, codes, and locations
- **Incidents:** Service disruptions and advisories
- **Elevator/escalator outages:** Accessibility information

### Hosting

- **Platform:** Cloudflare Workers
- **Storage:** Cloudflare KV (for OAuth client registration)
- **Runtime:** V8 isolates with global edge deployment

## Contributing

Contributions are welcome! Feel free to:

- Report bugs or request features via [GitHub Issues](https://github.com/yourusername/metro-mcp/issues)
- Submit pull requests with improvements
- Share feedback on the MCP implementation

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Built with ❤️ for the Washington DC Metro community
