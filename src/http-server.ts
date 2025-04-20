import express from 'express';
import cors from 'cors';
import http from 'http';
import { SqliteDatabase } from './index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Create a minimal HTTP server that exposes SQLite data
 * @param db The SQLite database instance
 * @param port The port to run the server on (default: 31111)
 * @param enableSSE Whether to enable SSE transport for MCP (default: false)
 * @param mcpServer Optional MCP server instance to connect with SSE transport
 * @returns The HTTP server instance and SSE transport (if enabled)
 */
export function createHttpServer(
  db: SqliteDatabase, 
  port: number = 31111, 
  enableSSE: boolean = false,
  mcpServer?: McpServer
) {
  console.error(`[HTTP] Initializing HTTP server on port ${port}${enableSSE ? ' with SSE support' : ''}`);
  const app = express();
  app.use(cors());
  app.use(express.json()); // Add JSON body parser middleware
  console.error(`[HTTP] CORS middleware enabled`);
  
  // Create server instance
  const httpServer = http.createServer(app);
  
  // Initialize SSE transport if enabled
  let sseTransport: SSEServerTransport | null = null;
  
  if (enableSSE) {
    console.error(`[HTTP] Setting up SSE transport for MCP`);
    
    // Set up SSE endpoint
    app.get('/mcp-sse', async (req, res) => {
      console.error(`[HTTP] SSE connection established`);
      sseTransport = new SSEServerTransport('/mcp-messages', res);
      
      // Connect the MCP server to the SSE transport if provided
      if (mcpServer) {
        console.error(`[HTTP] Connecting MCP server to SSE transport`);
        await mcpServer.connect(sseTransport);
      }
    });
    
    // Set up message endpoint for client-to-server communication
    app.post('/mcp-messages', (req, res) => {
      console.error(`[HTTP] Received message via SSE transport: ${JSON.stringify(req.body).substring(0, 100)}...`);
      if (sseTransport) {
        sseTransport.handlePostMessage(req, res, req.body);
      } else {
        console.error(`[HTTP] No SSE transport available to handle message`);
        res.status(503).json({ error: 'SSE transport not initialized' });
      }
    });
  }
  
  // Endpoint to get table or view data in CSV or JSON format
  app.get('/data/:name', (req: express.Request, res: express.Response) => {
    const { name } = req.params;
    const format = req.query.format || 'csv';
    const limit = parseInt(req.query.limit as string) || 1000;
    console.error(`[HTTP] GET /data/${name} - format: ${format}, limit: ${limit}`);
    
    (async () => {
      try {
        console.error(`[HTTP] Executing query: SELECT * FROM ${name} LIMIT ${limit}`);
        // Execute the query with read-only mode
        const data = await db.executeQuery(`SELECT * FROM ${name} LIMIT ${limit}`, true);
        console.error(`[HTTP] Query returned ${data.length} rows`);
        
        // Return data in requested format
        if (format === 'json') {
          console.error(`[HTTP] Sending JSON response`);
          res.json(data);
        } else {
          // Convert to CSV
          console.error(`[HTTP] Converting to CSV format`);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'inline');
          
          if (data.length === 0) {
            console.error(`[HTTP] No data to return, sending empty response`);
            return res.send('');
          }
          
          // Get headers from the first row
          const headers = Object.keys(data[0]);
          let csvContent = headers.join(',') + '\n';
          
          // Add data rows
          for (const row of data) {
            const values = headers.map(header => {
              const value = row[header];
              if (value === null || value === undefined) return '';
              if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return String(value);
            });
            csvContent += values.join(',') + '\n';
          }
          
          console.error(`[HTTP] Sending CSV response (${csvContent.length} bytes)`);
          res.send(csvContent);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[HTTP] Error getting data for ${name}: ${errorMessage}`);
        res.status(500).json({ error: `Error getting data: ${errorMessage}` });
      }
    })();
  });
  
  // Endpoint to execute a query and return the results
  app.get('/query', (req: express.Request, res: express.Response) => {
    const sql = req.query.sql as string;
    const format = req.query.format || 'csv';
    console.error(`[HTTP] GET /query - sql: ${sql && sql.substring(0, 50)}..., format: ${format}`);
    
    (async () => {
      try {
        if (!sql) {
          console.error(`[HTTP] Missing SQL query parameter`);
          return res.status(400).json({ error: 'Missing SQL query' });
        }
        
        // Only allow SELECT queries
        if (!sql.trim().toLowerCase().startsWith('select')) {
          console.error(`[HTTP] Non-SELECT query rejected: ${sql.substring(0, 50)}...`);
          return res.status(403).json({ error: 'Only SELECT queries are allowed' });
        }
        
        console.error(`[HTTP] Executing query: ${sql.substring(0, 100)}...`);
        // Execute the query in read-only mode
        const result = await db.executeQuery(sql, true);
        console.error(`[HTTP] Query returned ${result.length} rows`);
        
        // Return results in requested format
        if (format === 'json') {
          console.error(`[HTTP] Sending JSON response`);
          res.json(result);
        } else {
          // Convert to CSV
          console.error(`[HTTP] Converting to CSV format`);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'inline');
          
          if (result.length === 0) {
            console.error(`[HTTP] No data to return, sending empty response`);
            return res.send('');
          }
          
          // Get headers from the first row
          const headers = Object.keys(result[0]);
          let csvContent = headers.join(',') + '\n';
          
          // Add data rows
          for (const row of result) {
            const values = headers.map(header => {
              const value = row[header];
              if (value === null || value === undefined) return '';
              if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return String(value);
            });
            csvContent += values.join(',') + '\n';
          }
          
          console.error(`[HTTP] Sending CSV response (${csvContent.length} bytes)`);
          res.send(csvContent);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[HTTP] Error executing query: ${errorMessage}`);
        res.status(500).json({ error: `Error executing query: ${errorMessage}` });
      }
    })();
  });
  
  // Start the server
  httpServer.listen(port, () => {
    console.error(`[HTTP] Server running at http://localhost:${port}`);
    console.error(`[HTTP] Available endpoints:`);
    console.error(`[HTTP] - GET /data/:name - Get table or view data`);
    console.error(`[HTTP] - GET /query?sql=... - Execute a SELECT query`);
    
    if (enableSSE) {
      console.error(`[HTTP] - GET /mcp-sse - SSE endpoint for MCP`);
      console.error(`[HTTP] - POST /mcp-messages - Message endpoint for MCP`);
    }
  });
  
  return { httpServer, sseTransport };
}
