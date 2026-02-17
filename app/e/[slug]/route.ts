import { getBarbershopBySlug } from "@/data/barbershops";
import { NextResponse } from "next/server";

interface GeneralEntryRouteContext {
  params: Promise<{
    slug: string;
  }>;
}

export async function GET(request: Request, context: GeneralEntryRouteContext) {
  const requestUrl = new URL(request.url);
  const { slug } = await context.params;
  const barbershop = await getBarbershopBySlug(slug);

  if (!barbershop) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const exclusiveUrl = new URL(`/exclusive/${barbershop.id}`, request.url);

  requestUrl.searchParams.forEach((value, key) => {
    exclusiveUrl.searchParams.append(key, value);
  });

  if (!exclusiveUrl.searchParams.has("from")) {
    exclusiveUrl.searchParams.set("from", "general_list");
  }

  return NextResponse.redirect(exclusiveUrl);
}
