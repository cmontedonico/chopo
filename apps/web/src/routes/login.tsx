import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@chopo-v1/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@chopo-v1/ui/components/card";
import { Input } from "@chopo-v1/ui/components/input";
import { Label } from "@chopo-v1/ui/components/label";
import { Activity } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/app" });
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Chopo Health</CardTitle>
          <CardDescription>Ingresa a tu cuenta para ver tus resultados</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Link to="/reset-password" className="text-sm text-muted-foreground hover:text-primary">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Iniciar sesión
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Crear cuenta
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
