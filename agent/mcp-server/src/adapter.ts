import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDefinition } from "claw-wallet";

export function registerTools(server: McpServer, tools: ToolDefinition[]): void {
  for (const tool of tools) {
    const inputSchema = tool.parameters as {
      type: "object";
      properties?: Record<string, unknown>;
      required?: string[];
    };

    server.tool(
      tool.name,
      tool.description,
      inputSchema.properties ?? {},
      async (args: Record<string, unknown>) => {
        const result = await tool.execute(args);
        const resultObj = result as Record<string, unknown>;
        const isError = "error" in resultObj;
        return {
          isError,
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
    );
  }
}
