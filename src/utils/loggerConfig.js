// Logger configuration for different environments
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

export function configureLogger() {
  // In Vercel/serverless environments, keep standard console behavior
  if (isVercel) {
    // console.log and console.error work normally in Vercel
    return;
  }
  
  // For local MCP server (stdio transport), redirect to stderr
  console.log = function() {
    process.stderr.write("[INFO] " + Array.from(arguments).join(" ") + "\n");
  };

  console.error = function() {
    process.stderr.write("[ERROR] " + Array.from(arguments).join(" ") + "\n");
  };
}
