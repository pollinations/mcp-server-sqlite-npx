#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import sqlite3 from 'sqlite3';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: mcp-server-sqlite-npx <database-path>');
  process.exit(1);
}

const dbPath = path.resolve(args[0]);

// Schema definitions
const ExecuteQueryArgsSchema = z.object({
  query: z.string().describe('SQL query to execute'),
  read_only: z.boolean().optional().describe('If true, only SELECT queries will be allowed'),
});

// Define the type based on the schema
type ExecuteQueryArgs = z.infer<typeof ExecuteQueryArgsSchema>;

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
    this.db = new DatabaseWrapper(dbPath);
  }

  private async query<T>(
    sql: string,
    params: any[] = [],
  ): Promise<T[]> {
    return this.db.query(sql, params);
  }

  async listTables(): Promise<any[]> {
    return this.query(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );
  }

  async executeQuery(query: string, readOnly?: boolean): Promise<any[]> {
    const trimmedQuery = query.trim().toUpperCase();
    
    // Validate query if read-only mode is enabled
    if (readOnly === true && !trimmedQuery.startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed in read-only mode');
    }
    
    // For safety, prevent certain destructive operations
    if (
      trimmedQuery.startsWith('DROP ') ||
      trimmedQuery.includes('DELETE FROM') && !trimmedQuery.includes('WHERE')
    ) {
      throw new Error('Potentially destructive query detected. Please add constraints or remove this safety check if intended.');
    }
    
    return this.query(query);
  }
}

// Server setup using the higher-level McpServer class
const server = new McpServer({
  name: 'sqlite-manager',
  version: '0.2.0',
});

const db = new SqliteDatabase(dbPath);

// Add tools to the server using the simplified API
server.tool(
  'execute_query',
  {
    query: z.string(),
    read_only: z.boolean().optional()
  },
  async ({ query, read_only }) => {
    try {
      const results = await db.executeQuery(query, read_only);
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Error: ${errorMessage}` }],
        isError: true
      };
    }
  }
);

server.tool(
  'list_tables',
  {},
  async () => {
    try {
      const tables = await db.listTables();
      return {
        content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
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
      return {
        content: [{ type: 'text', text: `Error saving database: ${errorMessage}` }],
        isError: true
      };
    }
  }
);

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Use console.error to show error output.
  // console.log results in JSon exception.
  console.error('SQLite MCP Server running on stdio');
  console.error('Database path:', dbPath);
}

runServer().catch(error => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
