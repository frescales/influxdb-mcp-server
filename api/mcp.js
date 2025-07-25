import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
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

// Create MCP server instance (singleton)
let server;
let isInitialized = false;

function createServer() {
  const mcpServer = new McpServer({
    name: "InfluxDB",
    version: "0.1.1",
  });

  // Register resources
  mcpServer.resource("orgs", "influxdb://orgs", listOrganizations);
  mcpServer.resource("buckets", "influxdb://buckets", listBuckets);
  mcpServer.resource(
    "bucket-measurements",
    new ResourceTemplate("influxdb://bucket/{bucketName}/measurements", {
      list: undefined,
    }),
    bucketMeasurements,
  );
  mcpServer.resource(
    "query",
    new ResourceTemplate("influxdb://query/{orgName}/{fluxQuery}", {
      list: undefined,
    }),
    executeQuery,
  );

  // Register tools
  mcpServer.tool(
    "write-data",
    {
      org: z.string().describe("The organization name"),
      bucket: z.string().describe("The bucket name"),
      data: z.string().describe("Data in InfluxDB line protocol format"),
      precision: z.enum(["ns", "us", "ms", "s"]).optional().describe(
        "Timestamp precision (ns, us, ms, s)",
      ),
    },
    writeData,
  );

  mcpServer.tool(
    "query-data",
    {
      org: z.string().describe("The organization name"),
      query: z.string().describe("Flux query string"),
    },
    queryData,
  );

  mcpServer.tool(
    "create-bucket",
    {
      name: z.string().describe("The bucket name"),
      orgID: z.string().describe("The organization ID"),
      retentionPeriodSeconds: z.number().optional().describe(
        "Retention period in seconds (optional)",
      ),
    },
    createBucket,
  );

  mcpServer.tool(
    "create-org",
    {
      name: z.string().describe("The organization name"),
      description: z.string().optional().describe(
        "Organization description (optional)",
      ),
    },
    createOrg,
  );

  // Register prompts
  mcpServer.prompt("flux-query-examples", {}, fluxQueryExamplesPrompt);
  mcpServer.prompt("line-protocol-guide", {}, lineProtocolGuidePrompt);

  return mcpServer;
}

// Handle MCP protocol over HTTP
async function handleMcpRequest(request) {
  const { method, params, id } = request;

  if (!server) {
    server = createServer();
  }

  // Mock transport for handling the request
  const mockTransport = {
    responses: [],
    send: async function(response) {
      this.responses.push(response);
    },
    getResponse: function() {
      return this.responses[0] || null;
    }
  };

  // Connect server if not initialized
  if (!isInitialized) {
    await server.connect(mockTransport);
    isInitialized = true;
  }

  // Create a promise to capture the response
  const responsePromise = new Promise((resolve) => {
    const originalSend = mockTransport.send;
    mockTransport.send = async function(response) {
      await originalSend.call(this, response);
      resolve(response);
    };
  });

  // Process the message
  if (server.server && server.server.handleMessage) {
    await server.server.handleMessage(request);
  } else {
    // Fallback: manually handle common methods
    switch (method) {
      case "initialize":
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
                description: "List all organizations"
              },
              {
                uri: "influxdb://buckets",
                name: "Buckets",
                description: "List all buckets"
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

      default:
        // Wait for actual response from server
        const response = await responsePromise;
        return response;
    }
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
    
    // Send response
    res.status(200).json(response);
    
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
