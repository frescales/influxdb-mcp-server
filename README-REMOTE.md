# InfluxDB MCP Server - Remote Version

This is a remote version of the InfluxDB MCP (Model Context Protocol) server that can be deployed to Vercel and used with Claude AI as a remote MCP endpoint.

## Features

- Query InfluxDB data using Flux queries
- Write data to InfluxDB using line protocol
- Create organizations and buckets
- List available resources (organizations, buckets, measurements)
- Provides helpful prompts for Flux queries and line protocol

## Deployment to Vercel

### Prerequisites

1. An InfluxDB instance (cloud or self-hosted)
2. InfluxDB API token with appropriate permissions
3. A Vercel account

### Environment Variables

Set the following environment variables in your Vercel project:

- `INFLUXDB_URL`: Your InfluxDB instance URL (e.g., `https://us-east-1-1.aws.cloud2.influxdata.com`)
- `INFLUXDB_TOKEN`: Your InfluxDB API token

### Deploy to Vercel

1. Fork this repository
2. Connect your fork to Vercel
3. Set the environment variables mentioned above
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffrescales%2Finfluxdb-mcp-server&env=INFLUXDB_URL,INFLUXDB_TOKEN&envDescription=InfluxDB%20connection%20credentials&project-name=influxdb-mcp-server&repository-name=influxdb-mcp-server)

### Using with Claude

Once deployed, you can add this MCP server to Claude using:

```bash
claude mcp add --transport http influxdb https://your-project.vercel.app/api/mcp
```

Or if you need to include authentication:

```bash
claude mcp add --transport http --header "Authorization: Bearer YOUR_TOKEN" influxdb https://your-project.vercel.app/api/mcp
```

## Available Tools

### write-data
Write time-series data to InfluxDB using line protocol format.

**Parameters:**
- `org`: Organization name
- `bucket`: Bucket name
- `data`: Data in InfluxDB line protocol format
- `precision`: (optional) Timestamp precision (ns, us, ms, s)

### query-data
Execute Flux queries against your InfluxDB instance.

**Parameters:**
- `org`: Organization name
- `query`: Flux query string

### create-bucket
Create a new bucket in InfluxDB.

**Parameters:**
- `name`: Bucket name
- `orgID`: Organization ID
- `retentionPeriodSeconds`: (optional) Data retention period in seconds

### create-org
Create a new organization in InfluxDB.

**Parameters:**
- `name`: Organization name
- `description`: (optional) Organization description

## Available Resources

- `influxdb://orgs` - List all organizations
- `influxdb://buckets` - List all buckets
- `influxdb://bucket/{bucketName}/measurements` - List measurements in a bucket
- `influxdb://query/{orgName}/{fluxQuery}` - Execute a Flux query

## Available Prompts

- `flux-query-examples` - Get examples of common Flux queries
- `line-protocol-guide` - Learn about InfluxDB line protocol format

## Development

To run locally:

```bash
npm install
npm start
```

To test the HTTP endpoint locally:

```bash
npm install
vercel dev
```

## Security Considerations

- Always use HTTPS when deploying to production
- Consider implementing authentication if exposing sensitive data
- Use environment variables for all credentials
- Implement rate limiting if necessary

## License

MIT
