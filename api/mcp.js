// MCP Server for InfluxDB - Compatible with Claude.ai
import { validateEnvironment } from "../src/config/env.js";
import { configureLogger } from "../src/utils/loggerConfig.js";

// Import handlers
import { listOrganizations } from "../src/handlers/organizationsHandler.js";
import { listBuckets } from "../src/handlers/bucketsHandler.js";
import { writeData } from "../src/handlers/writeDataTool.js";
import { queryData } from "../src/handlers/queryDataTool.js";
import { createBucket } from "../src/handlers/createBucketTool.js";
import { createOrg } from "../src/handlers/createOrgTool.js";

// Configure logger
configureLogger();

const CAPABILITIES = {
  tools: {},
  resources: {},
  prompts: {}
};

const SERVER_INFO = {
  name: "influxdb-mcp-server",
  version: "1.0.0"
};

const TOOLS = [
  {
    name: "write-data",
    description: "Write time-series data to InfluxDB using line protocol format",
    inputSchema: {
      type: "object",
      properties: {
        org: { 
          type: "string", 
          description: "The InfluxDB organization name" 
        },
        bucket: { 
          type: "string", 
          description: "The InfluxDB bucket name" 
        },
        data: { 
          type: "string", 
          description: "Data in InfluxDB line protocol format (e.g., 'measurement,tag1=value1 field1=10 1609459200000000000')" 
        },
        precision: { 
          type: "string", 
          enum: ["ns", "us", "ms", "s"],
          description: "Timestamp precision (ns=nanoseconds, us=microseconds, ms=milliseconds, s=seconds)",
          default: "ns"
        }
      },
      required: ["org", "bucket", "data"]
    }
  },
  {
    name: "query-data",
    description: "Execute Flux queries against InfluxDB to retrieve time-series data",
    inputSchema: {
      type: "object",
      properties: {
        org: { 
          type: "string",
          description: "The InfluxDB organization name" 
        },
        query: { 
          type: "string",
          description: "Flux query string (e.g., 'from(bucket:\"mybucket\") |> range(start: -1h)')" 
        }
      },
      required: ["org", "query"]
    }
  },
  {
    name: "create-bucket",
    description: "Create a new bucket in InfluxDB for storing time-series data",
    inputSchema: {
      type: "object",
      properties: {
        name: { 
          type: "string",
          description: "The name for the new bucket" 
        },
        orgID: { 
          type: "string",
          description: "The organization ID where the bucket will be created" 
        },
        retentionPeriodSeconds: { 
          type: "number",
          description: "Data retention period in seconds (0 for infinite retention)",
          minimum: 0
        }
      },
      required: ["name", "orgID"]
    }
  },
  {
    name: "create-org",
    description: "Create a new organization in InfluxDB",
    inputSchema: {
      type: "object",
      properties: {
        name: { 
          type: "string",
          description: "The name for the new organization" 
        },
        description: { 
          type: "string",
          description: "Optional description for the organization" 
        }
      },
      required: ["name"]
    }
  }
];

const RESOURCES = [
  {
    uri: "influxdb://orgs",
    name: "Organizations",
    description: "List all organizations in your InfluxDB instance",
    mimeType: "application/json"
  },
  {
    uri: "influxdb://buckets",
    name: "Buckets",
    description: "List all buckets across all organizations",
    mimeType: "application/json"
  }
];

// SSE helper
function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// JSON-RPC helper
function createResponse(id, result, error) {
  const response = {
    jsonrpc: "2.0",
    id
  };
  
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  
  return response;
}

// Handle JSON-RPC requests
async function handleRequest(request) {
  const { method, params, id } = request;
  
  try {
    switch (method) {
      case "initialize":
        return createResponse(id, {
          protocolVersion: "2024-11-05",
          capabilities: CAPABILITIES,
          serverInfo: SERVER_INFO
        });
        
      case "initialized":
        // Notification, no response
        return null;
        
      case "tools/list":
        return createResponse(id, { tools: TOOLS });
        
      case "resources/list":
        return createResponse(id, { resources: RESOURCES });
        
      case "prompts/list":
        return createResponse(id, { prompts: [] });
        
      case "tools/call":
        const { name, arguments: args } = params;
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
        
        return createResponse(id, {
          content: [{
            type: "text",
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }]
        });
        
      case "resources/read":
        const { uri } = params;
        let data;
        
        if (uri === "influxdb://orgs") {
          data = await listOrganizations();
        } else if (uri === "influxdb://buckets") {
          data = await listBuckets();
        } else {
          throw new Error(`Unknown resource: ${uri}`);
        }
        
        return createResponse(id, {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify(data, null, 2)
          }]
        });
        
      default:
        return createResponse(id, null, {
          code: -32601,
          message: "Method not found"
        });
    }
  } catch (error) {
    return createResponse(id, null, {
      code: -32603,
      message: "Internal error",
      data: error.message
    });
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Validate environment
    validateEnvironment();
    
    // SSE endpoint
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      
      // Send initial ready message
      sendSSE(res, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      });
      
      // Keep alive
      const pingInterval = setInterval(() => {
        res.write(': ping\n\n');
      }, 30000);
      
      req.on('close', () => {
        clearInterval(pingInterval);
      });
      
      return;
    }
    
    // JSON-RPC endpoint
    if (req.method === 'POST') {
      const response = await handleRequest(req.body);
      
      if (response) {
        return res.status(200).json(response);
      } else {
        return res.status(204).end();
      }
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