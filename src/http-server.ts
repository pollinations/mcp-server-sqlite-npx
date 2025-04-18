import express from 'express';
import cors from 'cors';
import http from 'http';
import { SqliteDatabase } from './index.js';

/**
 * Create a minimal HTTP server that exposes SQLite data
 * @param db The SQLite database instance
 * @param port The port to run the server on (default: 31111)
 * @returns The HTTP server instance
 */
export function createHttpServer(db: SqliteDatabase, port: number = 31111) {
  console.error(`[HTTP] Initializing HTTP server on port ${port}`);
  const app = express();
  app.use(cors());
  console.error(`[HTTP] CORS middleware enabled`);
  
  // Create server instance
  const httpServer = http.createServer(app);
  
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
  });
  
  return httpServer;
}
