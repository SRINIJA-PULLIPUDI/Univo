import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Bookmark,
  Download,
  Folder,
  FolderPlus,
  Pencil,
  Search,
  Trash2,
  FolderInput,
  FileText,
  Eye,
} from "lucide-react";
import api from "../api/axios";
import Topbar from "../components/Topbar";
import { EmptyState, Modal } from "../components/ui";
import { downloadUpload, openUpload } from "../utils/uploadUrls";
import { useAuth } from "../context/AuthContext";
import { getPortalTheme } from "../utils/portalThemes";

export default function Bookmarks() {
  const { user } = useAuth();
  const theme = getPortalTheme(user?.role);

  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState(["General"]);
  const [selectedFolder, setSelectedFolder] = useState(null); // null = Folders View, string = Inside Folder
  const [newFolder, setNewFolder] = useState("");
  const [folderError, setFolderError] = useState("");
  const [folderQuery, setFolderQuery] = useState("");
  const [fileQuery, setFileQuery] = useState("");

  // Move item modal state
  const [movingBookmark, setMovingBookmark] = useState(null);
  const [targetMoveFolders, setTargetMoveFolders] = useState([]);
  const [moveFolderQuery, setMoveFolderQuery] = useState("");

  // Rename folder modal state
  const [renamingFolder, setRenamingFolder] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");

  const load = () =>
    Promise.all([api.get("/bookmarks"), api.get("/bookmarks/folders")]).then(
      ([bookmarksResponse, foldersResponse]) => {
        setItems(bookmarksResponse.data.bookmarks.filter((b) => b.resource || b.circular || b.fileUrl));
        setFolders(foldersResponse.data.folders || ["General"]);
      }
    );

  useEffect(() => {
    load();
  }, []);

  // Folders ordering: "General" is always first, remaining folders sorted alphabetically
  const orderedFolders = useMemo(() => {
    const raw = folders.length ? folders : ["General"];
    const hasGeneral = raw.some((f) => f.toLowerCase() === "general");
    const others = raw
      .filter((f) => f.toLowerCase() !== "general")
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return hasGeneral ? ["General", ...others] : others;
  }, [folders]);

  const filteredMoveFolders = useMemo(() => {
    if (!moveFolderQuery.trim()) return orderedFolders;
    return orderedFolders.filter((f) =>
      f.toLowerCase().includes(moveFolderQuery.trim().toLowerCase())
    );
  }, [orderedFolders, moveFolderQuery]);

  // Folders matching search on main page
  const filteredFolders = useMemo(() => {
    if (!folderQuery.trim()) return orderedFolders;
    return orderedFolders.filter((f) =>
      f.toLowerCase().includes(folderQuery.trim().toLowerCase())
    );
  }, [orderedFolders, folderQuery]);

  // Files inside the selected folder matching file search
  const folderFiles = useMemo(() => {
    if (!selectedFolder) return [];
    const filesInFolder = items.filter((b) => b.folder === selectedFolder);
    if (!fileQuery.trim()) return filesInFolder;
    const q = fileQuery.trim().toLowerCase();
    return filesInFolder.filter((bookmark) => {
      const item = bookmark.resource || bookmark.circular || {
        title: bookmark.title,
        fileName: bookmark.fileName,
        fileUrl: bookmark.fileUrl,
        type: bookmark.fileType,
        category: "Resource",
        subject: { name: bookmark.subjectName },
        uploadedBy: { name: bookmark.uploadedByName },
      };
      const searchable = `${item.title || item.fileName || ""} ${item.fileName || ""} ${
        item.subject?.name || ""
      } ${item.type || ""} ${item.category || ""} ${item.uploadedBy?.name || ""}`.toLowerCase();
      return searchable.includes(q);
    });
  }, [items, selectedFolder, fileQuery]);

  async function createFolder(e) {
    e.preventDefault();
    const name = newFolder.trim();
    if (!name) {
      setFolderError("Please enter folder name first.");
      return;
    }
    if (folders.some((f) => f.toLowerCase() === name.toLowerCase())) {
      setFolderError("A folder with that name already exists.");
      return;
    }
    try {
      const response = await api.post("/bookmarks/folders", { name });
      const created = response.data.folder.name;
      setFolders((current) => [...new Set([...current, created])]);
      setNewFolder("");
      setFolderError("");
    } catch (error) {
      setFolderError(error.response?.data?.message || "Could not create the folder.");
    }
  }

  async function handleRenameSubmit(e) {
    e.preventDefault();
    const oldName = renamingFolder;
    const name = renameValue.trim();
    if (!name || name === oldName) {
      setRenamingFolder(null);
      return;
    }
    try {
      await api.patch("/bookmarks/folders", { oldName, name });
      if (selectedFolder === oldName) setSelectedFolder(name);
      setRenamingFolder(null);
      setRenameValue("");
      setRenameError("");
      await load();
    } catch (error) {
      setRenameError(error.response?.data?.message || "Could not rename the folder.");
    }
  }

  async function deleteFolder(name, e) {
    e?.stopPropagation();
    if (!confirm(`Delete "${name}"? All saved items inside it will be moved to General.`)) return;
    try {
      await api.delete(`/bookmarks/folders/${encodeURIComponent(name)}`);
      if (selectedFolder === name) setSelectedFolder(null);
      await load();
    } catch (error) {
      setFolderError(error.response?.data?.message || "Could not delete the folder.");
    }
  }

  async function removeBookmark(bookmarkId, e) {
    e?.stopPropagation();
    try {
      await api.delete(`/bookmarks/${bookmarkId}`);
      await load();
    } catch (error) {
      window.alert(error.response?.data?.message || "Could not remove bookmark.");
    }
  }

  async function handleMoveSubmit(e) {
    e.preventDefault();
    if (!movingBookmark || !targetMoveFolders.length) return;
    try {
      await api.patch(`/bookmarks/${movingBookmark._id}`, { folders: targetMoveFolders });
      setMovingBookmark(null);
      setTargetMoveFolders([]);
      await load();
    } catch (error) {
      window.alert(error.response?.data?.message || "Could not save bookmark to folders.");
    }
  }

  return (
    <>
      <Topbar
        title="Bookmarks"
        subtitle={
          selectedFolder
            ? `Viewing files in folder "${selectedFolder}".`
            : "Your saved study material and circulars, organized in custom folders."
        }
      />

      <div className="space-y-6 p-6 sm:p-8 max-w-7xl">
        {/* ========================================================= */}
        {/* VIEW 1: MAIN FOLDERS DIRECTORY VIEW                       */}
        {/* ========================================================= */}
        {selectedFolder === null ? (
          <div className="space-y-6">
            {/* Top Create Folder Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="w-full max-w-md">
                <form onSubmit={createFolder} className="flex gap-2">
                  <input
                    className="input-field text-sm"
                    maxLength={40}
                    placeholder="Create a new folder..."
                    value={newFolder}
                    onChange={(e) => {
                      setNewFolder(e.target.value);
                      if (folderError) setFolderError("");
                    }}
                  />
                  <button type="submit" className="btn-secondary shrink-0 !py-2.5 !px-4 text-xs font-bold cursor-pointer">
                    <FolderPlus size={16} /> Create folder
                  </button>
                </form>
                {folderError && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600">
                    {folderError}
                  </p>
                )}
              </div>

              {/* Folder Search Bar */}
              <label className="relative block w-full max-w-xs">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input-field !pl-10 text-xs"
                  value={folderQuery}
                  onChange={(e) => setFolderQuery(e.target.value)}
                  placeholder="Search folder names..."
                />
              </label>
            </div>

            {/* Folders Grid */}
            {filteredFolders.length === 0 ? (
              <EmptyState icon={Search} title="No matching folders" subtitle="Try searching for a different folder name." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredFolders.map((f) => {
                  const count = items.filter((b) => b.folder === f).length;
                  const isGeneral = f === "General";

                  return (
                    <div
                      key={f}
                      onClick={() => {
                        setSelectedFolder(f);
                        setFileQuery("");
                      }}
                      className="card card-hover group !p-5 cursor-pointer flex flex-col justify-between transition-all duration-200 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                            isGeneral
                              ? "bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-white transition-colors"
                              : "bg-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white transition-colors"
                          }`}
                        >
                          <Folder size={24} />
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                          {count} {count === 1 ? "file" : "files"}
                        </span>
                      </div>

                      <div className="mt-4 min-w-0">
                        <h3 className="truncate text-base font-extrabold text-slate-900 group-hover:text-primary transition-colors">
                          {f}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-400 font-medium">
                          {isGeneral ? "Default storage folder" : "Click to view files"}
                        </p>
                      </div>

                      {/* Folder Action Buttons */}
                      <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-400">
                          {isGeneral ? "Protected" : "Custom Folder"}
                        </span>

                        {!isGeneral && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenamingFolder(f);
                                setRenameValue(f);
                                setRenameError("");
                              }}
                              className="btn-ghost !p-1.5 text-slate-500 hover:text-slate-800"
                              title={`Rename ${f}`}
                              aria-label={`Rename ${f}`}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => deleteFolder(f, e)}
                              className="btn-ghost !p-1.5 text-rose-500 hover:text-rose-700 hover:!bg-rose-50"
                              title={`Delete ${f}`}
                              aria-label={`Delete ${f}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* VIEW 2: DRILL-DOWN FOLDER FILES VIEW                      */
          /* ========================================================= */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Navigation Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pb-4 border-b border-slate-200/80">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFolder(null);
                    setFileQuery("");
                  }}
                  className="btn-secondary !py-2 !px-3.5 text-xs font-bold"
                >
                  <ArrowLeft size={15} /> All Folders
                </button>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Folder size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 leading-tight">{selectedFolder}</h2>
                    <span className="text-xs font-semibold text-slate-400">
                      {folderFiles.length} {folderFiles.length === 1 ? "file" : "files"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dedicated Search Bar for Files in this Folder */}
              <label className="relative block w-full max-w-sm">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input-field !pl-10 text-xs"
                  value={fileQuery}
                  onChange={(e) => setFileQuery(e.target.value)}
                  placeholder={`Search files in ${selectedFolder}...`}
                />
              </label>
            </div>

            {/* Files List */}
            {folderFiles.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title={`No files in "${selectedFolder}"`}
                subtitle="Files bookmarked into this folder will appear here. Click on any file to open preview directly."
              />
            ) : (
              <div className="space-y-3">
                {folderFiles.map((b) => {
                  const item = b.resource || b.circular;
                  const type = b.resource ? "resource" : "circular";
                  const meta =
                    type === "resource"
                      ? `${item.subject?.name || "Subject"} · ${item.type || "Resource"}`
                      : `${item.category || "Circular"} · ${item.uploadedBy?.name || "Official Notice"}`;

                  return (
                    <div
                      key={b._id}
                      onClick={() => {
                        void openUpload(item.fileUrl, item.fileName).catch((error) =>
                          window.alert(
                            error.response?.data?.message || error.message || "Could not open this file."
                          )
                        );
                      }}
                      className="card card-hover flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 !p-4 cursor-pointer transition-all duration-150 hover:border-slate-300"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-violet-100 group-hover:text-violet-700 transition-colors">
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-slate-900 text-sm hover:text-primary transition-colors">
                            {item.title || item.fileName}
                          </p>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">{meta}</p>
                        </div>
                      </div>

                      {/* Action Buttons: Move, Download, Remove */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMovingBookmark(b);
                            setTargetMoveFolders([b.folder]);
                            setMoveFolderQuery("");
                          }}
                          className="btn-secondary !py-1.5 !px-3 !text-xs font-semibold"
                          title="Move to another folder"
                        >
                          <FolderInput size={14} /> Move
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openUpload(item.fileUrl, item.fileName).catch((error) =>
                              window.alert(error.response?.data?.message || error.message || "Could not open file.")
                            );
                          }}
                          className="btn-secondary !py-1.5 !px-3 !text-xs font-semibold flex items-center gap-1.5"
                          title="Preview file"
                          aria-label={`Preview ${item.title || item.fileName}`}
                        >
                          <Eye size={14} /> Preview
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void downloadUpload(item.fileUrl, item.fileName).catch((error) =>
                              window.alert(error.response?.data?.message || "Could not download file.")
                            );
                          }}
                          className="btn-secondary !py-1.5 !px-3 !text-xs font-semibold flex items-center gap-1.5"
                          title="Download file"
                          aria-label={`Download ${item.title || item.fileName}`}
                        >
                          <Download size={14} /> Download
                        </button>

                        <button
                          type="button"
                          onClick={(e) => removeBookmark(b._id, e)}
                          className="btn-ghost !text-rose-600 hover:!bg-rose-50 !p-2"
                          title="Remove bookmark from this folder"
                          aria-label="Remove bookmark from this folder"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: RENAME FOLDER                                      */}
      {/* ========================================================= */}
      {renamingFolder && (
        <Modal title={`Rename "${renamingFolder}"`} onClose={() => setRenamingFolder(null)}>
          <form onSubmit={handleRenameSubmit} className="space-y-4">
            {renameError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs text-rose-700">
                {renameError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Folder Name</label>
              <input
                autoFocus
                className="input-field"
                maxLength={40}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Enter new folder name..."
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary !py-2 text-xs"
                onClick={() => setRenamingFolder(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary !py-2 text-xs">
                Save Name
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL: MOVE / COPY BOOKMARK TO FOLDERS                    */}
      {/* ========================================================= */}
      {movingBookmark && (
        <Modal title="Move or Save to Folders" onClose={() => setMovingBookmark(null)}>
          <form onSubmit={handleMoveSubmit} className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500 font-medium truncate">
                Select folders for:{" "}
                <strong className="text-slate-800">
                  {movingBookmark.resource?.title ||
                    movingBookmark.circular?.title ||
                    movingBookmark.title ||
                    movingBookmark.fileName ||
                    "this bookmark"}
                </strong>
              </p>
              <button
                type="button"
                onClick={() => {
                  const list = filteredMoveFolders;
                  const allSelected = list.length > 0 && list.every((f) => targetMoveFolders.includes(f));
                  if (allSelected) {
                    setTargetMoveFolders((prev) => prev.filter((item) => !list.includes(item)));
                  } else {
                    setTargetMoveFolders((prev) => [...new Set([...prev, ...list])]);
                  }
                }}
                className="text-xs font-semibold text-violet-600 hover:text-violet-800 shrink-0 cursor-pointer"
              >
                {filteredMoveFolders.length > 0 && filteredMoveFolders.every((f) => targetMoveFolders.includes(f))
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            {/* Search Folders in Move Modal */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input-field !pl-8.5 !py-2 text-xs"
                placeholder="Search folders..."
                value={moveFolderQuery}
                onChange={(e) => setMoveFolderQuery(e.target.value)}
              />
              {moveFolderQuery && (
                <button
                  type="button"
                  onClick={() => setMoveFolderQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {filteredMoveFolders.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-medium">
                  No matching folders found for &quot;{moveFolderQuery}&quot;
                </div>
              ) : (
                filteredMoveFolders.map((f) => {
                  const isSelected = targetMoveFolders.includes(f);
                  const isCurrent = movingBookmark.folder === f;
                  return (
                    <button
                      type="button"
                      key={f}
                      onClick={() => {
                        setTargetMoveFolders((prev) =>
                          prev.includes(f) ? prev.filter((item) => item !== f) : [...prev, f]
                        );
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? "border-violet-600 bg-violet-50 text-violet-900 shadow-2xs"
                          : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className={`flex h-4 w-4 items-center justify-center rounded border ${isSelected ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white"}`}>
                          {isSelected && <span className="text-[10px] font-bold">✓</span>}
                        </div>
                        <Folder size={16} className={isSelected ? "text-violet-600" : "text-slate-400"} />
                        <span>{f}</span>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                          Current Folder
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="btn-secondary !py-2 text-xs cursor-pointer"
                onClick={() => setMovingBookmark(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!targetMoveFolders.length}
                className="btn-primary !py-2 text-xs cursor-pointer"
              >
                Save to {targetMoveFolders.length} {targetMoveFolders.length === 1 ? "Folder" : "Folders"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
