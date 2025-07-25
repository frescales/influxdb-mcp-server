/**
 * HTTP Server Transport for MCP
 * 
 * This transport allows the MCP server to communicate over HTTP,
 * enabling deployment as a remote server (e.g., on Vercel).
 */

export class HttpServerTransport {
  constructor(req, res) {
    this.req = req;
    this.res = res;
    this.responsesSent = false;
    this._messageBuffer = [];
    
    // Bind methods to ensure correct 'this' context
    this.start = this.start.bind(this);
    this.send = this.send.bind(this);
    this.close = this.close.bind(this);
  }

  async start() {
    // Process the incoming request body immediately
    try {
      const requestBody = this.req.body;
      
      if (!requestBody || typeof requestBody !== 'object') {
        throw new Error('Invalid request body');
      }

      // The request body should be a JSON-RPC message
      if (!requestBody.jsonrpc || requestBody.jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC version');
      }

      // Store the message for processing
      this._messageBuffer.push(requestBody);
      
      // Process buffered messages
      while (this._messageBuffer.length > 0) {
        const message = this._messageBuffer.shift();
        if (this.onmessage) {
          await this.onmessage(message);
        }
      }
    } catch (error) {
      if (this.onerror) {
        this.onerror(error);
      } else {
        throw error;
      }
    }
  }

  async send(message) {
    // Send the response back to the client
    if (!this.responsesSent && !this.res.headersSent) {
      this.responsesSent = true;
      
      // Ensure we have a valid JSON-RPC response
      const response = {
        jsonrpc: "2.0",
        ...message
      };
      
      this.res.status(200).json(response);
    }
  }

  async close() {
    // Ensure the response is sent if not already
    if (!this.responsesSent && !this.res.headersSent) {
      this.res.status(200).json({
        jsonrpc: "2.0",
        result: null
      });
    }
    
    if (this.onclose) {
      this.onclose();
    }
  }

  // Event handlers - these will be set by the MCP server
  onmessage = null;
  onclose = null;
  onerror = null;
}
