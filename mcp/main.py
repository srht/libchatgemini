import asyncio
from fastmcp import FastMCP, Client

mcp = FastMCP("distance_calculator")

@mcp.tool
def calcthedistance(loc1: float, loc2:float) -> float:
    """Calculate the distance between two locations."""
    return f"iki nokta arası mesafe: {abs(loc1 - loc2)}"

client = Client(mcp)

async def call_tool(name: str):
    async with client:
        result = await client.call_tool("distance_calculator", {"loc1": 10.0, "loc2": 20.0})
        print(result)

if __name__ == "__main__":
    mcp.run()