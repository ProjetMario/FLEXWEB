"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPageSchema, type CreatePageInput } from "@/lib/zod";
import { createPage } from "@/lib/actions/pages";
import { AlertCircle, Loader2, Check } from "lucide-react";

interface CreatePageFormProps {
  slug: string;
}

export function CreatePageForm({ slug }: CreatePageFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePageInput>({
    resolver: zodResolver(createPageSchema),
    defaultValues: { isHomepage: false },
  });

  const onSubmit = async (data: CreatePageInput) => {
    setServerError(null);
    setServerSuccess(null);

    const result = await createPage(slug, data);

    if (result.error) {
      setServerError(result.error);
      return;
    }

    setServerSuccess("Page créée avec succès.");
    reset();
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
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" {...register("slug")} placeholder="ma-page" />
        {errors.slug && (
          <p className="text-xs text-destructive">{errors.slug.message}</p>
        )}
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

      {serverError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {serverError}
        </div>
      )}

      {serverSuccess && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-100 p-3 text-sm text-emerald-800">
          <Check className="h-4 w-4" />
          {serverSuccess}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Créer la page
      </Button>
    </form>
  );
}
