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

- Uses the higher-level `McpServer` API from the MCP SDK for cleaner code
- Provides SQLite database access via MCP tools
- Supports read-only mode for queries
- Includes safety checks to prevent destructive operations

## Available Tools

1. `execute_query` - Execute an SQL query on the SQLite database
   - Parameters:
     - `query`: The SQL query to execute
     - `read_only` (optional): If true, only SELECT queries will be allowed

2. `list_tables` - List all tables in the SQLite database
   - No parameters required

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
