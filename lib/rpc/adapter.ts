export async function handleRestRequest<T = unknown>(
  handler: (args: { input: Record<string, unknown>; context: Record<string, unknown> }) => Promise<T>,
  request: Request
) {
  try {
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const method = request.method.toUpperCase();

    const body =
      method === "GET" || method === "DELETE"
        ? {}
        : await request.json().catch(() => ({}));

    const result = await handler({
      input: { ...query, ...body },
      context: {},
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
