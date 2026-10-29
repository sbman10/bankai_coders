import { NextResponse } from "next/server";
import { searchProductImage } from "@/lib/ecommerce/image-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required." },
        { status: 400 }
      );
    }

    const brand = searchParams.get("brand")?.trim() || null;
    const model = searchParams.get("model")?.trim() || null;
    const category = searchParams.get("category")?.trim() || null;

    const result = await searchProductImage({
      name: q,
      brand,
      model,
      category,
    });

    if (!result) {
      return NextResponse.json({
        success: false,
        imageUrl: null,
      });
    }

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      title: result.title,
      source: result.source,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search product image.",
      },
      { status: 500 }
    );
  }
}

