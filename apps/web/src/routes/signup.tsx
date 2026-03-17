import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { Button } from "@chopo-v1/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@chopo-v1/ui/components/card";
import { Input } from "@chopo-v1/ui/components/input";
import { Label } from "@chopo-v1/ui/components/label";
import { Activity } from "lucide-react";

import { PasswordInput } from "@/components/password-input";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (value.password !== value.confirmPassword) {
        toast.error("Las contraseñas no coinciden");
        return;
      }

      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            navigate({ to: "/dashboard" });
            toast.success("Cuenta creada correctamente");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
        email: z.email("Correo electrónico inválido"),
        password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
        confirmPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
      }),
    },
  });

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Crear cuenta</CardTitle>
          <CardDescription>Regístrate para acceder a tus resultados médicos</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Nombre completo</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder="Carlos Montedonico"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Correo electrónico</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    placeholder="tu@email.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Contraseña</Label>
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    placeholder="••••••••"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Confirmar contraseña</Label>
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    placeholder="••••••••"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
              )}
            </form.Subscribe>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Iniciar sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
