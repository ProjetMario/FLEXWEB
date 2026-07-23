import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
        <p className="text-sm text-muted-foreground">
          Connectez-vous à votre espace administrateur
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
