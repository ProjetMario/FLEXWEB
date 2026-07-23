"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/zod";
import { inviteMember } from "@/lib/actions/membership";
import { AlertCircle, Loader2, Check } from "lucide-react";

interface InviteMemberFormProps {
  slug: string;
}

export function InviteMemberForm({ slug }: InviteMemberFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverSuccess, setServerSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { role: "EDITOR" },
  });

  const onSubmit = async (data: InviteMemberInput) => {
    setServerError(null);
    setServerSuccess(null);

    const result = await inviteMember(slug, data);

    if (result.error) {
      setServerError(result.error);
      return;
    }

    setServerSuccess("Membre invité avec succès.");
    reset();
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email du membre</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Rôle</Label>
        <select
          id="role"
          {...register("role")}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="EDITOR">Éditeur</option>
          <option value="ADMIN">Administrateur</option>
        </select>
        {errors.role && (
          <p className="text-xs text-destructive">{errors.role.message}</p>
        )}
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
        Inviter
      </Button>
    </form>
  );
}
