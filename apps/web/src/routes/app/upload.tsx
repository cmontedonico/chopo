import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@chopo-v1/backend/convex/_generated/dataModel";
import { CheckCircle2, FileText, Loader2, Upload, XCircle } from "lucide-react";
import { useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { api } from "@chopo-v1/backend/convex/_generated/api";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chopo-v1/ui/components/table";
import { Textarea } from "@chopo-v1/ui/components/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@chopo-v1/ui/components/tooltip";

export const Route = createFileRoute("/app/upload")({
  component: UploadPage,
});

type ExamRecord = {
  _id: string;
  labName: string;
  examType: string;
  examDate: number;
  status: string;
  fileName: string;
  errorMessage?: string | null;
};

type UploadExamArgs = {
  file: File;
  labName: string;
  examType: string;
  notes?: string;
  generateUploadUrl: () => Promise<string>;
  createExam: (args: {
    storageId: Id<"_storage">;
    labName: string;
    examType: string;
    examDate: number;
    fileName: string;
    notes?: string;
  }) => Promise<unknown>;
  fetchImpl?: typeof fetch;
};

const LAB_OPTIONS = [
  { value: "Chopo Sucursal Centro", label: "Chopo Sucursal Centro" },
  { value: "Chopo Sucursal Polanco", label: "Chopo Sucursal Polanco" },
  { value: "Chopo Sucursal Santa Fe", label: "Chopo Sucursal Santa Fe" },
  { value: "Chopo Sucursal Condesa", label: "Chopo Sucursal Condesa" },
  { value: "Otro laboratorio", label: "Otro laboratorio" },
];

const EXAM_TYPE_OPTIONS = [
  { value: "Química sanguínea 40 elementos", label: "Química sanguínea 40 elementos" },
  { value: "Biometría hemática", label: "Biometría hemática" },
  { value: "Perfil lipídico", label: "Perfil lipídico" },
  { value: "Panel tiroideo", label: "Panel tiroideo" },
  { value: "Perfil hepático", label: "Perfil hepático" },
  { value: "Perfil renal", label: "Perfil renal" },
  { value: "Otro", label: "Otro" },
];

const STATUS_META: Record<
  string,
  {
    label: string;
    icon: typeof CheckCircle2;
    variant: "secondary" | "outline" | "destructive";
    className: string;
  }
> = {
  processing: {
    label: "Procesando...",
    icon: Loader2,
    variant: "outline",
    className: "gap-1 text-muted-foreground",
  },
  completed: {
    label: "Completado",
    icon: CheckCircle2,
    variant: "secondary",
    className: "gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  failed: {
    label: "Error",
    icon: XCircle,
    variant: "destructive",
    className: "gap-1",
  },
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
});

export async function submitUploadToBackend({
  file,
  labName,
  examType,
  notes,
  generateUploadUrl,
  createExam,
  fetchImpl = fetch,
}: UploadExamArgs) {
  const uploadUrl = await generateUploadUrl();
  const response = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`No se pudo subir el archivo: ${response.status} ${response.statusText}`);
  }

  const { storageId } = (await response.json()) as { storageId?: Id<"_storage"> | string };
  if (!storageId) {
    throw new Error("No se recibió storageId desde Convex.");
  }

  await createExam({
    storageId: storageId as Id<"_storage">,
    labName,
    examType,
    examDate: Date.now(),
    fileName: file.name,
    notes: notes || undefined,
  });
}

function isPaywallError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("límite de estudios") || normalized.includes("actualiza tu plan");
}

function formatExamDate(examDate: number) {
  return DATE_FORMATTER.format(new Date(examDate));
}

function StatusBadge({ exam }: { exam: ExamRecord }) {
  const meta = STATUS_META[exam.status];

  if (!meta) {
    return <Badge variant="outline">{exam.status}</Badge>;
  }

  const Icon = meta.icon;

  if (exam.status === "failed") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge variant={meta.variant} className={meta.className}>
              <Icon className="h-3 w-3" />
              {meta.label}
            </Badge>
          }
        />
        <TooltipContent side="top" align="center">
          {exam.errorMessage || "Hubo un error al procesar este estudio."}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Badge variant={meta.variant} className={meta.className}>
      <Icon className={meta.icon === Loader2 ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
      {meta.label}
    </Badge>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-36" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="mx-auto h-5 w-24" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function UploadPageView({
  exams,
  onUpload,
}: {
  exams: ExamRecord[] | undefined;
  onUpload: (args: {
    file: File;
    labName: string;
    examType: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [labName, setLabName] = useState("");
  const [examType, setExamType] = useState("");
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);

  function handleDrag(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (event.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (event.dataTransfer.files?.length) {
      setFiles([event.dataTransfer.files[0]]);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) {
      setFiles([event.target.files[0]]);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = files[0];
    if (!file || !labName || !examType || isUploading) {
      return;
    }

    setIsUploading(true);
    setPaywallMessage(null);

    try {
      await onUpload({
        file,
        labName,
        examType,
        notes: notes.trim() || undefined,
      });
      toast.success("Estudio subido. Procesando resultados...");
      setFiles([]);
      setLabName("");
      setExamType("");
      setNotes("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo subir el estudio.";
      toast.error(message);
      if (isPaywallError(message)) {
        setPaywallMessage(message);
      }
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subir resultados</h1>
          <p className="text-muted-foreground">
            Carga tus estudios de laboratorio en formato PDF o imagen
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Nuevo estudio
            </CardTitle>
            <CardDescription>Arrastra tu archivo o haz clic para seleccionar</CardDescription>
          </CardHeader>
          <CardContent>
            {paywallMessage ? (
              <div className="mb-4 rounded-none border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <p className="font-medium">Límite alcanzado</p>
                <p className="mt-1">{paywallMessage}</p>
                <a href="/app/billing" className="mt-2 inline-flex underline underline-offset-4">
                  Ir a facturación
                </a>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div
                className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-upload")?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    document.getElementById("file-upload")?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {files.length > 0 ? files[0]?.name : "Arrastra tu archivo aquí"}
                </p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG hasta 10MB</p>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {files.length > 0 ? (
                <div className="space-y-1">
                  {files.map((file) => (
                    <div key={file.name} className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{file.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="lab">Laboratorio</Label>
                <Select value={labName} onValueChange={(value) => setLabName(value ?? "")}>
                  <SelectTrigger id="lab">
                    <SelectValue placeholder="Selecciona el laboratorio" />
                  </SelectTrigger>
                  <SelectContent>
                    {LAB_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam-type">Tipo de estudio</Label>
                <Select value={examType} onValueChange={(value) => setExamType(value ?? "")}>
                  <SelectTrigger id="exam-type">
                    <SelectValue placeholder="Selecciona el tipo de estudio" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAM_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Agrega comentarios sobre este estudio..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={files.length === 0 || !labName || !examType || isUploading}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploading ? "Subiendo..." : "Subir estudio"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Historial de estudios
            </CardTitle>
            <CardDescription>Estudios subidos anteriormente</CardDescription>
          </CardHeader>
          <CardContent>
            {exams === undefined ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Cargando historial de estudios...</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Laboratorio</TableHead>
                      <TableHead>Archivo</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <LoadingRows />
                  </TableBody>
                </Table>
              </div>
            ) : exams.length === 0 ? (
              <div className="rounded-none border border-dashed border-muted-foreground/30 p-6 text-center">
                <p className="text-sm font-medium">
                  Aún no has subido estudios. ¡Sube tu primer resultado!
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tu historial aparecerá aquí en cuanto subas tu primer PDF.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Laboratorio</TableHead>
                    <TableHead>Archivo</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam) => (
                    <TableRow key={exam._id}>
                      <TableCell className="font-mono text-sm">
                        {formatExamDate(exam.examDate)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {exam.examType}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {exam.labName}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">
                        {exam.fileName}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge exam={exam} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Instrucciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="text-lg font-bold">1</span>
              </div>
              <h3 className="font-medium">Sube tu archivo</h3>
              <p className="text-sm text-muted-foreground">
                Acepta PDF, JPG o PNG de tu estudio de laboratorio.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="text-lg font-bold">2</span>
              </div>
              <h3 className="font-medium">Procesamos tus datos</h3>
              <p className="text-sm text-muted-foreground">
                Extraemos automáticamente los valores de tu estudio.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="text-lg font-bold">3</span>
              </div>
              <h3 className="font-medium">Visualiza resultados</h3>
              <p className="text-sm text-muted-foreground">
                Consulta tus resultados en el dashboard con gráficas y correlaciones.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UploadPage() {
  const exams = useQuery(api.exams.listByPatient, {});
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const createExam = useMutation(api.uploads.createExamFromUpload);

  async function handleUpload({
    file,
    labName,
    examType,
    notes,
  }: {
    file: File;
    labName: string;
    examType: string;
    notes?: string;
  }) {
    await submitUploadToBackend({
      file,
      labName,
      examType,
      notes,
      generateUploadUrl: () => generateUploadUrl({}),
      createExam: (args) => createExam(args),
    });
  }

  return <UploadPageView exams={exams as ExamRecord[] | undefined} onUpload={handleUpload} />;
}
