import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  CloudUpload,
  Download,
  FileIcon,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocalFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  dataUrl: string;
}

type FolderKey = "xls" | "word" | "pdf" | "images";

const STORAGE_KEYS: Record<FolderKey, string> = {
  xls: "localdata_xls",
  word: "localdata_word",
  pdf: "localdata_pdf",
  images: "localdata_images",
};

const ACCEPT_TYPES: Record<FolderKey, string> = {
  xls: ".xls,.xlsx",
  word: ".doc,.docx",
  pdf: ".pdf",
  images: ".jpg,.jpeg,.png,.gif,.webp,.svg",
};

const FOLDER_LABELS: Record<FolderKey, string> = {
  xls: "XLS / Excel",
  word: "Word",
  pdf: "PDF",
  images: "Images",
};

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB warning threshold

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadFiles(key: FolderKey): LocalFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[key]);
    return raw ? (JSON.parse(raw) as LocalFile[]) : [];
  } catch {
    return [];
  }
}

function saveFiles(key: FolderKey, files: LocalFile[]): void {
  localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(files));
}

function downloadFile(file: LocalFile): void {
  const a = document.createElement("a");
  a.href = file.dataUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Upload Zone
// ---------------------------------------------------------------------------

interface UploadZoneProps {
  folderKey: FolderKey;
  onFilesAdded: (files: LocalFile[]) => void;
}

function UploadZone({ folderKey, onFilesAdded }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (rawFiles: File[]) => {
      if (rawFiles.length === 0) return;
      setIsProcessing(true);

      const promises = rawFiles.map(
        (file) =>
          new Promise<LocalFile | null>((resolve) => {
            if (file.size > MAX_FILE_SIZE) {
              toast.warning(
                `"${file.name}" is ${formatFileSize(file.size)} — files over 2 MB may hit browser storage limits.`,
              );
            }
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              resolve({
                id: generateId(),
                name: file.name,
                size: file.size,
                uploadedAt: new Date().toISOString(),
                dataUrl,
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
          }),
      );

      Promise.all(promises).then((results) => {
        const valid = results.filter((f): f is LocalFile => f !== null);
        if (valid.length > 0) {
          onFilesAdded(valid);
          toast.success(
            `${valid.length} file${valid.length > 1 ? "s" : ""} uploaded to ${FOLDER_LABELS[folderKey]}`,
          );
        }
        setIsProcessing(false);
      });
    },
    [folderKey, onFilesAdded],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    processFiles(files);
    // reset input so same file can be re-uploaded
    e.target.value = "";
  }

  return (
    <button
      type="button"
      data-ocid={`${folderKey}.dropzone`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "relative w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 select-none",
        isDragging
          ? "border-blue-500 bg-blue-50 scale-[1.01]"
          : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50",
        isProcessing && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_TYPES[folderKey]}
        multiple
        className="hidden"
        onChange={handleInputChange}
        data-ocid={`${folderKey}.upload_button`}
      />
      <div
        className={cn(
          "p-3 rounded-full transition-colors",
          isDragging ? "bg-blue-100" : "bg-white border border-gray-200",
        )}
      >
        <CloudUpload
          className={cn(
            "h-7 w-7",
            isDragging ? "text-blue-600" : "text-gray-400",
          )}
        />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">
          {isProcessing ? "Processing..." : "Drag & drop files here"}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          or{" "}
          <span className="text-blue-600 underline underline-offset-2">
            click to browse
          </span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Accepted: {ACCEPT_TYPES[folderKey]}
        </p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Image Lightbox
// ---------------------------------------------------------------------------

interface LightboxProps {
  file: LocalFile | null;
  onClose: () => void;
}

function ImageLightbox({ file, onClose }: LightboxProps) {
  if (!file) return null;
  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-ocid="images.modal"
        className="max-w-3xl w-full p-0 overflow-hidden"
      >
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-sm font-medium truncate pr-8">
            {file.name}
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 pt-2">
          <img
            src={file.dataUrl}
            alt={file.name}
            className="max-h-[70vh] w-full object-contain rounded-lg bg-gray-50"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500">
              {formatFileSize(file.size)} •{" "}
              {new Date(file.uploadedAt).toLocaleString()}
            </span>
            <Button
              size="sm"
              variant="outline"
              data-ocid="images.modal.download_button"
              onClick={() => downloadFile(file)}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// File Table (XLS / Word / PDF)
// ---------------------------------------------------------------------------

interface FileTableProps {
  folderKey: FolderKey;
  files: LocalFile[];
  onDelete: (id: string) => void;
}

function FileTable({ folderKey, files, onDelete }: FileTableProps) {
  if (files.length === 0) {
    return (
      <div
        data-ocid={`${folderKey}.empty_state`}
        className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400"
      >
        {folderKey === "xls" && <FileSpreadsheet className="h-10 w-10" />}
        {folderKey === "word" && <FileText className="h-10 w-10" />}
        {folderKey === "pdf" && <FileIcon className="h-10 w-10" />}
        <p className="text-sm font-medium">No files uploaded yet</p>
        <p className="text-xs">
          Upload {FOLDER_LABELS[folderKey]} files using the area above
        </p>
      </div>
    );
  }

  return (
    <div
      data-ocid={`${folderKey}.table`}
      className="rounded-lg border border-gray-200 overflow-hidden"
    >
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="text-xs font-semibold text-gray-600">
              File Name
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-600 w-24">
              Size
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-600 w-40">
              Uploaded At
            </TableHead>
            <TableHead className="text-xs font-semibold text-gray-600 w-28 text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file, idx) => (
            <TableRow
              key={file.id}
              data-ocid={`${folderKey}.item.${idx + 1}`}
              className="hover:bg-gray-50"
            >
              <TableCell className="text-sm text-gray-800 font-medium max-w-xs">
                <span className="truncate block" title={file.name}>
                  {file.name}
                </span>
              </TableCell>
              <TableCell className="text-xs text-gray-500">
                {formatFileSize(file.size)}
              </TableCell>
              <TableCell className="text-xs text-gray-500">
                {new Date(file.uploadedAt).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    data-ocid={`${folderKey}.item.${idx + 1}.download_button`}
                    onClick={() => downloadFile(file)}
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    data-ocid={`${folderKey}.item.${idx + 1}.delete_button`}
                    onClick={() => onDelete(file.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image Thumbnail Grid
// ---------------------------------------------------------------------------

interface ImageGridProps {
  files: LocalFile[];
  onDelete: (id: string) => void;
  onPreview: (file: LocalFile) => void;
}

function ImageGrid({ files, onDelete, onPreview }: ImageGridProps) {
  if (files.length === 0) {
    return (
      <div
        data-ocid="images.empty_state"
        className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400"
      >
        <ImageIcon className="h-10 w-10" />
        <p className="text-sm font-medium">No images uploaded yet</p>
        <p className="text-xs">Upload image files using the area above</p>
      </div>
    );
  }

  return (
    <div
      data-ocid="images.table"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
    >
      {files.map((file, idx) => (
        <button
          key={file.id}
          type="button"
          data-ocid={`images.item.${idx + 1}`}
          className="group relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-square cursor-pointer hover:shadow-md transition-shadow w-full"
          onClick={() => onPreview(file)}
        >
          <img
            src={file.dataUrl}
            alt={file.name}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
            <div className="flex justify-end gap-1">
              <button
                type="button"
                data-ocid={`images.item.${idx + 1}.download_button`}
                className="bg-white/90 hover:bg-white rounded-full p-1.5 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile(file);
                }}
                title="Download"
              >
                <Download className="h-3 w-3 text-gray-700" />
              </button>
              <button
                type="button"
                data-ocid={`images.item.${idx + 1}.delete_button`}
                className="bg-white/90 hover:bg-red-100 rounded-full p-1.5 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file.id);
                }}
                title="Delete"
              >
                <X className="h-3 w-3 text-red-600" />
              </button>
            </div>
            <p className="text-white text-xs font-medium truncate px-0.5">
              {file.name}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder Panel (used per tab)
// ---------------------------------------------------------------------------

interface FolderPanelProps {
  folderKey: FolderKey;
}

function FolderPanel({ folderKey }: FolderPanelProps) {
  const [files, setFiles] = useState<LocalFile[]>(() => loadFiles(folderKey));
  const [search, setSearch] = useState("");
  const [lightboxFile, setLightboxFile] = useState<LocalFile | null>(null);

  function handleFilesAdded(newFiles: LocalFile[]) {
    setFiles((prev) => {
      const updated = [...prev, ...newFiles];
      saveFiles(folderKey, updated);
      return updated;
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this file? This action cannot be undone.")) {
      return;
    }
    setFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      saveFiles(folderKey, updated);
      return updated;
    });
    toast.success("File deleted");
  }

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <UploadZone folderKey={folderKey} onFilesAdded={handleFilesAdded} />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <Input
          data-ocid={`${folderKey}.search_input`}
          placeholder={`Search ${FOLDER_LABELS[folderKey]} files...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm bg-white"
        />
      </div>

      {/* File list */}
      {folderKey === "images" ? (
        <>
          <ImageGrid
            files={filtered}
            onDelete={handleDelete}
            onPreview={setLightboxFile}
          />
          <ImageLightbox
            file={lightboxFile}
            onClose={() => setLightboxFile(null)}
          />
        </>
      ) : (
        <FileTable
          folderKey={folderKey}
          files={filtered}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Storage Summary Bar
// ---------------------------------------------------------------------------

function StorageSummary() {
  const [summary, setSummary] = useState({ totalFiles: 0, totalBytes: 0 });

  useEffect(() => {
    let totalFiles = 0;
    let totalBytes = 0;
    for (const key of Object.keys(STORAGE_KEYS) as FolderKey[]) {
      const files = loadFiles(key);
      totalFiles += files.length;
      totalBytes += files.reduce((acc, f) => acc + f.size, 0);
    }
    setSummary({ totalFiles, totalBytes });
  }, []);

  return (
    <div
      data-ocid="datasource.summary.panel"
      className="flex flex-wrap items-center gap-4 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <FileText className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="text-xs text-gray-500">Total Files</p>
          <p className="text-sm font-bold text-gray-800">
            {summary.totalFiles}
          </p>
        </div>
      </div>
      <div className="h-8 w-px bg-blue-200 hidden sm:block" />
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center">
          <CloudUpload className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <p className="text-xs text-gray-500">Storage Used</p>
          <p className="text-sm font-bold text-gray-800">
            {formatFileSize(summary.totalBytes)}
            <span className="text-xs font-normal text-gray-400 ml-1">
              (original)
            </span>
          </p>
        </div>
      </div>
      <div className="ml-auto">
        <p className="text-xs text-gray-400">
          Stored locally in your browser (localStorage)
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Module
// ---------------------------------------------------------------------------

export function LocalDataSourceModule() {
  // Force-read counts from localStorage on mount
  const [counts, setCounts] = useState<Record<FolderKey, number>>(() => ({
    xls: loadFiles("xls").length,
    word: loadFiles("word").length,
    pdf: loadFiles("pdf").length,
    images: loadFiles("images").length,
  }));

  // Refresh counts when user uploads/deletes
  function refreshCounts() {
    setCounts({
      xls: loadFiles("xls").length,
      word: loadFiles("word").length,
      pdf: loadFiles("pdf").length,
      images: loadFiles("images").length,
    });
  }

  return (
    <div
      data-ocid="datasource.page"
      className="max-w-5xl mx-auto px-4 py-8 space-y-6"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Local Data Source Manager
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage input/output files locally on your computer. Files are stored
            in your browser&apos;s local storage.
          </p>
        </div>
        <Badge
          variant="outline"
          className="self-start sm:self-center text-xs border-green-300 text-green-700 bg-green-50 px-3 py-1"
        >
          🖥️ Local Server Mode
        </Badge>
      </div>

      {/* Storage Summary */}
      <StorageSummary />

      {/* Folder Tabs */}
      <Tabs
        defaultValue="xls"
        className="w-full"
        onValueChange={refreshCounts}
        data-ocid="datasource.tab"
      >
        <TabsList className="grid grid-cols-4 h-auto gap-1 bg-gray-100 p-1 rounded-xl">
          <TabsTrigger
            value="xls"
            data-ocid="datasource.xls.tab"
            className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2 text-xs sm:text-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-green-600 shrink-0" />
            <span className="hidden xs:inline">XLS / Excel</span>
            <span className="xs:hidden">XLS</span>
            <Badge
              variant="secondary"
              className="ml-1 h-4 min-w-4 px-1 text-[10px] font-bold"
            >
              {counts.xls}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="word"
            data-ocid="datasource.word.tab"
            className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2 text-xs sm:text-sm"
          >
            <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>Word</span>
            <Badge
              variant="secondary"
              className="ml-1 h-4 min-w-4 px-1 text-[10px] font-bold"
            >
              {counts.word}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="pdf"
            data-ocid="datasource.pdf.tab"
            className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2 text-xs sm:text-sm"
          >
            <FileIcon className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span>PDF</span>
            <Badge
              variant="secondary"
              className="ml-1 h-4 min-w-4 px-1 text-[10px] font-bold"
            >
              {counts.pdf}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="images"
            data-ocid="datasource.images.tab"
            className="flex items-center gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg py-2 text-xs sm:text-sm"
          >
            <ImageIcon className="h-3.5 w-3.5 text-purple-500 shrink-0" />
            <span>Images</span>
            <Badge
              variant="secondary"
              className="ml-1 h-4 min-w-4 px-1 text-[10px] font-bold"
            >
              {counts.images}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {(["xls", "word", "pdf", "images"] as FolderKey[]).map((key) => (
          <TabsContent
            key={key}
            value={key}
            data-ocid={`datasource.${key}.panel`}
            className="mt-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-4">
              {key === "xls" && (
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
              )}
              {key === "word" && <FileText className="h-5 w-5 text-blue-600" />}
              {key === "pdf" && <FileIcon className="h-5 w-5 text-red-500" />}
              {key === "images" && (
                <ImageIcon className="h-5 w-5 text-purple-500" />
              )}
              <h2 className="text-base font-semibold text-gray-800">
                {FOLDER_LABELS[key]} Files
              </h2>
              <Badge variant="outline" className="ml-auto text-xs">
                {counts[key]} file{counts[key] !== 1 ? "s" : ""}
              </Badge>
            </div>
            <FolderPanel key={key} folderKey={key} />
          </TabsContent>
        ))}
      </Tabs>

      {/* Footer note */}
      <p className="text-xs text-center text-gray-400 pb-4">
        ⚠️ Files are stored in browser localStorage (~5 MB limit per origin).
        Large files are warned at upload. Clear browser data to remove all
        stored files.
      </p>
    </div>
  );
}
