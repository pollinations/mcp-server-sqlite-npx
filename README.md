# MCP SQLite Server

A Node.js implementation of the Model Context Protocol SQLite server, based on the [official Python reference](https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite). This version provides an npx-based alternative for environments where Python's UVX runner is not available, such as [LibreChat](https://github.com/danny-avila/LibreChat/issues/4876#issuecomment-2561363955).

This fork uses the higher-level `McpServer` API from the MCP SDK instead of the low-level request handlers, making the code more maintainable and easier to understand.

## Installation

You can use the package directly via npx:

```bash
npx @pollinations/mcp-server-sqlite /path/to/your/database.db
```

Or install it globally:

```bash
npm install -g @pollinations/mcp-server-sqlite
mcp-server-sqlite /path/to/your/database.db
```

## Use with Claude Desktop

### Installing Manually

Add the following to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "/absolute/path/to/npx",
      "args": [
        "-y",
        "@pollinations/mcp-server-sqlite",
        "/absolute/path/to/database.db"
      ],
      "env": {
        "PATH": "/absolute/path/to/executables",
        "NODE_PATH": "/absolute/path/to/node_modules"
      }
    }
  }
}
```

Full example when using nvm on macOS:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "/Users/{username}/.nvm/versions/node/v22.12.0/bin/npx",
      "args": [
        "-y",
        "@pollinations/mcp-server-sqlite",
        "/Users/{username}/projects/database.db"
      ],
      "env": {
        "PATH": "/Users/{username}/.nvm/versions/node/v22.12.0/bin:/usr/local/bin:/usr/bin:/bin",
        "NODE_PATH": "/Users/{username}/.nvm/versions/node/v22.12.0/lib/node_modules"
      }
    }
  }
}
```

Full example when using nvm on Windows:

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "C:\\Program Files\\nodejs\\npx.cmd",
      "args": [
        "-y",
        "@pollinations/mcp-server-sqlite",
        "C:\\Users\\{username}\\projects\\database.db"
      ],
      "env": {
        "PATH": "C:\\Program Files\\nodejs;%PATH%",
        "NODE_PATH": "C:\\Program Files\\nodejs\\node_modules"
      }
    }
  }
}
```

## Features

- Execute SQL queries directly against your SQLite database
- List all tables in your database
- Save the entire database file with an optional target path
- MCP Resources for exploring database schema and table data 
- MCP Prompts for standardized SQL operations
- HTTP API for direct access to tables, views, and query results (great for integrating with other services)

## HTTP Server API

The SQLite MCP server also runs a lightweight HTTP server that allows other services to access database tables, views, and execute queries directly without going through the LLM context. This is especially useful for integrating with visualization tools or other MCP servers that need to work with large datasets.

### Configuration

By default, the HTTP server runs on port 31111. You can override this by setting the `MCP_HTTP_PORT` environment variable:

```bash
MCP_HTTP_PORT=4000 npx @pollinations/mcp-server-sqlite <database-path>
```

### Endpoints

#### Get Table or View Data

```
GET /data/:name
```

- **`:name`**: Name of the table or view
- **Query Parameters**:
  - `format`: `csv` (default) or `json`
  - `limit`: Maximum number of rows to return (default: 1000)

**Example**:
```
http://localhost:31111/data/employees
http://localhost:31111/data/employees?format=json
http://localhost:31111/data/monthly_sales?limit=500
```

#### Execute Custom Query

```
GET /query
```

- **Query Parameters**:
  - `sql`: SQL query to execute (must be a SELECT query)
  - `format`: `csv` (default) or `json`

**Example**:
```
http://localhost:31111/query?sql=SELECT%20*%20FROM%20users%20WHERE%20age%20%3E%2021
http://localhost:31111/query?sql=SELECT%20*%20FROM%20users%20WHERE%20age%20%3E%2021&format=json
```

## Cloudflare Tunnel Setup

You can expose your SQLite MCP server to the internet using Cloudflare Tunnels. This allows you to access your database from anywhere without opening ports on your firewall.

### Prerequisites

1. A Cloudflare account
2. The `cloudflared` CLI tool installed
3. A domain managed by Cloudflare

### Automated Setup

We provide a script to automate the setup process:

```bash
# Make the script executable if needed
chmod +x scripts/setup-cloudflare-tunnel.sh

# Basic usage (creates a tunnel named "sqlite-mcp" with domain "sqlite-mcp.example.com")
./scripts/setup-cloudflare-tunnel.sh

# Custom configuration
./scripts/setup-cloudflare-tunnel.sh my-tunnel my-tunnel.mydomain.com 8080
```

### Manual Setup

If you prefer to set up the tunnel manually:

1. Log in to Cloudflare:
   ```bash
   cloudflared login
   ```

2. Create a tunnel:
   ```bash
   cloudflared tunnel create sqlite-mcp
   ```

3. Associate a domain with your tunnel:
   ```bash
   cloudflared tunnel route dns sqlite-mcp your-subdomain.yourdomain.com
   ```

4. Create a configuration file (e.g., `cloudflared-config.yml`):
   ```yaml
   tunnel: <your-tunnel-id>
   credentials-file: ~/.cloudflared/<your-tunnel-id>.json

   ingress:
     - hostname: your-subdomain.yourdomain.com
       service: http://localhost:31111
     - service: http_status:404
   ```

5. Run the tunnel:
   ```bash
   cloudflared tunnel --config cloudflared-config.yml run
   ```

### Running as a Service

For production environments, you should run the tunnel as a service:

```bash
sudo cloudflared service install --config cloudflared-config.yml
```

**Note**: After setting up a new tunnel, it may take 5-15 minutes for SSL certificates to be fully provisioned. If you encounter SSL errors, please wait and try again later.

### Usage with Other MCP Servers

The HTTP server allows other MCP servers to access data directly without passing it through the LLM context. For example, a visualization MCP server can query your SQLite server directly:

```javascript
// In a visualization MCP server tool implementation
async ({ dataUrl, chartType }) => {
  // Fetch data directly from SQLite server HTTP endpoint
  const response = await fetch(dataUrl);
  const csvData = await response.text();
  
  // Parse CSV and create visualization
  const parsedData = parseCSV(csvData);
  const chart = createChart(parsedData, chartType);
  
  return { 
    content: [{ type: 'image', data: chart }]
  };
}
```

The MCP resource system automatically includes HTTP URLs in the resource content, making it easy to reference in other tools.

## Available Tools

1. `execute_query` - Execute an SQL query on the SQLite database
   - Parameters:
     - `query`: The SQL query to execute
     - `read_only` (optional): If true, only SELECT queries will be allowed

2. `list_tables` - List all tables in the SQLite database
   - No parameters required

3. `save_database` - Save the entire database file to a new location
   - Parameters:
     - `filepath` (optional): Path to save the database file to (defaults to original path)

4. `execute_query_with_url` - Execute a SQL query and get a URL to access the full results via HTTP.
   - Parameters:
     - `query`: SQL query to execute (must be a SELECT query)
     - `description`: (optional) Description of the query purpose

5. `create_view` - Create a SQL view with an optional description, which can then be accessed via HTTP.
   - Parameters:
     - `name`: Name for the view
     - `query`: SELECT query that defines the view
     - `description`: (optional) Description of the view purpose

## Available Resources

1. `sqlite://schema` - Get the schema of all tables in the database
   - Returns detailed information about all tables and their columns

2. `sqlite://tables/{tableName}` - Get data from a specific table
   - Dynamic resource that returns the first 100 rows from the specified table
   - The list of available tables can be discovered through the resources/list endpoint

## Available Prompts

1. `select-data` - Generate a prompt to execute and analyze a SELECT query
   - Parameters:
     - `table`: Name of the table to query
     - `columns` (optional): Comma-separated list of columns to select (defaults to *)
     - `where` (optional): WHERE clause condition
     - `limit` (optional): Maximum number of rows to return

2. `analyze-table` - Generate a prompt to analyze a table's structure and data
   - Parameters:
     - `table`: Name of the table to analyze

## Development

1. Install dependencies:

```bash
npm ci
```

2. Build the TypeScript code:

```bash
npm run build
```

### Testing with MCP Inspector

You can test the server using the [MCP Inspector tool](https://modelcontextprotocol.io/docs/tools/inspector):

```bash
npx @modelcontextprotocol/inspector node dist/index.js /absolute/path/to/database.db
```

## License

MIT
