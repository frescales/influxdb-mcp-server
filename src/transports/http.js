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
  }

  async start() {
    // Process the incoming request
    const requestBody = this.req.body;
    
    if (!requestBody || typeof requestBody !== 'object') {
      throw new Error('Invalid request body');
    }

    // The request body should be a JSON-RPC message
    if (!requestBody.jsonrpc || requestBody.jsonrpc !== '2.0') {
      throw new Error('Invalid JSON-RPC version');
    }

    // Emit the message to be processed by the server
    if (this.onmessage) {
      await this.onmessage(requestBody);
    }
  }

  async send(message) {
    // Send the response back to the client
    if (!this.responsesSent && !this.res.headersSent) {
      this.responsesSent = true;
      
      // For streaming responses, we could implement chunked transfer
      // For now, we'll send complete responses
      this.res.status(200).json(message);
    }
  }

  async close() {
    // Ensure the response is sent if not already
    if (!this.responsesSent && !this.res.headersSent) {
      this.res.status(200).end();
    }
  }

  // Event handlers - these will be set by the MCP server
  onmessage = null;
  onclose = null;
  onerror = null;
}
