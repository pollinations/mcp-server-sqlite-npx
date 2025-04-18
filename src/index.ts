#!/usr/bin/env node

import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import sqlite3 from 'sqlite3';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { createHttpServer } from './http-server.js';

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: mcp-server-sqlite-npx <database-path>');
  process.exit(1);
}

const dbPath = path.resolve(args[0]);
console.error(`[MCP] Database path resolved to: ${dbPath}`);

// Default HTTP port (can be overridden via environment variable)
const HTTP_PORT = process.env.MCP_HTTP_PORT ? parseInt(process.env.MCP_HTTP_PORT) : 31111;
console.error(`[MCP] Using HTTP port: ${HTTP_PORT} (override with MCP_HTTP_PORT env var)`);


interface RunResult {
  affectedRows: number;
}

/**
 * Wrapper for sqlite3.Database that bridges CommonJS and ESM modules.
 * This abstraction is necessary because:
 * 1. sqlite3 is a CommonJS module while we're using ESM (type: "module")
 * 2. The module interop requires careful handling of the Database import
 * 3. We need to promisify the callback-based API to work better with async/await
 */
class DatabaseWrapper {
  private readonly db: sqlite3.Database;

  constructor(filename: string) {
    this.db = new sqlite3.Database(filename);
  }

  query(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  execute(sql: string, params: any[] = []): Promise<RunResult[]> {
    return new Promise((resolve, reject) => {
      this.db.run(
        sql,
        params,
        function (this: sqlite3.RunResult, err: Error | null) {
          if (err) reject(err);
          else resolve([{ affectedRows: this.changes }]);
        },
      );
    });
  }
}

class SqliteDatabase {
  private readonly db: DatabaseWrapper;

  constructor(dbPath: string) {
    console.error(`[MCP] Initializing SQLite database: ${dbPath}`);
    this.db = new DatabaseWrapper(dbPath);
  }

  private async query<T>(
    sql: string,
    params: any[] = [],
  ): Promise<T[]> {
    console.error(`[MCP] Executing query: ${sql.substring(0, 100)}${sql.length > 100 ? '...' : ''}`);
    if (params.length > 0) {
      console.error(`[MCP] Query parameters: ${JSON.stringify(params)}`);
    }
    return this.db.query(sql, params);
  }

  async listTables(): Promise<any[]> {
    console.error(`[MCP] Listing tables`);
    const tables = await this.query(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
    console.error(`[MCP] Found ${tables.length} tables`);
    return tables;
  }

  async executeQuery(query: string, readOnly?: boolean, params: any[] = []): Promise<any[]> {
    const trimmedQuery = query.trim().toUpperCase();
    console.error(`[MCP] Executing query${readOnly ? ' (read-only)' : ''}: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
    
    // Validate query if read-only mode is enabled
    if (readOnly === true && !trimmedQuery.startsWith('SELECT')) {
      console.error(`[MCP] Rejected non-SELECT query in read-only mode: ${query}`);
      throw new Error('Only SELECT queries are allowed in read-only mode');
    }
    
    // For safety, prevent certain destructive operations
    if (
      trimmedQuery.startsWith('DROP ') ||
      trimmedQuery.includes('DELETE FROM') && !trimmedQuery.includes('WHERE')
    ) {
      console.error(`[MCP] Rejected potentially destructive query: ${query}`);
      throw new Error('Potentially destructive query detected. Please add constraints or remove this safety check if intended.');
    }
    
    const result = await this.query(query, params);
    console.error(`[MCP] Query returned ${result.length} rows`);
    return result;
  }
}

// Export the SqliteDatabase class for other modules
export { SqliteDatabase };

// Server setup using the higher-level McpServer class
console.error(`[MCP] Creating MCP server instance`);
const server = new McpServer({
  name: 'sqlite-manager',
  version: '0.6.1',
});

console.error(`[MCP] Creating SQLite database instance`);
const db = new SqliteDatabase(dbPath);

// Initialize the HTTP server
console.error(`[MCP] Initializing HTTP server`);
const httpServer = createHttpServer(db, HTTP_PORT);

// Add resources to expose database schema and table data
// Resource for database schema
server.resource(
  'schema',
  'sqlite://schema',
  async (uri) => {
    try {
      console.error(`[MCP] Getting schema`);
      const tables = await db.listTables();
      const tableSchemas = await Promise.all(
        tables.map(async (table: { name: string }) => {
          const schema = await db.executeQuery(`PRAGMA table_info(${table.name})`, true);
          return {
            name: table.name,
            columns: schema
          };
        })
      );
      
      // Convert to CSV format
      let csvContent = 'table_name,column_name,type,notnull,default_value,pk\n';
      for (const table of tableSchemas) {
        for (const column of table.columns) {
          csvContent += `${table.name},${column.name},${column.type},${column.notnull},${column.dflt_value || ''},${column.pk}\n`;
        }
      }
      
      return {
        contents: [{
          uri: uri.href,
          text: csvContent,
          mimeType: 'text/csv'
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Error getting schema: ${errorMessage}`);
      throw new Error(`Error getting schema: ${errorMessage}`);
    }
  }
);

// Dynamic resource for table data
server.resource(
  'table-data',
  new ResourceTemplate('sqlite://tables/{tableName}', { 
    list: async () => {
      try {
        console.error(`[MCP] Listing tables and views`);
        // Get regular tables
        const tables = await db.listTables();
        
        // Get views
        const views = await db.executeQuery("SELECT name FROM sqlite_master WHERE type='view'", false);
        
        // Combine tables and views
        const resources = [
          ...tables.map((table: { name: string }) => ({
            name: table.name,
            uri: `sqlite://tables/${table.name}`,
            description: `Data from the ${table.name} table`,
            mimeType: 'text/csv'
          })),
          ...views.map((view: { name: string }) => ({
            name: view.name,
            uri: `sqlite://tables/${view.name}`,
            description: `Data from the ${view.name} view`,
            mimeType: 'text/csv'
          }))
        ];
        
        return { resources };
      } catch (error) {
        console.error(`[MCP] Error listing tables and views: ${error}`);
        return { resources: [] };
      }
    }
  }),
  async (uri, { tableName }) => {
    try {
      console.error(`[MCP] Getting table data: ${tableName}`);
      // Check if it's a table or view
      const entityType = await db.executeQuery(
        "SELECT type FROM sqlite_master WHERE name = ? AND (type = 'table' OR type = 'view')",
        false,
        [tableName]
      );
      
      if (entityType.length === 0) {
        console.error(`[MCP] Table or view '${tableName}' not found`);
        throw new Error(`Table or view '${tableName}' not found`);
      }
      
      const type = entityType[0].type;
      
      // Get a preview of the data (first 10 rows)
      const data = await db.executeQuery(`SELECT * FROM ${tableName} LIMIT 10`, true);
      
      // Convert to CSV format
      if (data.length === 0) {
        return {
          contents: [{
            uri: uri.href,
            text: `No data found in ${type} ${tableName}`,
            mimeType: 'text/plain'
          }]
        };
      }
      
      // Get headers from the first row
      const headers = Object.keys(data[0]);
      let csvContent = headers.join(',') + '\n';
      
      // Add data rows
      for (const row of data) {
        const values = headers.map(header => {
          const value = row[header];
          // Handle special cases like null, undefined, or values with commas
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        });
        csvContent += values.join(',') + '\n';
      }
      
      // Include the HTTP URL to access the full dataset
      const httpUrl = `http://localhost:${HTTP_PORT}/data/${tableName}`;
      const fullContent = `# Preview (first 10 rows):\n${csvContent}\n\n# Full data available at:\n${httpUrl}\n\n# Access formats:\n- CSV: ${httpUrl}\n- JSON: ${httpUrl}?format=json`;
      
      return {
        contents: [{
          uri: uri.href,
          text: fullContent,
          mimeType: 'text/markdown'
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Error getting table data: ${errorMessage}`);
      throw new Error(`Error getting table data: ${errorMessage}`);
    }
  }
);

// Add prompts for common SQL operations
server.prompt(
  'select-data',
  {
    table: z.string(),
    columns: z.string().optional(),
    where: z.string().optional(),
    limit: z.string().optional()
  },
  (args) => {
    console.error(`[MCP] Generating prompt for selecting data from table: ${args.table}`);
    const { table, columns = '*', where, limit } = args;
    let query = `SELECT ${columns} FROM ${table}`;
    if (where) {
      query += ` WHERE ${where}`;
    }
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please execute the following SQL query and analyze the results:\n\n\`\`\`sql\n${query}\n\`\`\``
        }
      }]
    };
  }
);

server.prompt(
  'analyze-table',
  {
    table: z.string()
  },
  (args) => {
    console.error(`[MCP] Generating prompt for analyzing table: ${args.table}`);
    const { table } = args;
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please analyze the structure and data of the "${table}" table. First, examine the schema, then look at sample data, and provide insights about the table's purpose, data types, and any patterns you observe.`
        }
      }]
    };
  }
);

// Add tools to the server using the simplified API
server.tool(
  'execute_query',
  {
    query: z.string(),
    read_only: z.boolean().optional()
  },
  async ({ query, read_only }) => {
    console.error(`[MCP] Executing query: ${query}`);
    try {
      const result = await db.executeQuery(query, read_only);
      
      // Convert to CSV format
      if (!Array.isArray(result) || result.length === 0) {
        return {
          content: [{ type: 'text', text: 'Query executed successfully. No results returned or non-SELECT query.' }]
        };
      }
      
      // Get headers from the first row
      const headers = Object.keys(result[0]);
      let csvContent = headers.join(',') + '\n';
      
      // Add data rows
      for (const row of result) {
        const values = headers.map(header => {
          const value = row[header];
          // Handle special cases like null, undefined, or values with commas
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        });
        csvContent += values.join(',') + '\n';
      }
      
      return {
        content: [{ type: 'text', text: csvContent }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Error executing query: ${errorMessage}`);
      return {
        content: [{ type: 'text', text: `Error executing query: ${errorMessage}` }]
      };
    }
  }
);

server.tool(
  'list_tables',
  {},
  async () => {
    console.error(`[MCP] Listing tables`);
    try {
      const tables = await db.listTables();
      return {
        content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Error listing tables: ${errorMessage}`);
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true
      };
    }
  }
);

// Add a tool to save the entire database file
server.tool(
  'save_database',
  {
    filepath: z.string().optional().describe('Path to save the database file to (defaults to original path)')
  },
  async ({ filepath }) => {
    console.error(`[MCP] Saving database file`);
    try {
      // If no filepath is provided, use the original database path
      const targetPath = filepath || dbPath;
      
      if (targetPath === dbPath) {
        // If saving to the same file, we need to create a temporary copy first
        const tempPath = `${dbPath}.tmp`;
        await fs.copyFile(dbPath, tempPath);
        await fs.rename(tempPath, dbPath);
      } else {
        // Copy to a different location
        await fs.copyFile(dbPath, targetPath);
      }
      
      return {
        content: [{ type: 'text', text: `Successfully saved database to ${targetPath}` }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Error saving database: ${errorMessage}`);
      return {
        content: [{ type: 'text', text: `Error saving database: ${errorMessage}` }],
        isError: true
      };
    }
  }
);

// Add a tool for SQL queries with HTTP results
server.tool(
  'execute_query_with_url',
  {
    query: z.string().describe('SQL query to execute (must be a SELECT query)'),
    description: z.string().optional().describe('Optional description of the query purpose')
  },
  async ({ query, description }) => {
    console.error(`[MCP] Executing query with URL: ${query}`);
    try {
      // Only allow SELECT queries for security
      if (!query.trim().toLowerCase().startsWith('select')) {
        return {
          content: [{ type: 'text', text: 'Error: Only SELECT queries are allowed with this tool.' }]
        };
      }
      
      // Execute the query
      const result = await db.executeQuery(query, true);
      
      if (!Array.isArray(result) || result.length === 0) {
        return {
          content: [{ type: 'text', text: 'Query executed successfully but returned no results.' }]
        };
      }
      
      // Create a simple preview (first 5 rows)
      const preview = result.slice(0, 5);
      
      // Encode the query for use in a URL
      const encodedQuery = encodeURIComponent(query);
      const queryUrl = `http://localhost:${HTTP_PORT}/query?sql=${encodedQuery}`;
      
      // Return the result info
      const queryDesc = description ? description : 'Query result';
      
      return {
        content: [{ 
          type: 'text', 
          text: `${queryDesc}\n\nPreview (first 5 rows):\n${JSON.stringify(preview, null, 2)}\n\nTotal rows: ${result.length}\n\nFull results available at:\n- CSV: ${queryUrl}\n- JSON: ${queryUrl}&format=json` 
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Error executing query: ${errorMessage}`);
      return {
        content: [{ type: 'text', text: `Error executing query: ${errorMessage}` }]
      };
    }
  }
);

// Add a tool to create a view
server.tool(
  'create_view',
  {
    name: z.string().describe('Name for the view'),
    query: z.string().describe('SELECT query that defines the view'),
    description: z.string().optional().describe('Optional description of the view purpose')
  },
  async ({ name, query, description }) => {
    console.error(`[MCP] Creating view: ${name}`);
    try {
      // Validate that the query starts with SELECT
      if (!query.trim().toLowerCase().startsWith('select')) {
        return {
          content: [{ type: 'text', text: 'Error: View definition must be a SELECT query.' }]
        };
      }
      
      // Create the view
      const createViewQuery = `CREATE VIEW IF NOT EXISTS ${name} AS ${query}`;
      await db.executeQuery(createViewQuery, false);
      
      // Generate the HTTP URL for the view
      const httpUrl = `http://localhost:${HTTP_PORT}/data/${name}`;
      
      // Add the description in the response if provided
      const descriptionText = description 
        ? `\n\nDescription: ${description}`
        : '';
      
      return {
        content: [{ 
          type: 'text', 
          text: `View '${name}' created successfully.${descriptionText}\n\nView data available at:\n- CSV: ${httpUrl}\n- JSON: ${httpUrl}?format=json` 
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Error creating view: ${errorMessage}`);
      return {
        content: [{ type: 'text', text: `Error creating view: ${errorMessage}` }]
      };
    }
  }
);

// Start server
async function runServer() {
  console.error(`[MCP] Starting MCP server`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Use console.error to show error output.
  // console.log results in JSon exception.
  console.error(`[MCP] SQLite MCP Server running on stdio`);
  console.error(`[MCP] Database path: ${dbPath}`);
  console.error(`[MCP] HTTP server running at http://localhost:${HTTP_PORT}`);
  console.error(`[MCP] Available resources:`);
  console.error(`[MCP] - sqlite://schema - Get the schema of all tables in the database`);
  console.error(`[MCP] - sqlite://tables/{tableName} - Get data from a specific table or view`);
  console.error(`[MCP] Available tools:`);
  console.error(`[MCP] - execute_query - Execute SQL queries`);
  console.error(`[MCP] - execute_query_with_url - Execute SQL queries and get URL to results`);
  console.error(`[MCP] - list_tables - List all tables in the database`);
  console.error(`[MCP] - save_database - Save the database file`);
  console.error(`[MCP] - create_view - Create a SQL view`);
}

runServer().catch(error => {
  console.error('[MCP] Fatal error running server:', error);
  process.exit(1);
});

// Add exit handlers for graceful shutdown
process.on('SIGINT', () => {
  console.error('[MCP] Received SIGINT signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[MCP] Received SIGTERM signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('exit', (code) => {
  console.error(`[MCP] Process exiting with code ${code}`);
});
