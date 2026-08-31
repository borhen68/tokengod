export function POST() {
  return Response.json({ error: "Use the paid bubble checkout." }, { status: 410 });
}
