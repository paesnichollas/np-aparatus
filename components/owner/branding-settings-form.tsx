"use client";

import { updateBarbershopBranding } from "@/actions/update-barbershop-branding";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ImageUploader from "@/components/ui/image-uploader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_BANNER_IMAGE_URL } from "@/lib/default-images";
import {
  BR_PHONE_MAX_LENGTH,
  BR_PHONE_MIN_LENGTH,
  formatPhoneBRDisplay,
  formatPhoneListBRInput,
  formatPhonesInput,
  isValidPhoneDigits,
  parsePhoneListToDigits,
} from "@/lib/phone";
import { normalizePublicSlug } from "@/lib/public-slug";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type BrandingSettingsFormProps = {
  barbershopId: string;
  name: string;
  description: string;
  address: string;
  phones: string[];
  imageUrl: string | null;
  slug: string;
  shareLink: string;
};

const BrandingSettingsForm = ({
  barbershopId,
  name,
  description,
  address,
  phones,
  imageUrl,
  slug,
  shareLink,
}: BrandingSettingsFormProps) => {
  const router = useRouter();
  const [nameInput, setNameInput] = useState(name);
  const [descriptionInput, setDescriptionInput] = useState(description);
  const [addressInput, setAddressInput] = useState(address);
  const [phonesInput, setPhonesInput] = useState(formatPhonesInput(phones));
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    imageUrl,
  );
  const [slugInput, setSlugInput] = useState(slug);
  const [isUploadingBackgroundImage, setIsUploadingBackgroundImage] =
    useState(false);

  const { executeAsync: executeUpdateBranding, isPending } = useAction(
    updateBarbershopBranding,
  );

  const isFormBusy = isPending || isUploadingBackgroundImage;
  const slugPreview = useMemo(() => normalizePublicSlug(slugInput), [slugInput]);

  const handleCopyShareLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    toast.success("Link copiado com sucesso.");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isUploadingBackgroundImage) {
      toast.error("Aguarde o envio da imagem do banner finalizar.");
      return;
    }

    if (!slugPreview) {
      toast.error("Informe um slug válido para a URL pública.");
      return;
    }

    const parsedPhonesDigits = parsePhoneListToDigits(phonesInput);

    if (parsedPhonesDigits.length === 0) {
      toast.error("Informe pelo menos um telefone de contato.");
      return;
    }

    if (parsedPhonesDigits.some((phoneDigits) => !isValidPhoneDigits(phoneDigits))) {
      toast.error("Informe telefones válidos com DDD (10 ou 11 digitos).");
      return;
    }

    const parsedPhones = parsedPhonesDigits
      .map((phoneDigits) => formatPhoneBRDisplay(phoneDigits))
      .filter((phone) => phone.length > 0);

    const result = await executeUpdateBranding({
      barbershopId,
      name: nameInput.trim(),
      description: descriptionInput.trim(),
      address: addressInput.trim(),
      phones: parsedPhones,
      imageUrl: backgroundImageUrl?.trim() ?? null,
      slug: slugPreview,
    });

    if (result.validationErrors) {
      toast.error(result.validationErrors._errors?.[0] ?? "Dados inválidos.");
      return;
    }

    if (result.serverError || !result.data) {
      toast.error("Erro ao salvar configurações. Tente novamente.");
      return;
    }

    setNameInput(result.data.name);
    setDescriptionInput(result.data.description);
    setAddressInput(result.data.address);
    setPhonesInput(formatPhonesInput(result.data.phones));
    setBackgroundImageUrl(result.data.imageUrl);
    setSlugInput(result.data.slug);
    toast.success("Dados da barbearia atualizados com sucesso.");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados da barbearia</CardTitle>
        <CardDescription>
          Atualize nome, descrição, endereço, contato e banner da barbearia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="barbershop-name" className="text-sm font-medium">
              Nome da barbearia
            </label>
            <Input
              id="barbershop-name"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Nome da barbearia"
              disabled={isFormBusy}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="barbershop-description" className="text-sm font-medium">
              Descrição
            </label>
            <Textarea
              id="barbershop-description"
              value={descriptionInput}
              onChange={(event) => setDescriptionInput(event.target.value)}
              placeholder="Descreva os diferenciais da sua barbearia"
              rows={4}
              disabled={isFormBusy}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="barbershop-address" className="text-sm font-medium">
              Endereço
            </label>
            <Input
              id="barbershop-address"
              value={addressInput}
              onChange={(event) => setAddressInput(event.target.value)}
              placeholder="Rua, numero, bairro, cidade"
              disabled={isFormBusy}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="barbershop-phones" className="text-sm font-medium">
              Telefones de contato
            </label>
            <Input
              id="barbershop-phones"
              value={phonesInput}
              onChange={(event) =>
                setPhonesInput(formatPhoneListBRInput(event.target.value))
              }
              placeholder="(11) 99999-9999, (11) 98888-7777"
              disabled={isFormBusy}
            />
            <p className="text-muted-foreground text-xs">
              Use virgula, ponto e virgula ou quebra de linha para separar.
            </p>
          </div>

          <ImageUploader
            value={backgroundImageUrl}
            onChange={setBackgroundImageUrl}
            previewFallbackUrl={DEFAULT_BANNER_IMAGE_URL}
            label="Banner da barbearia"
            previewAlt={nameInput.trim() || "Preview do banner"}
            barbershopId={barbershopId}
            disabled={isPending}
            helperText="O banner é enviado via UploadThing e salvo como URL. Sem upload, uma imagem padrão será aplicada."
            emptyText="Sem banner para preview."
            onUploadingChange={setIsUploadingBackgroundImage}
          />

          <div className="space-y-2">
            <label htmlFor="barbershop-slug" className="text-sm font-medium">
              Slug público
            </label>
            <Input
              id="barbershop-slug"
              value={slugInput}
              onChange={(event) => setSlugInput(event.target.value)}
              placeholder="minha-barbearia"
              disabled={isFormBusy}
            />
            <p className="text-muted-foreground text-xs">
              Esse slug é usado na rota por slug da barbearia.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="barbershop-share-link" className="text-sm font-medium">
              Link de compartilhamento
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="barbershop-share-link"
                value={shareLink}
                readOnly
                disabled={isFormBusy}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyShareLink}
                disabled={isFormBusy}
                className="gap-2"
              >
                <Copy className="size-4" />
                Copiar link
              </Button>
            </div>
          </div>

          <Button type="submit" disabled={isFormBusy || !slugPreview}>
            Salvar dados da barbearia
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BrandingSettingsForm;
