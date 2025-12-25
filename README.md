# Metro MCP

A remote Model Context Protocol (MCP) server that interfaces with the Washington, DC, Metro (WMATA) APIs. Built for integration with MCP-compatible clients like Claude Desktop. Configured to deploy on Cloudflare Workers.

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

Clone this repository, paste in your own environment variables, and deploy the server. Then configure your MCP client.

### Environment Variables

Copy `wrangler.toml.example` to `wrangler.toml` and set your environment variables:

```
[vars]
WMATA_API_KEY = "your-wmata-api-key"           # Required - Get from developer.wmata.com
JWT_SECRET = "your-jwt-secret"                 # Required - Generate with: openssl rand -hex 32
GITHUB_CLIENT_ID = "your-github-client-id"     # Optional - OAuth app client ID
GITHUB_CLIENT_SECRET = "your-github-secret"    # Optional - OAuth app client secret
OAUTH_REDIRECT_URI = "https://your-domain.com/callback"  # Optional - Your callback URL
```

### OAuth Setup (Optional)

To require users to log in to access your server, set up authentication with an OAuth provider like GitHub.

For GitHub OAuth authentication:

1. Create a GitHub OAuth app at [github.com/settings/developers](https://github.com/settings/developers)
2. Set Authorization callback URL to `https://your-domain.com/callback`
3. Set the environment variables above with your OAuth credentials

### Claude Desktop Integration

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "metro-mcp": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-domain.com/sse",
        "--header",
        "Authorization: Bearer your-token-here"
      ]
    }
  }
}
```

## API Documentation

The MCP server interfaces with the official WMATA APIs. Vist WMATA's developer documentation for details.

- Station predictions: Real-time train arrival information
- Station information: Station names, codes, and locations
- Incidents: Service disruptions and advisories
- Elevator/escalator outages: Accessibility information

## License

MIT License - see LICENSE file for details.
