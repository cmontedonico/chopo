import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { Badge } from "@chopo-v1/ui/components/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@chopo-v1/ui/components/select";
import { Separator } from "@chopo-v1/ui/components/separator";
import { SidebarTrigger } from "@chopo-v1/ui/components/sidebar";
import { Skeleton } from "@chopo-v1/ui/components/skeleton";
import { Textarea } from "@chopo-v1/ui/components/textarea";
import { User, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

type ProfileFormValues = {
  age: string;
  sex: string;
  bloodType: string;
  weight: string;
  height: string;
  conditions: string[];
  medications: string[];
};

const SEX_OPTIONS = ["Masculino", "Femenino", "Otro"];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const getPatientProfileRef = makeFunctionReference<
  "query",
  { patientId?: string },
  {
    _id: string;
    age?: number;
    sex?: string;
    bloodType?: string;
    weight?: number;
    height?: number;
    conditions?: string[];
    medications?: string[];
    patientId: string;
  } | null
>("patientProfile:getByPatient");

const upsertPatientProfileRef = makeFunctionReference<
  "mutation",
  {
    age?: number;
    sex?: string;
    bloodType?: string;
    weight?: number;
    height?: number;
    conditions?: string[];
    medications?: string[];
  },
  unknown
>("patientProfile:upsert");

function profileToFormValues(
  profile:
    | {
        age?: number;
        sex?: string;
        bloodType?: string;
        weight?: number;
        height?: number;
        conditions?: string[];
        medications?: string[];
      }
    | null
    | undefined,
): ProfileFormValues {
  return {
    age: profile?.age?.toString() ?? "",
    sex: profile?.sex ?? "",
    bloodType: profile?.bloodType ?? "",
    weight: profile?.weight?.toString() ?? "",
    height: profile?.height?.toString() ?? "",
    conditions: profile?.conditions ?? [],
    medications: profile?.medications ?? [],
  };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ChipField({
  label,
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (item: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }}
          placeholder={`Agregar ${label.toLowerCase()}`}
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          Agregar
        </Button>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge key={item} variant="secondary" className="gap-1">
              {item}
              <button type="button" onClick={() => onRemove(item)} aria-label={`Eliminar ${item}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Aún no has agregado elementos.</p>
      )}
    </div>
  );
}

function ProfilePage() {
  const profile = useQuery(getPatientProfileRef, {});
  const upsertProfile = useMutation(upsertPatientProfileRef);
  const [conditionsDraft, setConditionsDraft] = useState("");
  const [medicationsDraft, setMedicationsDraft] = useState("");
  const [lastLoadedProfile, setLastLoadedProfile] = useState<string | null>(null);

  const form = useForm({
    defaultValues: profileToFormValues(undefined),
    onSubmit: async ({ value }) => {
      await upsertProfile({
        age: parseOptionalNumber(value.age),
        sex: value.sex || undefined,
        bloodType: value.bloodType || undefined,
        weight: parseOptionalNumber(value.weight),
        height: parseOptionalNumber(value.height),
        conditions: value.conditions,
        medications: value.medications,
      });

      toast.success("Perfil guardado correctamente");
    },
    validators: {
      onSubmit: z.object({
        age: z.string(),
        sex: z.string(),
        bloodType: z.string(),
        weight: z.string(),
        height: z.string(),
        conditions: z.array(z.string()),
        medications: z.array(z.string()),
      }),
    },
  });

  useEffect(() => {
    if (profile === undefined) {
      return;
    }

    const currentKey = profile?._id ?? "empty-profile";
    if (currentKey === lastLoadedProfile) {
      return;
    }

    form.reset(profileToFormValues(profile));
    setLastLoadedProfile(currentKey);
  }, [form, lastLoadedProfile, profile]);

  const defaultSummary = useMemo(() => {
    if (profile === undefined) {
      return "Cargando perfil...";
    }

    if (!profile) {
      return "Completa tu perfil para personalizar tu experiencia médica.";
    }

    return "Mantén tu información actualizada para mejores recomendaciones.";
  }, [profile]);

  if (profile === undefined) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
          <p className="text-muted-foreground">{defaultSummary}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil del paciente
          </CardTitle>
          <CardDescription>
            Actualiza tus datos clínicos básicos y antecedentes relevantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <form.Field name="age">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Edad</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="sex">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Sexo</Label>
                    <Select
                      value={field.state.value || undefined}
                      onValueChange={(value) => field.handleChange(value ?? "")}
                    >
                      <SelectTrigger id={field.name}>
                        <SelectValue placeholder="Selecciona una opción" />
                      </SelectTrigger>
                      <SelectContent>
                        {SEX_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>

              <form.Field name="bloodType">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Tipo de sangre</Label>
                    <Select
                      value={field.state.value || undefined}
                      onValueChange={(value) => field.handleChange(value ?? "")}
                    >
                      <SelectTrigger id={field.name}>
                        <SelectValue placeholder="Selecciona una opción" />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOOD_TYPES.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </form.Field>

              <form.Field name="weight">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Peso (kg)</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="height">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Altura (cm)</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="number"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </div>
                )}
              </form.Field>
            </div>

            <Separator />

            <form.Field name="conditions">
              {(field) => (
                <ChipField
                  label="Condiciones médicas"
                  items={field.state.value}
                  draft={conditionsDraft}
                  onDraftChange={setConditionsDraft}
                  onAdd={() => {
                    const nextItem = conditionsDraft.trim();
                    if (!nextItem || field.state.value.includes(nextItem)) return;
                    field.handleChange([...field.state.value, nextItem]);
                    setConditionsDraft("");
                  }}
                  onRemove={(item) =>
                    field.handleChange(
                      field.state.value.filter((currentItem) => currentItem !== item),
                    )
                  }
                />
              )}
            </form.Field>

            <form.Field name="medications">
              {(field) => (
                <ChipField
                  label="Medicamentos actuales"
                  items={field.state.value}
                  draft={medicationsDraft}
                  onDraftChange={setMedicationsDraft}
                  onAdd={() => {
                    const nextItem = medicationsDraft.trim();
                    if (!nextItem || field.state.value.includes(nextItem)) return;
                    field.handleChange([...field.state.value, nextItem]);
                    setMedicationsDraft("");
                  }}
                  onRemove={(item) =>
                    field.handleChange(
                      field.state.value.filter((currentItem) => currentItem !== item),
                    )
                  }
                />
              )}
            </form.Field>

            <div className="space-y-2">
              <Label>Notas rápidas</Label>
              <Textarea
                value={[
                  profile?.conditions?.length
                    ? `Condiciones registradas: ${profile.conditions.join(", ")}`
                    : "",
                  profile?.medications?.length
                    ? `Medicamentos registrados: ${profile.medications.join(", ")}`
                    : "",
                ]
                  .filter(Boolean)
                  .join("\n")}
                readOnly
                className="min-h-24"
              />
            </div>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Guardando..." : "Guardar perfil"}
                </Button>
              )}
            </form.Subscribe>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
