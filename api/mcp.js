import { z } from "zod";

// Import config
import { validateEnvironment } from "../src/config/env.js";

// Import utilities
import { configureLogger } from "../src/utils/loggerConfig.js";

// Import resource handlers
import { listOrganizations } from "../src/handlers/organizationsHandler.js";
import { listBuckets } from "../src/handlers/bucketsHandler.js";
import { bucketMeasurements } from "../src/handlers/measurementsHandler.js";
import { executeQuery } from "../src/handlers/queryHandler.js";

// Import tool handlers
import { writeData } from "../src/handlers/writeDataTool.js";
import { queryData } from "../src/handlers/queryDataTool.js";
import { createBucket } from "../src/handlers/createBucketTool.js";
import { createOrg } from "../src/handlers/createOrgTool.js";

// Import prompt handlers
import { fluxQueryExamplesPrompt } from "../src/prompts/fluxQueryExamplesPrompt.js";
import { lineProtocolGuidePrompt } from "../src/prompts/lineProtocolGuidePrompt.js";

// Configure logger
configureLogger();

// Store initialization state
let initialized = false;

// Handle MCP protocol requests directly
async function handleMcpRequest(request) {
  const { method, params, id } = request;

  try {
    switch (method) {
      case "initialize":
        initialized = true;
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: false },
              resources: { listChanged: false },
              prompts: { listChanged: false }
            },
            serverInfo: {
              name: "InfluxDB",
              version: "0.1.1"
            }
          }
        };
      
      case "notifications/initialized":
        // This is a notification, no response needed
        return null;

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "write-data",
                title: "Write Data",
                description: "Write time-series data to InfluxDB",
                inputSchema: {
                  type: "object",
                  properties: {
                    org: { type: "string", description: "The organization name" },
                    bucket: { type: "string", description: "The bucket name" },
                    data: { type: "string", description: "Data in InfluxDB line protocol format" },
                    precision: { 
                      type: "string", 
                      enum: ["ns", "us", "ms", "s"],
                      description: "Timestamp precision (ns, us, ms, s)" 
                    }
                  },
                  required: ["org", "bucket", "data"]
                }
              },
              {
                name: "query-data",
                title: "Query Data",
                description: "Execute Flux queries against InfluxDB",
                inputSchema: {
                  type: "object",
                  properties: {
                    org: { type: "string", description: "The organization name" },
                    query: { type: "string", description: "Flux query string" }
                  },
                  required: ["org", "query"]
                }
              },
              {
                name: "create-bucket",
                title: "Create Bucket",
                description: "Create a new bucket in InfluxDB",
                inputSchema: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "The bucket name" },
                    orgID: { type: "string", description: "The organization ID" },
                    retentionPeriodSeconds: { 
                      type: "number", 
                      description: "Retention period in seconds (optional)" 
                    }
                  },
                  required: ["name", "orgID"]
                }
              },
              {
                name: "create-org",
                title: "Create Organization",
                description: "Create a new organization in InfluxDB",
                inputSchema: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "The organization name" },
                    description: { type: "string", description: "Organization description (optional)" }
                  },
                  required: ["name"]
                }
              }
            ]
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
                description: "Get examples of common Flux queries"
              },
              {
                name: "line-protocol-guide",
                title: "Line Protocol Guide",
                description: "Learn about InfluxDB line protocol format"
              }
            ]
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
            ]
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
        const { name: promptName } = params;
        
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

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
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
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  try {
    // Validate environment
    validateEnvironment();

    // Get request body
    const request = req.body;
    
    if (!request || typeof request !== 'object') {
      throw new Error('Invalid request body');
    }

    if (!request.jsonrpc || request.jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC version');
    }

    // Handle the MCP request
    const response = await handleMcpRequest(request);
    
    // Send response (notifications don't get responses)
    if (response) {
      res.status(200).json(response);
    } else {
      res.status(200).end();
    }
    
  } catch (error) {
    console.error('MCP Server Error:', error);
    
    // Send error response
    res.status(200).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: "Internal error",
        data: error.message
      }
    });
  }
}
