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

## Database Schema

The SQLite database contains the following tables and views:

### Tables

#### orders
```sql
CREATE TABLE "orders" (
    order_id TEXT,
    order_date TEXT,
    status TEXT,
    return_status TEXT,
    article_id TEXT,
    quantity INTEGER,
    customer_id INTEGER,
    customer_name TEXT,
    customer_address TEXT,
    customer_postal_code INTEGER,
    customer_city TEXT,
    article_name TEXT,
    article_number TEXT,
    PRIMARY KEY (order_id, article_id)
)
```

#### customers
```sql
CREATE TABLE "customers" (
    customer_id INTEGER PRIMARY KEY,
    name TEXT,
    name2 TEXT,
    street TEXT,
    house_number TEXT,
    postal_code INTEGER,
    city TEXT,
    phone1 TEXT,
    phone2 TEXT,
    customer_class TEXT,
    stc_id INTEGER,
    stc TEXT,
    vb INTEGER,
    asm_unit_id INTEGER,
    vl_unit_id INTEGER,
    vb_unit_id INTEGER,
    payment_term TEXT,
    payment_term_sp TEXT,
    customer_group TEXT,
    parent_group TEXT
)
```

#### articles
```sql
CREATE TABLE "articles" (
    article_id TEXT PRIMARY KEY,
    item_number TEXT,
    name TEXT,
    ordering_unit_name TEXT,
    description TEXT,
    valid_during TEXT,
    keywords TEXT,
    ordering_unit INTEGER,
    serial_number_required TEXT,
    batch_number_required TEXT,
    type TEXT,
    package_count INTEGER,
    packaging_unit INTEGER,
    packed_dimensions TEXT,
    packed_volume REAL,
    packed_weight_kg REAL,
    constructed_dimensions TEXT,
    constructed_weight_kg REAL,
    max_orderable INTEGER,
    min_orderable INTEGER,
    allow_returns TEXT,
    price REAL,
    ordering_unit_price REAL,
    purchase_price REAL,
    responsible_employee_id INTEGER,
    min_stock INTEGER,
    has_expiration_date TEXT,
    notify_on_low_stock TEXT,
    book_stock_change_to TEXT,
    state TEXT,
    approval_comment TEXT,
    associated_product_ids TEXT,
    image_ids TEXT,
    master_id TEXT,
    product_config_ids TEXT,
    category_ids TEXT,
    catalog_ids TEXT,
    tax_class_id TEXT,
    custom_attr_stcs TEXT,
    custom_attr_brand TEXT,
    custom_attr_asset_types TEXT,
    custom_attr_region TEXT,
    custom_attr_classification TEXT,
    custom_attr_product_rank TEXT,
    product_permission_employee_ids TEXT
)
```

#### employees
```sql
CREATE TABLE "employees" (
    employee_id INTEGER PRIMARY KEY,
    name TEXT,
    number INTEGER,
    personal_number INTEGER,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    address TEXT,
    birth_date TEXT,
    employment_start_date TEXT,
    inactive TEXT,
    organization_unit_ids INTEGER,
    assistant_ids TEXT
)
```

#### units
```sql
CREATE TABLE "units" (
    unit_id INTEGER PRIMARY KEY,
    name TEXT,
    number INTEGER,
    level_id TEXT,
    parent_id INTEGER,
    children_ids TEXT,
    structure_id TEXT,
    custom_attr_personal_number INTEGER
)
```

### Views

#### orders_with_addresses
```sql
CREATE VIEW orders_with_addresses AS
SELECT 
    o.order_id,
    o.order_date,
    o.status,
    o.article_id,
    a.name AS article_name,
    a.item_number AS article_number,
    o.quantity,
    e.name AS employee_name,
    c.name AS customer_name,
    c.street || ' ' || c.house_number AS address,
    c.postal_code,
    c.city
FROM 
    orders o
LEFT JOIN 
    customers c ON o.customer_id = c.customer_id
LEFT JOIN 
    articles a ON o.article_id = a.article_id
LEFT JOIN
    employees e ON a.responsible_employee_id = e.employee_id
```

#### employee_emails
```sql
CREATE VIEW employee_emails AS 
SELECT email FROM employees
```

### Relationships

- orders.customer_id → customers.customer_id
- orders.article_id → articles.article_id
- articles.responsible_employee_id → employees.employee_id
- customers.vb_unit_id → units.unit_id
- customers.asm_unit_id → units.unit_id
- customers.vl_unit_id → units.unit_id

## HTTP Server API

The SQLite MCP server also runs a lightweight HTTP server that allows other services to access database tables, views, and execute queries directly without going through the LLM context. This is especially useful for integrating with visualization tools or other MCP servers that need to work with large datasets.

### Configuration

By default, the HTTP server runs on port 31111. You can override this by setting the `MCP_HTTP_PORT` environment variable:

```bash
MCP_HTTP_PORT=4000 npx @pollinations/mcp-server-sqlite /path/to/your/database.db
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
http://localhost:31111/data/orders
http://localhost:31111/data/employees?format=json
http://localhost:31111/data/orders_with_addresses?limit=500
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
http://localhost:31111/query?sql=SELECT%20*%20FROM%20orders%20WHERE%20status%20%3D%20%27Completed%27
http://localhost:31111/query?sql=SELECT%20customer_name%2C%20COUNT(*)%20FROM%20orders%20GROUP%20BY%20customer_name&format=json
```

### Response Formats

- **CSV Format**: Returns data as plain text CSV. This is the default format and will be displayed directly in the browser.
- **JSON Format**: Returns data as a JSON array of objects. Useful for programmatic access or when you need structured data.

To specify the format, add `format=json` to your query parameters:
```
http://localhost:31111/query?sql=SELECT%20*%20FROM%20orders&format=json
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

## Example Queries

Here are some example queries you can run against the database:

### Basic Queries

1. List all orders with customer information:
```sql
SELECT o.order_id, o.order_date, o.status, c.name AS customer_name
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
LIMIT 10
```

2. Find all articles managed by a specific employee:
```sql
SELECT a.article_id, a.name, a.item_number, e.name AS employee_name
FROM articles a
JOIN employees e ON a.responsible_employee_id = e.employee_id
LIMIT 10
```

3. Get order statistics by customer:
```sql
SELECT c.name, COUNT(o.order_id) AS order_count, SUM(o.quantity) AS total_items
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
GROUP BY c.name
ORDER BY order_count DESC
LIMIT 10
```

### Using Views

1. Get orders with complete address information:
```sql
SELECT * FROM orders_with_addresses LIMIT 10
```

2. List all employee emails:
```sql
SELECT * FROM employee_emails
```

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
