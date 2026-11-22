import { dispatch } from "@/server/mobile/router";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type P = { params: Promise<{ path: string[] }> };
const handle = async (req: Request, ctx: P) => dispatch(req, (await ctx.params).path);

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
