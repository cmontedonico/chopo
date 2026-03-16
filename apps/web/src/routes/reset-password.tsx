import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "@chopo-v1/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@chopo-v1/ui/components/card";
import { Input } from "@chopo-v1/ui/components/input";
import { Label } from "@chopo-v1/ui/components/label";
import { Activity, ArrowLeft, CheckCircle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {sent ? <CheckCircle className="h-6 w-6" /> : <Activity className="h-6 w-6" />}
          </div>
          <CardTitle className="text-2xl">
            {sent ? "Correo enviado" : "Restablecer contraseña"}
          </CardTitle>
          <CardDescription>
            {sent
              ? "Revisa tu bandeja de entrada para continuar"
              : "Ingresa tu correo y te enviaremos instrucciones"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Hemos enviado un enlace de restablecimiento a <span className="font-medium text-foreground">{email}</span>.
                Si no lo ves, revisa tu carpeta de spam.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                Enviar de nuevo
              </Button>
            </div>
          ) : (
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
              <Button type="submit" className="w-full">
                Enviar instrucciones
              </Button>
            </form>
          )}
          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
