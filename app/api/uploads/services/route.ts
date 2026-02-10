import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE_IN_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const FILE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json(
      {
        error: "Não autorizado.",
      },
      { status: 401 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const barbershopId = formData.get("barbershopId");

  if (typeof barbershopId !== "string" || barbershopId.length === 0) {
    return NextResponse.json(
      {
        error: "Barbearia inválida.",
      },
      { status: 400 },
    );
  }

  const barbershop = await prisma.barbershop.findFirst({
    where: {
      id: barbershopId,
      ownerId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!barbershop) {
    return NextResponse.json(
      {
        error: "Barbearia não encontrada ou sem permissão de edição.",
      },
      { status: 403 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        error: "Arquivo inválido.",
      },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        error: "Formato de imagem inválido. Use PNG, JPG ou WEBP.",
      },
      { status: 400 },
    );
  }

  if (file.size < 1 || file.size > MAX_FILE_SIZE_IN_BYTES) {
    return NextResponse.json(
      {
        error: "A imagem deve ter até 5MB.",
      },
      { status: 400 },
    );
  }

  const fileExtension = FILE_EXTENSION_BY_MIME_TYPE[file.type];
  const fileName = `${randomUUID()}.${fileExtension}`;
  const uploadsDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "services",
  );
  const filePath = path.join(uploadsDirectory, fileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await mkdir(uploadsDirectory, { recursive: true });
  await writeFile(filePath, fileBuffer);

  return NextResponse.json({
    url: `/uploads/services/${fileName}`,
  });
}
