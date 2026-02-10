"use client";

import { updateBarbershopBranding } from "@/actions/update-barbershop-branding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";

type BrandingSettingsFormProps = {
  barbershopId: string;
  slug: string;
  logoUrl: string | null;
  showInDirectory: boolean;
};

const normalizeSlugValue = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

const BrandingSettingsForm = ({
  barbershopId,
  slug,
  logoUrl,
  showInDirectory,
}: BrandingSettingsFormProps) => {
  const [slugInput, setSlugInput] = useState(slug);
  const [logoUrlInput, setLogoUrlInput] = useState(logoUrl ?? "");
  const [isVisibleInDirectory, setIsVisibleInDirectory] =
    useState(showInDirectory);

  const { executeAsync: executeUpdateBranding, isPending } = useAction(
    updateBarbershopBranding,
  );

  const slugPreview = useMemo(() => normalizeSlugValue(slugInput), [slugInput]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!slugPreview) {
      toast.error("Informe um slug válido para a URL pública.");
      return;
    }

    const result = await executeUpdateBranding({
      barbershopId,
      slug: slugPreview,
      logoUrl: logoUrlInput.trim(),
      showInDirectory: isVisibleInDirectory,
    });

    if (result.validationErrors) {
      toast.error(result.validationErrors._errors?.[0] ?? "Dados inválidos.");
      return;
    }

    if (result.serverError) {
      toast.error("Erro ao salvar branding. Tente novamente.");
      return;
    }

    if (!result.data) {
      toast.error("Erro ao salvar branding. Tente novamente.");
      return;
    }

    setSlugInput(result.data.slug);
    setLogoUrlInput(result.data.logoUrl ?? "");
    setIsVisibleInDirectory(result.data.showInDirectory);
    toast.success("Branding atualizado com sucesso.");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding e URL pública</CardTitle>
        <CardDescription>
          Configure slug, logo e visibilidade no diretório sem criar outro app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="barbershop-slug" className="text-sm font-medium">
              Slug público
            </label>
            <Input
              id="barbershop-slug"
              value={slugInput}
              onChange={(event) => setSlugInput(event.target.value)}
              placeholder="minha-barbearia"
              disabled={isPending}
            />
            <p className="text-muted-foreground text-xs">
              URL: {slugPreview ? `/b/${slugPreview}` : "/b/slug-da-barbearia"}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="barbershop-logo-url" className="text-sm font-medium">
              URL da logo
            </label>
            <Input
              id="barbershop-logo-url"
              type="url"
              value={logoUrlInput}
              onChange={(event) => setLogoUrlInput(event.target.value)}
              placeholder="https://..."
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Aparecer no diretório público</p>
              <p className="text-muted-foreground text-xs">
                Quando desligado, fica fora da Home e listagens gerais.
              </p>
            </div>
            <Switch
              id="show-in-directory-switch"
              checked={isVisibleInDirectory}
              onCheckedChange={setIsVisibleInDirectory}
              disabled={isPending}
            />
          </div>

          <Button type="submit" disabled={isPending || !slugPreview}>
            Salvar branding
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BrandingSettingsForm;
