// Standard Node.js handler for Claude.ai MCP remote server
import { validateEnvironment } from "../src/config/env.js";
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

// Main handler
export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Validate environment
    validateEnvironment();

    // Handle GET requests - SSE endpoint for Claude.ai
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Send initial connection ready message
      const message = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      };
      
      res.write(`data: ${JSON.stringify(message)}\n\n`);
      
      // Keep connection alive with periodic pings
      const interval = setInterval(() => {
        res.write(': ping\n\n');
      }, 30000);
      
      // Clean up on client disconnect
      req.on('close', () => {
        clearInterval(interval);
        res.end();
      });
      
      return;
    }

    // Handle POST requests - JSON-RPC
    if (req.method === 'POST') {
      const body = req.body;
      const { method, params, id } = body;

      let result;
      let error;

      try {
        switch (method) {
          case "initialize":
            result = {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
                resources: {},
                prompts: {},
              },
              serverInfo: {
                name: "influxdb-mcp-server",
                version: "1.0.0"
              }
            };
            break;

          case "initialized":
            // Client notification, no response needed
            return res.status(204).end();

          case "tools/list":
            result = {
              tools: [
                {
                  name: "write-data",
                  description: "Write time-series data to InfluxDB",
                  inputSchema: {
                    type: "object",
                    properties: {
                      org: { type: "string", description: "Organization name" },
                      bucket: { type: "string", description: "Bucket name" },
                      data: { type: "string", description: "Data in line protocol format" },
                      precision: { 
                        type: "string", 
                        enum: ["ns", "us", "ms", "s"],
                        description: "Timestamp precision" 
                      }
                    },
                    required: ["org", "bucket", "data"]
                  }
                },
                {
                  name: "query-data",
                  description: "Execute Flux queries against InfluxDB",
                  inputSchema: {
                    type: "object",
                    properties: {
                      org: { type: "string", description: "Organization name" },
                      query: { type: "string", description: "Flux query" }
                    },
                    required: ["org", "query"]
                  }
                },
                {
                  name: "create-bucket",
                  description: "Create a new bucket in InfluxDB",
                  inputSchema: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Bucket name" },
                      orgID: { type: "string", description: "Organization ID" },
                      retentionPeriodSeconds: { type: "number", description: "Retention period" }
                    },
                    required: ["name", "orgID"]
                  }
                },
                {
                  name: "create-org",
                  description: "Create a new organization",
                  inputSchema: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Organization name" },
                      description: { type: "string", description: "Description" }
                    },
                    required: ["name"]
                  }
                }
              ]
            };
            break;

          case "resources/list":
            result = {
              resources: [
                {
                  uri: "influxdb://orgs",
                  name: "Organizations",
                  description: "List all organizations",
                  mimeType: "application/json"
                },
                {
                  uri: "influxdb://buckets",
                  name: "Buckets",
                  description: "List all buckets",
                  mimeType: "application/json"
                }
              ]
            };
            break;

          case "prompts/list":
            result = {
              prompts: [
                {
                  name: "flux-query-examples",
                  description: "Get examples of common Flux queries"
                },
                {
                  name: "line-protocol-guide",
                  description: "Learn about InfluxDB line protocol format"
                }
              ]
            };
            break;

          case "tools/call":
            const { name, arguments: args } = params;
            
            let toolResult;
            switch (name) {
              case "write-data":
                toolResult = await writeData(args);
                break;
              case "query-data":
                toolResult = await queryData(args);
                break;
              case "create-bucket":
                toolResult = await createBucket(args);
                break;
              case "create-org":
                toolResult = await createOrg(args);
                break;
              default:
                throw new Error(`Unknown tool: ${name}`);
            }

            result = {
              content: [
                {
                  type: "text",
                  text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)
                }
              ]
            };
            break;

          case "resources/read":
            const { uri } = params;
            
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

            result = {
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: JSON.stringify(resourceResult, null, 2)
                }
              ]
            };
            break;

          case "prompts/get":
            const { name: promptName } = params;
            
            let promptResult;
            if (promptName === "flux-query-examples") {
              promptResult = await fluxQueryExamplesPrompt();
            } else if (promptName === "line-protocol-guide") {
              promptResult = await lineProtocolGuidePrompt();
            } else {
              throw new Error(`Unknown prompt: ${promptName}`);
            }

            result = {
              messages: [
                {
                  role: "assistant",
                  content: {
                    type: "text",
                    text: promptResult.content
                  }
                }
              ]
            };
            break;

          default:
            error = {
              code: -32601,
              message: "Method not found"
            };
        }
      } catch (e) {
        error = {
          code: -32603,
          message: "Internal error",
          data: e.message
        };
      }

      const response = {
        jsonrpc: "2.0",
        id
      };

      if (error) {
        response.error = error;
      } else {
        response.result = result;
      }

      return res.status(200).json(response);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal server error",
        data: error.message
      }
    });
  }
}
