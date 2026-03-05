export const config = {
  runtime: "edge",
};

declare const process: { env: Record<string, string | undefined> };

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { password } = await request.json();
    const correctPassword = process.env.AUTH_PASSWORD;

    if (!correctPassword) {
      return new Response(JSON.stringify({ error: "Auth not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (password === correctPassword) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
