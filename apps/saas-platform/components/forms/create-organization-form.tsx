"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createOrganizationSchema,
  type CreateOrganizationInput,
} from "@/lib/zod";
import { createOrganization } from "@/lib/actions/organization";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
  });

  const onSubmit = async (data: CreateOrganizationInput) => {
    setError(null);
    const result = await createOrganization(data);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push(`/dashboard/${result.organization?.slug}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom de l&apos;entreprise</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Sous-domaine</Label>
        <Input id="slug" {...register("slug")} placeholder="mon-entreprise" />
        {errors.slug && (
          <p className="text-xs text-destructive">{errors.slug.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessType">Type d&apos;activité</Label>
        <Input
          id="businessType"
          list="businessTypes"
          {...register("businessType")}
          placeholder="artisan"
        />
        <datalist id="businessTypes">
          <option value="artisan" />
          <option value="restaurant" />
          <option value="commerce" />
          <option value="consultant" />
          <option value="coach" />
          <option value="agence" />
          <option value="association" />
          <option value="profession-liberale" />
          <option value="immobilier" />
          <option value="evenementiel" />
          <option value="sante" />
          <option value="services" />
          <option value="autre" />
        </datalist>
        {errors.businessType && (
          <p className="text-xs text-destructive">{errors.businessType.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="adminEmail">Email de l&apos;administrateur</Label>
        <Input id="adminEmail" type="email" {...register("adminEmail")} />
        {errors.adminEmail && (
          <p className="text-xs text-destructive">{errors.adminEmail.message}</p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Créer l&apos;organisation
      </Button>
    </form>
  );
}
