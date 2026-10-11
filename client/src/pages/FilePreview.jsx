import { useEffect, useState, useMemo } from "react";
import {
  Download,
  FileText,
  Table,
  Search,
  Copy,
  CheckCheck,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Presentation,
  Printer,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Layers,
  BookOpen,
  ExternalLink,
  Film,
  Music,
} from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { downloadUpload, uploadUrl } from "../utils/uploadUrls";

export default function FilePreview() {
  const { category, filename } = useParams();
  const [searchParams] = useSearchParams();
  const displayName = searchParams.get("name") || filename;

  const [preview, setPreview] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Excel viewer state
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [sheetSearch, setSheetSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [page, setPage] = useState(1);
  const rowsPerPage = 50;

  // Word (.docx) viewer state
  const [docxZoom, setDocxZoom] = useState(100);

  // PowerPoint (.pptx) viewer state
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [slideSearch, setSlideSearch] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const ext = (displayName || filename).split(".").pop().toLowerCase();
  const isExcelExt = ["xlsx", "xls", "csv"].includes(ext);
  const isDocxExt = ["docx", "doc"].includes(ext);
  const isPptxExt = ["pptx", "ppt"].includes(ext);
  const isTextExt = ["txt", "json", "md", "log", "js", "py", "c", "cpp", "java", "html", "css"].includes(ext);
  const isVideo = ["mp4", "webm", "ogg", "mov", "mkv"].includes(ext);
  const isAudio = ["mp3", "wav", "aac", "m4a", "flac"].includes(ext);
  const isStructuredPreview = isExcelExt || isDocxExt || isPptxExt || isTextExt;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const fileUrl = `/uploads/${category}/${filename}`;

    if (isStructuredPreview) {
      api
        .get(`/files/${category}/${encodeURIComponent(filename)}/preview-data`)
        .then((res) => {
          if (!active) return;
          setParsedData(res.data);
          setPreview({ fileUrl });
          setLoading(false);
        })
        .catch(() => {
          fetchBlob(fileUrl);
        });
    } else {
      fetchBlob(fileUrl);
    }

    function fetchBlob(fUrl) {
      api
        .get(`/files/${category}/${encodeURIComponent(filename)}`, { responseType: "blob" })
        .then((response) => {
          if (!active) return;
          const blob = new Blob([response.data], {
            type: response.headers["content-type"] || "application/octet-stream",
          });
          const objectUrl = URL.createObjectURL(blob);
          setPreview({ url: objectUrl, type: blob.type, fileUrl: fUrl });
          setLoading(false);
        })
        .catch((requestError) => {
          if (active) {
            setError(
              requestError.response?.data?.message ||
                "Could not load this file. Check that the server is running and try again."
            );
            setLoading(false);
          }
        });
    }

    return () => {
      active = false;
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [category, filename, isStructuredPreview]);

  // Keyboard navigation for PowerPoint slides
  useEffect(() => {
    if (parsedData?.type !== "pptx" || !parsedData?.slides?.length) return;

    function handleKeyDown(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setActiveSlideIdx((curr) => Math.min(curr + 1, parsedData.slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setActiveSlideIdx((curr) => Math.max(curr - 1, 0));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [parsedData]);

  const isImage = preview?.type?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"].includes(ext);
  const isPdf = preview?.type === "application/pdf" || ext === "pdf";

  // Filter rows for current active sheet
  const activeSheet = parsedData?.sheets?.[activeSheetIdx];
  const filteredRows = useMemo(() => {
    if (!activeSheet?.rows) return [];
    if (!sheetSearch.trim()) return activeSheet.rows;
    const term = sheetSearch.toLowerCase();
    return activeSheet.rows.filter((row) =>
      row.some((cell) => String(cell).toLowerCase().includes(term))
    );
  }, [activeSheet, sheetSearch]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page]);

  // Filter slides for PPTX search
  const filteredSlides = useMemo(() => {
    if (!parsedData?.slides) return [];
    if (!slideSearch.trim()) return parsedData.slides;
    const term = slideSearch.toLowerCase();
    return parsedData.slides.filter(
      (s) =>
        s.title.toLowerCase().includes(term) ||
        (s.bullets && s.bullets.some((b) => b.toLowerCase().includes(term)))
    );
  }, [parsedData, slideSearch]);

  const activeSlide = parsedData?.slides?.[activeSlideIdx] || parsedData?.slides?.[0];

  function handleCopyText(text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrintDoc() {
    window.print();
  }

  function handleOpenInNativeApp() {
    if (!preview?.fileUrl) return;
    try {
      const directUrl = `${window.location.origin}/api${uploadUrl(preview.fileUrl, displayName, "inline")}`;
      if (isExcelExt) {
        window.location.href = `ms-excel:ofv|u|${directUrl}`;
        setTimeout(() => {
          downloadUpload(preview.fileUrl, displayName).catch(() => {});
        }, 400);
      } else if (isDocxExt) {
        window.location.href = `ms-word:ofv|u|${directUrl}`;
        setTimeout(() => {
          downloadUpload(preview.fileUrl, displayName).catch(() => {});
        }, 400);
      } else if (isPptxExt) {
        window.location.href = `ms-powerpoint:ofv|u|${directUrl}`;
        setTimeout(() => {
          downloadUpload(preview.fileUrl, displayName).catch(() => {});
        }, 400);
      } else if (isPdf || isImage) {
        window.open(preview.url, "_blank");
      } else {
        downloadUpload(preview.fileUrl, displayName).catch(() => {});
      }
    } catch {
      downloadUpload(preview.fileUrl, displayName).catch(() => {});
    }
  }

  return (
    <main className={`flex min-h-screen flex-col bg-slate-100 text-slate-900 font-body ${isFullscreen ? "fixed inset-0 z-50 bg-slate-950 text-white" : ""}`}>
      {/* Top Header */}
      {!isFullscreen && (
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 shadow-xs">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs ${
                isExcelExt
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : isDocxExt
                  ? "bg-blue-50 text-blue-700 border-blue-100"
                  : isPptxExt
                  ? "bg-amber-50 text-amber-700 border-amber-100"
                  : isVideo
                  ? "bg-purple-50 text-purple-700 border-purple-100"
                  : isAudio
                  ? "bg-rose-50 text-rose-700 border-rose-100"
                  : "bg-violet-50 text-violet-700 border-violet-100"
              }`}
            >
              {isExcelExt ? (
                <FileSpreadsheet size={20} />
              ) : isDocxExt ? (
                <BookOpen size={20} />
              ) : isPptxExt ? (
                <Presentation size={20} />
              ) : isVideo ? (
                <Film size={20} />
              ) : isAudio ? (
                <Music size={20} />
              ) : (
                <FileText size={20} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 leading-tight">{displayName}</h1>
              <p className="text-xs text-slate-400 font-medium">
                Format: <span className="uppercase font-bold text-slate-600">{ext}</span> · Category: {category}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isExcelExt && (
              <button
                type="button"
                onClick={handleOpenInNativeApp}
                className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !text-white flex items-center gap-2 !py-2 !px-4 shadow-sm cursor-pointer font-bold text-xs"
              >
                <FileSpreadsheet size={16} />
                <span>Open directly in Excel</span>
              </button>
            )}
            {isDocxExt && (
              <button
                type="button"
                onClick={handleOpenInNativeApp}
                className="btn-primary !bg-blue-600 hover:!bg-blue-700 !text-white flex items-center gap-2 !py-2 !px-4 shadow-sm cursor-pointer font-bold text-xs"
              >
                <BookOpen size={16} />
                <span>Open directly in Word</span>
              </button>
            )}
            {isPptxExt && (
              <button
                type="button"
                onClick={handleOpenInNativeApp}
                className="btn-primary !bg-amber-500 hover:!bg-amber-400 !text-slate-950 flex items-center gap-2 !py-2 !px-4 shadow-sm cursor-pointer font-bold text-xs"
              >
                <Presentation size={16} />
                <span>Open directly in PowerPoint</span>
              </button>
            )}
            {(isPdf || isImage) && (
              <button
                type="button"
                onClick={handleOpenInNativeApp}
                className="btn-secondary flex items-center gap-2 !py-2 !px-3.5 shadow-xs cursor-pointer text-xs font-semibold"
              >
                <ExternalLink size={15} />
                <span>{isPdf ? "Open in New Tab" : "Full Resolution"}</span>
              </button>
            )}
            <button
              type="button"
              disabled={!preview}
              onClick={() =>
                preview &&
                void downloadUpload(preview.fileUrl, displayName).catch(() =>
                  setError("Could not download this file.")
                )
              }
              className="btn-secondary flex items-center gap-2 !py-2 !px-4 shadow-xs cursor-pointer text-xs font-semibold"
            >
              <Download size={15} />
              <span>Download</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {loading ? (
          <div className="m-auto flex flex-col items-center gap-3 p-8 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-violet-600 border-t-transparent" />
            <p className="text-sm font-semibold">Opening file preview...</p>
          </div>
        ) : error ? (
          <section role="alert" className="m-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-lg border border-rose-100">
            <h2 className="text-lg font-bold text-rose-700">Preview Unavailable</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
          </section>
        ) : parsedData?.type === "docx" ? (
          /* 1. WORD DOCUMENT VIEWER (.docx, .doc) */
          <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">
            {/* Word Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-2.5 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-bold text-blue-700 border border-blue-100">
                  Microsoft Word Document
                </span>
                {parsedData.wordCount && (
                  <span className="text-slate-400">· ~{parsedData.wordCount} words</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-slate-600">
                  <button
                    onClick={() => setDocxZoom((z) => Math.max(z - 10, 80))}
                    title="Zoom Out"
                    className="p-1 rounded-lg hover:bg-slate-200 cursor-pointer"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="px-2 font-mono text-[11px] font-bold select-none">{docxZoom}%</span>
                  <button
                    onClick={() => setDocxZoom((z) => Math.min(z + 10, 140))}
                    title="Zoom In"
                    className="p-1 rounded-lg hover:bg-slate-200 cursor-pointer"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>

                {/* Copy Text */}
                <button
                  onClick={() => handleCopyText(parsedData.extractedText)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                >
                  {copied ? <CheckCheck size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copied ? "Copied" : "Copy Text"}</span>
                </button>

                {/* Print */}
                <button
                  onClick={handlePrintDoc}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* Document Reading View */}
            <div className="flex-1 overflow-auto p-4 sm:p-8">
              <article
                style={{ fontSize: `${docxZoom}%` }}
                className="mx-auto max-w-4xl rounded-2xl border border-slate-200/90 bg-white p-8 sm:p-14 shadow-lg transition-all duration-150"
              >
                {/* Word Document Inner Prose */}
                <div
                  className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-relaxed prose-table:w-full prose-table:border-collapse prose-table:border prose-table:border-slate-300 prose-th:bg-slate-100 prose-th:p-2.5 prose-th:border prose-th:border-slate-300 prose-td:p-2.5 prose-td:border prose-td:border-slate-300 [&_table]:my-4 [&_table]:border [&_table]:border-slate-300 [&_td]:p-2 [&_td]:border [&_td]:border-slate-300 [&_tr]:border-b"
                  dangerouslySetInnerHTML={{ __html: parsedData.html }}
                />
              </article>
            </div>
          </div>
        ) : parsedData?.type === "pptx" ? (
          /* 2. POWERPOINT PRESENTATION VIEWER (.pptx, .ppt) */
          <div className={`flex flex-1 flex-col overflow-hidden ${isFullscreen ? "bg-slate-950 text-white" : "bg-slate-900 text-slate-100"}`}>
            {/* Slide Navigation Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-6 py-2.5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-400 border border-amber-500/20">
                  <Presentation size={14} />
                  PowerPoint Presentation
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  Slide {activeSlideIdx + 1} of {parsedData.slides?.length || 1}
                </span>
              </div>

              {/* Slide Navigation Buttons */}
              <div className="flex items-center gap-2">
                <button
                  disabled={activeSlideIdx === 0}
                  onClick={() => setActiveSlideIdx((i) => Math.max(i - 1, 0))}
                  className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>

                <button
                  disabled={activeSlideIdx >= (parsedData.slides?.length || 1) - 1}
                  onClick={() => setActiveSlideIdx((i) => Math.min(i + 1, parsedData.slides.length - 1))}
                  className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40 cursor-pointer transition-colors shadow-xs"
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                {/* Fullscreen Toggle */}
                <button
                  onClick={() => setIsFullscreen((f) => !f)}
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
                  className="rounded-xl bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
            </div>

            {/* Main Presentation Stage */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left Filmstrip / Thumbnails */}
              {!isFullscreen && (
                <aside className="w-64 border-r border-slate-800 bg-slate-950/60 overflow-y-auto p-3 flex flex-col gap-2 select-none">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                    <span>Slides</span>
                    <span className="text-amber-400">{parsedData.slides?.length}</span>
                  </div>

                  {parsedData.slides?.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlideIdx(idx)}
                      className={`flex flex-col text-left rounded-xl p-3 text-xs transition-all cursor-pointer border ${
                        activeSlideIdx === idx
                          ? "bg-amber-500/10 border-amber-500/50 text-amber-200 shadow-sm"
                          : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold mb-1">
                        <span className="text-[10px] text-slate-500">#{s.slideNumber}</span>
                        {activeSlideIdx === idx && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        )}
                      </div>
                      <span className="truncate font-semibold text-slate-200">{s.title || `Slide ${idx + 1}`}</span>
                      <span className="text-[10px] text-slate-500 truncate mt-0.5">
                        {s.bullets?.[0] || "No content"}
                      </span>
                    </button>
                  ))}
                </aside>
              )}

              {/* Active Slide Canvas (16:9 Presentation Card) */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto bg-slate-900/30">
                <div className="w-full max-w-4xl aspect-[16/9] min-h-[420px] rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
                  {/* Subtle decorative background gradient */}
                  <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

                  {/* Slide Header */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="rounded-full bg-slate-800 px-3 py-1 font-mono text-[11px] font-bold text-amber-400">
                        SLIDE {activeSlide?.slideNumber || activeSlideIdx + 1}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">{displayName}</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                      {activeSlide?.title || `Slide ${activeSlideIdx + 1}`}
                    </h2>
                  </div>

                  {/* Slide Content / Bullets */}
                  <div className="flex-1 my-6 overflow-y-auto pr-2">
                    {activeSlide?.bullets && activeSlide.bullets.length > 0 ? (
                      <ul className="space-y-3.5">
                        {activeSlide.bullets.map((bullet, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-3 text-sm sm:text-base text-slate-200 leading-relaxed">
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-slate-400 italic">
                        {activeSlide?.text || "No text content on this slide."}
                      </div>
                    )}
                  </div>

                  {/* Slide Footer */}
                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs text-slate-500">
                    <span>Univo Presentation Studio</span>
                    <span>Use Left/Right arrow keys to navigate</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : parsedData?.type === "excel" ? (
          /* 3. EXCEL SPREADSHEET PREVIEWER */
          <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
            {/* Quick Direct Open In Excel Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-emerald-50 border-b border-emerald-100 px-6 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-950">
                <FileSpreadsheet size={16} className="text-emerald-700 shrink-0" />
                <span>Viewing spreadsheet summary in Univo. You can open and edit this file directly in Microsoft Excel on your computer.</span>
              </div>
              <button
                type="button"
                onClick={handleOpenInNativeApp}
                className="btn-primary !bg-emerald-600 hover:!bg-emerald-700 !text-white flex items-center gap-1.5 !py-1.5 !px-3.5 text-xs shadow-xs cursor-pointer font-bold"
              >
                <ExternalLink size={14} />
                <span>Open directly in Excel</span>
              </button>
            </div>

            {/* Sheet Tabs & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-2.5 shadow-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {parsedData.sheets.map((sheet, sIdx) => (
                  <button
                    key={sIdx}
                    onClick={() => {
                      setActiveSheetIdx(sIdx);
                      setPage(1);
                    }}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      activeSheetIdx === sIdx
                        ? "bg-violet-700 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Table size={14} />
                    <span>{sheet.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeSheetIdx === sIdx ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                      {sheet.rows.length}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative min-w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search in ${activeSheet?.name || "sheet"}...`}
                  value={sheetSearch}
                  onChange={(e) => {
                    setSheetSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Grid Table */}
            <div className="flex-1 overflow-auto p-4">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {pagedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-400">
                          No matching records found in this sheet.
                        </td>
                      </tr>
                    ) : (
                      pagedRows.map((row, rIdx) => {
                        const actualRowIndex = (page - 1) * rowsPerPage + rIdx + 1;
                        const isHeaderRow = rIdx === 0 && page === 1;

                        return (
                          <tr
                            key={rIdx}
                            className={`${
                              isHeaderRow
                                ? "bg-slate-100/90 font-bold text-slate-900 sticky top-0 border-b border-slate-200 shadow-xs"
                                : "hover:bg-violet-50/40 transition-colors"
                            }`}
                          >
                            <td className="w-12 px-3 py-2 text-center font-mono text-[10px] text-slate-400 bg-slate-50/80 border-r border-slate-100 select-none">
                              {actualRowIndex}
                            </td>

                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className={`px-4 py-2.5 text-slate-700 whitespace-nowrap border-r border-slate-50 ${
                                  isHeaderRow ? "font-bold text-slate-900" : ""
                                }`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-2.5 text-xs text-slate-600">
                <span>
                  Showing {((page - 1) * rowsPerPage) + 1} to {Math.min(page * rowsPerPage, filteredRows.length)} of {filteredRows.length} rows
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="p-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-semibold text-slate-800">Page {page} of {totalPages}</span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : parsedData?.type === "text" ? (
          /* 4. TEXT / CODE FILE VIEWER */
          <div className="flex flex-1 flex-col overflow-hidden bg-slate-900 text-slate-100 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">Lines: {parsedData.extractedText.split("\n").length}</span>
              <button
                onClick={() => handleCopyText(parsedData.extractedText)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {copied ? <CheckCheck size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy Content"}</span>
              </button>
            </div>
            <pre className="flex-1 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
              {parsedData.extractedText}
            </pre>
          </div>
        ) : isVideo ? (
          /* 5. VIDEO PLAYER */
          <div className="flex flex-1 items-center justify-center p-6 bg-slate-950">
            <video
              controls
              autoPlay
              src={preview.url}
              className="max-h-[calc(100vh-8rem)] max-w-full rounded-2xl shadow-2xl border border-slate-800"
            />
          </div>
        ) : isAudio ? (
          /* 6. AUDIO PLAYER */
          <div className="flex flex-1 items-center justify-center p-6 bg-slate-900">
            <div className="rounded-3xl bg-slate-950 p-8 border border-slate-800 shadow-2xl max-w-md w-full text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 mb-4 border border-rose-500/20">
                <Music size={28} />
              </div>
              <h3 className="text-white font-bold text-base mb-1 truncate">{displayName}</h3>
              <p className="text-xs text-slate-400 mb-6 uppercase tracking-wider font-semibold">{ext} Audio Stream</p>
              <audio controls autoPlay src={preview.url} className="w-full" />
            </div>
          </div>
        ) : isImage ? (
          /* 7. IMAGE VIEWER */
          <div className="flex flex-1 items-center justify-center overflow-auto p-6 bg-slate-900/5">
            <img
              src={preview.url}
              alt={displayName}
              className="max-h-[calc(100vh-8rem)] max-w-full rounded-2xl object-contain shadow-xl border border-slate-200/80 bg-white"
            />
          </div>
        ) : isPdf ? (
          /* 8. PDF VIEWER */
          <iframe title={displayName} src={preview.url} className="min-h-0 flex-1 border-0 w-full h-full" />
        ) : (
          /* 9. GENERIC FALLBACK */
          <section className="m-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-slate-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 mb-4">
              <FileText size={28} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{displayName}</h2>
            <p className="mt-2 text-xs text-slate-500">
              Direct preview for this binary file type ({ext}) is ready. Click below to download and open directly on your device.
            </p>
            <button
              onClick={() => preview && void downloadUpload(preview.fileUrl, displayName)}
              className="btn-primary mt-5 w-full flex items-center justify-center gap-2 cursor-pointer !py-2.5 font-bold"
            >
              <Download size={16} />
              <span>Download & Open on Device</span>
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
