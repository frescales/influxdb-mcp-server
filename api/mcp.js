import { z } from "zod";

// Import config
import { validateEnvironment } from "../src/config/env.js";

// Import utilities
import { configureLogger } from "../src/utils/loggerConfig.js";

// Import handlers
import { listOrganizations } from "../src/handlers/organizationsHandler.js";
import { listBuckets } from "../src/handlers/bucketsHandler.js";
import { bucketMeasurements } from "../src/handlers/measurementsHandler.js";
import { executeQuery } from "../src/handlers/queryHandler.js";
import { writeData } from "../src/handlers/writeDataTool.js";
import { queryData } from "../src/handlers/queryDataTool.js";
import { createBucket } from "../src/handlers/createBucketTool.js";
import { createOrg } from "../src/handlers/createOrgTool.js";
import { fluxQueryExamplesPrompt } from "../src/prompts/fluxQueryExamplesPrompt.js";
import { lineProtocolGuidePrompt } from "../src/prompts/lineProtocolGuidePrompt.js";

// Configure logger
configureLogger();

// Store session state
const sessions = new Map();

// Generate session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Handle MCP protocol requests
async function handleMcpRequest(request, sessionId) {
  const { method, params, id } = request;

  try {
    switch (method) {
      case "initialize":
        // Store session initialization
        sessions.set(sessionId, { initialized: true });
        
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: true },
              resources: { listChanged: true },
              prompts: { listChanged: true },
              logging: {}
            },
            serverInfo: {
              name: "influxdb-mcp-server",
              version: "0.1.1"
            }
          }
        };
      
      case "notifications/initialized":
        // This is a notification, no response needed
        return null;

      case "ping":
        return {
          jsonrpc: "2.0",
          id,
          result: {}
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "write-data",
                title: "Write Data to InfluxDB",
                description: "Write time-series data to InfluxDB using line protocol format",
                inputSchema: {
                  type: "object",
                  title: "WriteDataInput",
                  description: "Parameters for writing data to InfluxDB",
                  properties: {
                    org: { 
                      type: "string", 
                      title: "Organization",
                      description: "The organization name" 
                    },
                    bucket: { 
                      type: "string", 
                      title: "Bucket",
                      description: "The bucket name" 
                    },
                    data: { 
                      type: "string", 
                      title: "Data",
                      description: "Data in InfluxDB line protocol format" 
                    },
                    precision: { 
                      type: "string", 
                      title: "Precision",
                      enum: ["ns", "us", "ms", "s"],
                      description: "Timestamp precision (ns, us, ms, s)",
                      default: "ns"
                    }
                  },
                  required: ["org", "bucket", "data"],
                  additionalProperties: false
                }
              },
              {
                name: "query-data",
                title: "Query InfluxDB Data",
                description: "Execute Flux queries against InfluxDB to retrieve time-series data",
                inputSchema: {
                  type: "object",
                  title: "QueryDataInput",
                  description: "Parameters for querying InfluxDB",
                  properties: {
                    org: { 
                      type: "string",
                      title: "Organization", 
                      description: "The organization name" 
                    },
                    query: { 
                      type: "string",
                      title: "Query", 
                      description: "Flux query string" 
                    }
                  },
                  required: ["org", "query"],
                  additionalProperties: false
                }
              },
              {
                name: "create-bucket",
                title: "Create InfluxDB Bucket",
                description: "Create a new bucket in InfluxDB for storing time-series data",
                inputSchema: {
                  type: "object",
                  title: "CreateBucketInput",
                  description: "Parameters for creating a bucket",
                  properties: {
                    name: { 
                      type: "string",
                      title: "Bucket Name", 
                      description: "The bucket name" 
                    },
                    orgID: { 
                      type: "string",
                      title: "Organization ID", 
                      description: "The organization ID" 
                    },
                    retentionPeriodSeconds: { 
                      type: "number",
                      title: "Retention Period", 
                      description: "Retention period in seconds (optional)",
                      minimum: 0
                    }
                  },
                  required: ["name", "orgID"],
                  additionalProperties: false
                }
              },
              {
                name: "create-org",
                title: "Create InfluxDB Organization",
                description: "Create a new organization in InfluxDB",
                inputSchema: {
                  type: "object",
                  title: "CreateOrgInput",
                  description: "Parameters for creating an organization",
                  properties: {
                    name: { 
                      type: "string",
                      title: "Organization Name", 
                      description: "The organization name" 
                    },
                    description: { 
                      type: "string",
                      title: "Description", 
                      description: "Organization description (optional)" 
                    }
                  },
                  required: ["name"],
                  additionalProperties: false
                }
              }
            ],
            nextCursor: null
          }
        };

      case "resources/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            resources: [
              {
                uri: "influxdb://orgs",
                name: "Organizations",
                title: "InfluxDB Organizations",
                description: "List all organizations in InfluxDB",
                mimeType: "application/json"
              },
              {
                uri: "influxdb://buckets",
                name: "Buckets",
                title: "InfluxDB Buckets", 
                description: "List all buckets across all organizations",
                mimeType: "application/json"
              }
            ],
            nextCursor: null
          }
        };

      case "prompts/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            prompts: [
              {
                name: "flux-query-examples",
                title: "Flux Query Examples",
                description: "Get examples of common Flux queries for time-series analysis",
                arguments: []
              },
              {
                name: "line-protocol-guide",
                title: "Line Protocol Guide",
                description: "Learn about InfluxDB line protocol format for writing data",
                arguments: []
              }
            ],
            nextCursor: null
          }
        };

      case "tools/call":
        const { name, arguments: args } = params;
        
        // Call the appropriate tool handler
        let result;
        switch (name) {
          case "write-data":
            result = await writeData(args);
            break;
          case "query-data":
            result = await queryData(args);
            break;
          case "create-bucket":
            result = await createBucket(args);
            break;
          case "create-org":
            result = await createOrg(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              }
            ],
            isError: false
          }
        };

      case "resources/read":
        const { uri } = params;
        
        // Handle resource reading
        let resourceResult;
        if (uri === "influxdb://orgs") {
          resourceResult = await listOrganizations();
        } else if (uri === "influxdb://buckets") {
          resourceResult = await listBuckets();
        } else if (uri.startsWith("influxdb://bucket/")) {
          const bucketName = uri.replace("influxdb://bucket/", "").replace("/measurements", "");
          resourceResult = await bucketMeasurements({ bucketName });
        } else if (uri.startsWith("influxdb://query/")) {
          const parts = uri.replace("influxdb://query/", "").split("/");
          const orgName = parts[0];
          const fluxQuery = decodeURIComponent(parts.slice(1).join("/"));
          resourceResult = await executeQuery({ orgName, fluxQuery });
        } else {
          throw new Error(`Unknown resource: ${uri}`);
        }

        return {
          jsonrpc: "2.0",
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(resourceResult, null, 2)
              }
            ]
          }
        };

      case "prompts/get":
        const { name: promptName, arguments: promptArgs } = params;
        
        let promptResult;
        if (promptName === "flux-query-examples") {
          promptResult = await fluxQueryExamplesPrompt();
        } else if (promptName === "line-protocol-guide") {
          promptResult = await lineProtocolGuidePrompt();
        } else {
          throw new Error(`Unknown prompt: ${promptName}`);
        }

        return {
          jsonrpc: "2.0",
          id,
          result: {
            description: promptResult.title,
            messages: [
              {
                role: "assistant",
                content: {
                  type: "text",
                  text: promptResult.content
                }
              }
            ]
          }
        };

      case "logging/setLevel":
        // Handle logging level changes
        return {
          jsonrpc: "2.0",
          id,
          result: {}
        };

      default:
        // Unknown method
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: "Method not found",
            data: { method }
          }
        };
    }
  } catch (error) {
    console.error(`Error handling ${method}:`, error);
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: "Internal error",
        data: error.message
      }
    };
  }
}

// Vercel serverless function handler
export default async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-ID');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET requests (for initial connection test)
  if (req.method === 'GET') {
    return res.status(200).json({
      message: "InfluxDB MCP Server",
      version: "0.1.1",
      mcp: true,
      endpoint: req.url
    });
  }

  // Only allow POST requests for MCP protocol
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Validate environment
    validateEnvironment();

    // Get or create session ID
    let sessionId = req.headers['x-session-id'] || generateSessionId();
    res.setHeader('X-Session-ID', sessionId);

    // Parse request body
    let requests = [];
    const body = req.body;

    // Handle both single request and batch requests
    if (Array.isArray(body)) {
      requests = body;
    } else if (body && typeof body === 'object') {
      requests = [body];
    } else {
      throw new Error('Invalid request body');
    }

    // Process all requests
    const responses = [];
    for (const request of requests) {
      if (!request.jsonrpc || request.jsonrpc !== '2.0') {
        responses.push({
          jsonrpc: "2.0",
          id: request.id || null,
          error: {
            code: -32600,
            message: "Invalid Request",
            data: "Missing or invalid jsonrpc version"
          }
        });
        continue;
      }

      const response = await handleMcpRequest(request, sessionId);
      if (response) {
        responses.push(response);
      }
    }

    // Return response(s)
    if (responses.length === 0) {
      res.status(204).end(); // No content for notifications
    } else if (responses.length === 1 && !Array.isArray(body)) {
      res.status(200).json(responses[0]);
    } else {
      res.status(200).json(responses);
    }
    
  } catch (error) {
    console.error('MCP Server Error:', error);
    
    // Send error response
    res.status(200).json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32603,
        message: "Internal error",
        data: error.message
      }
    });
  }
}
