import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const ATTACHMENT_TYPES = [
  { value: "vehicle_registration", label: "Техпаспорт / СРТС" },
  { value: "vehicle_photo", label: "Фото автомобиля" },
  { value: "cargo_body_photo", label: "Фото кузова / отсека" },
  { value: "refrigeration_unit_photo", label: "Фото холодильного агрегата" },
  { value: "unit_nameplate", label: "Фото шильдика агрегата" },
  { value: "operating_manual", label: "Инструкция / руководство" },
  { value: "other", label: "Прочее" },
] as const;

type AttachmentKind = (typeof ATTACHMENT_TYPES)[number]["value"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function formatSize(size: number | null | undefined) {
  if (!size || size <= 0) return "—";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(size / 1024))} КБ`;
}

function kindLabel(kind: string | null | undefined) {
  return ATTACHMENT_TYPES.find(item => item.value === kind)?.label ?? "Приложение";
}

export default function ProtocolAttachmentsStep({
  protocolId,
  onBack,
  onDone,
}: {
  protocolId: number;
  onBack: () => void;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const attachmentsQ = trpc.attachments.list.useQuery({ protocolId });
  const upload = trpc.attachments.upload.useMutation({
    onSuccess: () => {
      utils.attachments.list.invalidate({ protocolId });
      toast.success("Приложение загружено");
    },
    onError: e => toast.error(e.message),
  });
  const update = trpc.attachments.update.useMutation({
    onSuccess: () => utils.attachments.list.invalidate({ protocolId }),
    onError: e => toast.error(e.message),
  });
  const remove = trpc.attachments.delete.useMutation({
    onSuccess: () => {
      utils.attachments.list.invalidate({ protocolId });
      toast.success("Приложение удалено");
    },
    onError: e => toast.error(e.message),
  });

  const [kind, setKind] = useState<AttachmentKind>("vehicle_registration");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [includeInPdf, setIncludeInPdf] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  const attachments = attachmentsQ.data ?? [];
  const includedCount = useMemo(
    () => attachments.filter(item => item.includeInPdf !== 0).length,
    [attachments],
  );
  const busy = upload.isPending || update.isPending || remove.isPending;

  async function handleUpload() {
    if (!file) {
      toast.error("Выберите файл приложения");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Файл больше 25 МБ");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    upload.mutate({
      protocolId,
      kind,
      title: title.trim() || null,
      comment: comment.trim() || null,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      base64: dataUrl,
      includeInPdf,
    }, {
      onSuccess: () => {
        setTitle("");
        setComment("");
        setFile(null);
        const input = document.getElementById("protocol-attachment-file") as HTMLInputElement | null;
        if (input) input.value = "";
      },
    });
  }

  function setAllIncluded(next: boolean) {
    attachments.forEach(item => {
      if ((item.includeInPdf !== 0) !== next) {
        update.mutate({ protocolId, id: item.id, includeInPdf: next });
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Приложения к протоколу авторефрижератора
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Этот шаг необязательный. Если не загрузить приложения или выключить их включение в PDF, в протоколе вообще не будет раздела “Приложения”.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Тип приложения</Label>
              <Select value={kind} onValueChange={value => setKind(value as AttachmentKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTACHMENT_TYPES.map(item => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Название в PDF</Label>
              <Input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder={kindLabel(kind)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea
              value={comment}
              onChange={event => setComment(event.target.value)}
              placeholder="Например: фото холодильного агрегата, стр. 1 техпаспорта, инструкция производителя..."
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="protocol-attachment-file">Файл</Label>
              <Input
                id="protocol-attachment-file"
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onChange={event => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Фото встраиваются в PDF как изображение. Документы PDF/DOCX/XLS добавляются карточкой с названием файла.
              </p>
            </div>
            <Button onClick={handleUpload} disabled={busy || !file}>
              {upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Загрузить
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium">Включить этот файл в PDF</div>
              <div className="text-xs text-muted-foreground">Флажок по умолчанию включён, но его можно отключить для черновых/лишних файлов.</div>
            </div>
            <Switch checked={includeInPdf} onCheckedChange={setIncludeInPdf} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Загруженные приложения</CardTitle>
            <p className="text-sm text-muted-foreground">
              В PDF попадёт: {includedCount} из {attachments.length}
            </p>
          </div>
          {attachments.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAllIncluded(true)} disabled={busy}>Включить все</Button>
              <Button variant="outline" size="sm" onClick={() => setAllIncluded(false)} disabled={busy}>Выключить все</Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {attachmentsQ.isLoading && <div className="text-sm text-muted-foreground">Загрузка списка...</div>}
          {!attachmentsQ.isLoading && attachments.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Приложений пока нет. Это нормально: раздел приложений не появится в PDF.
            </div>
          )}
          {attachments.map(item => (
            <div key={item.id} className="rounded-lg border p-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate">{item.title || kindLabel(item.kind)}</span>
                  <Badge variant={item.includeInPdf !== 0 ? "default" : "secondary"}>
                    {item.includeInPdf !== 0 ? "в PDF" : "не в PDF"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {kindLabel(item.kind)} · {item.fileName} · {formatSize(item.size)}
                </div>
                {item.comment && <div className="text-sm">{item.comment}</div>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Switch
                  checked={item.includeInPdf !== 0}
                  disabled={busy}
                  onCheckedChange={checked => update.mutate({ protocolId, id: item.id, includeInPdf: checked })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() => remove.mutate({ protocolId, id: item.id })}
                  title="Удалить приложение"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <Button onClick={onDone}>
          Далее
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
