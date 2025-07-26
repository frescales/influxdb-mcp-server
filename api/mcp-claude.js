// MCP Server for InfluxDB - Fixed for Claude.ai Web Interface
// Based on research document findings for remote MCP servers

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
  name: "influxdb_mcp_server", // Fixed: underscore instead of hyphen
  version: "1.0.0"
};

// CRITICAL FIX: Tool names must follow pattern ^[a-zA-Z0-9_-]{1,64}$
// Changed all hyphens to underscores for Claude.ai compatibility
const TOOLS = [
  {
    name: "write_data", // Fixed: underscore instead of hyphen
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
    name: "query_data", // Fixed: underscore instead of hyphen
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
    name: "create_bucket", // Fixed: underscore instead of hyphen
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
    name: "create_org", // Fixed: underscore instead of hyphen
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
        
        // Map new tool names to old handler functions
        switch (name) {
          case "write_data":
            result = await writeData(args);
            break;
          case "query_data":
            result = await queryData(args);
            break;
          case "create_bucket":
            result = await createBucket(args);
            break;
          case "create_org":
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

// Generate cryptographically secure session ID
function generateSessionId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default async function handler(req, res) {
  // Required CORS headers for Claude.ai
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Add MCP-Protocol-Version header (required as of 2025-06-18)
  res.setHeader('MCP-Protocol-Version', '2024-11-05');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Validate environment
    validateEnvironment();
    
    // Streamable HTTP endpoint (preferred by Claude.ai)
    if (req.method === 'POST' && req.headers.accept?.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      
      // Generate session ID
      const sessionId = generateSessionId();
      
      // Process the request
      const response = await handleRequest(req.body);
      
      if (response) {
        sendSSE(res, response);
      }
      
      // Send completion marker
      res.write('\n\n');
      res.end();
      return;
    }
    
    // Legacy SSE endpoint for backward compatibility
    if (req.method === 'GET' && req.url.includes('/sse')) {
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
      
      // Keep alive with shorter interval (10s to prevent Claude.ai timeout)
      const pingInterval = setInterval(() => {
        res.write(': ping\n\n');
      }, 10000);
      
      req.on('close', () => {
        clearInterval(pingInterval);
      });
      
      return;
    }
    
    // Standard JSON-RPC endpoint
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
