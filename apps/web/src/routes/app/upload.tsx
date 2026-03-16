import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@chopo-v1/ui/components/badge";
import { Button } from "@chopo-v1/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@chopo-v1/ui/components/card";
import { Input } from "@chopo-v1/ui/components/input";
import { Label } from "@chopo-v1/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@chopo-v1/ui/components/select";
import { Separator } from "@chopo-v1/ui/components/separator";
import { SidebarTrigger } from "@chopo-v1/ui/components/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@chopo-v1/ui/components/table";
import { Textarea } from "@chopo-v1/ui/components/textarea";
import {
  CheckCircle,
  Clock,
  FileText,
  Upload,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { EXAM_RECORDS, type ExamRecord } from "@/lib/mock-data";

export const Route = createFileRoute("/app/upload")({
  component: UploadPage,
});

const STATUS_ICON: Record<ExamRecord["status"], typeof CheckCircle> = {
  processed: CheckCircle,
  pending: Clock,
  error: XCircle,
};

const STATUS_LABEL: Record<ExamRecord["status"], string> = {
  processed: "Procesado",
  pending: "Pendiente",
  error: "Error",
};

function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [lab, setLab] = useState("");
  const [examType, setExamType] = useState("");
  const [notes, setNotes] = useState("");

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      setFiles(Array.from(e.target.files));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFiles([]);
    setLab("");
    setExamType("");
    setNotes("");
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
            <CardDescription>Arrastra tus archivos o haz clic para seleccionar</CardDescription>
          </CardHeader>
          <CardContent>
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    document.getElementById("file-upload")?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {files.length > 0
                    ? `${files.length} archivo(s) seleccionado(s)`
                    : "Arrastra archivos aquí"}
                </p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG hasta 10MB</p>
                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {files.length > 0 && (
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
              )}

              <div className="space-y-2">
                <Label htmlFor="lab">Laboratorio</Label>
                <Select value={lab} onValueChange={(v) => setLab(v ?? "")}>
                  <SelectTrigger id="lab">
                    <SelectValue placeholder="Selecciona el laboratorio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chopo-centro">Chopo Sucursal Centro</SelectItem>
                    <SelectItem value="chopo-polanco">Chopo Sucursal Polanco</SelectItem>
                    <SelectItem value="chopo-santa-fe">Chopo Sucursal Santa Fe</SelectItem>
                    <SelectItem value="chopo-condesa">Chopo Sucursal Condesa</SelectItem>
                    <SelectItem value="otro">Otro laboratorio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam-type">Tipo de estudio</Label>
                <Select value={examType} onValueChange={(v) => setExamType(v ?? "")}>
                  <SelectTrigger id="exam-type">
                    <SelectValue placeholder="Selecciona el tipo de estudio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quimica-40">Química sanguínea 40 elementos</SelectItem>
                    <SelectItem value="biometria">Biometría hemática</SelectItem>
                    <SelectItem value="perfil-lipidico">Perfil lipídico</SelectItem>
                    <SelectItem value="panel-tiroideo">Panel tiroideo</SelectItem>
                    <SelectItem value="perfil-hepatico">Perfil hepático</SelectItem>
                    <SelectItem value="perfil-renal">Perfil renal</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Agrega comentarios sobre este estudio..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full" disabled={files.length === 0}>
                <Upload className="mr-2 h-4 w-4" />
                Subir estudio
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Laboratorio</TableHead>
                  <TableHead className="text-center">Archivos</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EXAM_RECORDS.map((record) => {
                  const StatusIcon = STATUS_ICON[record.status];
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-sm">{record.date}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{record.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{record.lab}</TableCell>
                      <TableCell className="text-center">{record.fileCount}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={record.status === "processed" ? "secondary" : record.status === "error" ? "destructive" : "outline"}
                          className="gap-1"
                        >
                          <StatusIcon className="h-3 w-3" />
                          {STATUS_LABEL[record.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
