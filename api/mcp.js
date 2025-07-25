import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServerTransport } from "../src/transports/http.js";
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

// Configure logger and validate environment
configureLogger();

// Create MCP server instance (singleton)
let server;

function getServer() {
  if (!server) {
    server = new McpServer({
      name: "InfluxDB",
      version: "0.1.1",
    });

    // Register resources
    server.resource("orgs", "influxdb://orgs", listOrganizations);
    server.resource("buckets", "influxdb://buckets", listBuckets);
    server.resource(
      "bucket-measurements",
      new ResourceTemplate("influxdb://bucket/{bucketName}/measurements", {
        list: undefined,
      }),
      bucketMeasurements,
    );
    server.resource(
      "query",
      new ResourceTemplate("influxdb://query/{orgName}/{fluxQuery}", {
        list: undefined,
      }),
      executeQuery,
    );

    // Register tools
    server.tool(
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

    server.tool(
      "query-data",
      {
        org: z.string().describe("The organization name"),
        query: z.string().describe("Flux query string"),
      },
      queryData,
    );

    server.tool(
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

    server.tool(
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
    server.prompt("flux-query-examples", {}, fluxQueryExamplesPrompt);
    server.prompt("line-protocol-guide", {}, lineProtocolGuidePrompt);
  }
  
  return server;
}

// Vercel serverless function handler
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Set CORS headers if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Validate environment on each request
    validateEnvironment();

    // Get or create the server instance
    const mcpServer = getServer();
    
    // Create HTTP transport for this request
    const transport = new HttpServerTransport(req, res);
    
    // Connect the server to the transport
    await mcpServer.connect(transport);
    
    // The transport will handle the response
  } catch (error) {
    console.error('MCP Server Error:', error);
    
    // Send error response if not already sent
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: error.message
        }
      });
    }
  }
}
