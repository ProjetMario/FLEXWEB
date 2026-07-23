"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { editPageSchema, type EditPageInput } from "@/lib/zod";
import { updatePage } from "@/lib/actions/pages";
import { Check, Loader2 } from "lucide-react";

interface PageValues {
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isHomepage: boolean;
  metaTitle: string;
  metaDescription: string;
}

interface EditPageFormProps {
  slug: string;
  pageId: string;
  page: PageValues;
}

export function EditPageForm({ slug, pageId, page }: EditPageFormProps) {
  const router = useRouter();
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditPageInput>({
    resolver: zodResolver(editPageSchema),
    defaultValues: {
      title: page.title,
      status: page.status,
      isHomepage: page.isHomepage,
      metaTitle: page.metaTitle || undefined,
      metaDescription: page.metaDescription || undefined,
    },
  });

  const onSubmit = async (data: EditPageInput) => {
    setServerSuccess(null);
    await updatePage(slug, pageId, data);
    setServerSuccess("Page mise à jour.");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Titre</Label>
        <Input id="title" {...register("title")} />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Statut</Label>
        <select
          id="status"
          {...register("status")}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="DRAFT">Brouillon</option>
          <option value="PUBLISHED">Publié</option>
          <option value="ARCHIVED">Archivé</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isHomepage"
          type="checkbox"
          {...register("isHomepage")}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor="isHomepage" className="font-normal">
          Page d&apos;accueil
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="metaTitle">Méta titre</Label>
        <Input id="metaTitle" {...register("metaTitle")} />
        {errors.metaTitle && (
          <p className="text-xs text-destructive">{errors.metaTitle.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="metaDescription">Méta description</Label>
        <Input id="metaDescription" {...register("metaDescription")} />
        {errors.metaDescription && (
          <p className="text-xs text-destructive">{errors.metaDescription.message}</p>
        )}
      </div>

      {serverSuccess && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-100 p-3 text-sm text-emerald-800">
          <Check className="h-4 w-4" />
          {serverSuccess}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer
      </Button>
    </form>
  );
}
