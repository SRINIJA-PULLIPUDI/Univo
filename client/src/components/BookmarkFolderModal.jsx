import { useEffect, useState } from "react";
import { Folder, FolderPlus, Bookmark, Check, Trash2, CheckSquare, Square, Search } from "lucide-react";
import api from "../api/axios";
import { Modal } from "./ui";

export default function BookmarkFolderModal({
  isOpen,
  onClose,
  itemTitle,
  initialFolder = "General",
  isBookmarked = false,
  onSave,
  onRemove,
}) {
  const [folders, setFolders] = useState(["General"]);
  const [selectedFolders, setSelectedFolders] = useState([initialFolder || "General"]);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const initialList = Array.isArray(initialFolder)
      ? initialFolder
      : [initialFolder || "General"];
    setSelectedFolders(initialList);
    setError("");
    setSearchQuery("");
    api.get("/bookmarks/folders")
      .then((res) => {
        const rawFolders = res.data.folders || ["General"];
        const general = "General";
        const others = rawFolders
          .filter((f) => f.toLowerCase() !== general.toLowerCase())
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
        setFolders([general, ...others]);
      })
      .catch(() => setFolders(["General"]));
  }, [isOpen, initialFolder]);

  function toggleFolder(folderName) {
    setSelectedFolders((prev) =>
      prev.includes(folderName)
        ? prev.filter((f) => f !== folderName)
        : [...prev, folderName]
    );
  }

  const filteredFolders = folders.filter((f) =>
    f.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  function toggleSelectAll() {
    const listToToggle = searchQuery ? filteredFolders : folders;
    const allSelected =
      listToToggle.length > 0 &&
      listToToggle.every((f) => selectedFolders.includes(f));
    if (allSelected) {
      setSelectedFolders((prev) => prev.filter((f) => !listToToggle.includes(f)));
    } else {
      setSelectedFolders((prev) => [...new Set([...prev, ...listToToggle])]);
    }
  }

  async function handleCreateFolder(e) {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) {
      setError("Please enter folder name first.");
      return;
    }
    if (folders.some((f) => f.toLowerCase() === name.toLowerCase())) {
      setError("A folder with that name already exists.");
      return;
    }
    setCreatingFolder(true);
    setError("");
    try {
      const res = await api.post("/bookmarks/folders", { name });
      const createdName = res.data.folder.name;
      const updated = [
        "General",
        ...folders.filter((f) => f.toLowerCase() !== "general" && f.toLowerCase() !== createdName.toLowerCase()),
        createdName,
      ];
      const others = updated
        .filter((f) => f.toLowerCase() !== "general")
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      setFolders(["General", ...others]);
      setSelectedFolders((prev) => [...prev, createdName]);
      setNewFolderName("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not create folder.");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleSave() {
    if (!selectedFolders.length) {
      setError("Please select at least one folder.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave(selectedFolders);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save bookmark.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!onRemove) return;
    setBusy(true);
    setError("");
    try {
      await onRemove();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove bookmark.");
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) return null;

  const isAllSelected =
    filteredFolders.length > 0 &&
    filteredFolders.every((f) => selectedFolders.includes(f));

  return (
    <Modal title="Bookmark to Folders" onClose={onClose}>
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 font-medium">Select one or more destination folders:</p>
            <p className="text-sm font-bold text-slate-800 truncate mt-0.5" title={itemTitle}>
              {itemTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-xs font-semibold text-violet-600 hover:text-violet-800 shrink-0 cursor-pointer"
          >
            {isAllSelected ? "Deselect All" : "Select All"}
          </button>
        </div>

        {/* Search Folders Input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field !pl-8.5 !py-2 text-xs"
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 cursor-pointer"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Multi-Select Folder List */}
        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
          {filteredFolders.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 font-medium">
              No matching folders found for &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredFolders.map((f) => {
              const isSelected = selectedFolders.includes(f);
              return (
                <button
                  type="button"
                  key={f}
                  onClick={() => toggleFolder(f)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "border-violet-600 bg-violet-50/80 text-violet-900 shadow-xs"
                      : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className={`flex h-4 w-4 items-center justify-center rounded border ${isSelected ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white"}`}>
                      {isSelected && <Check size={12} />}
                    </div>
                    <Folder size={16} className={isSelected ? "text-violet-600" : "text-slate-400"} />
                    <span className="truncate">{f}</span>
                    {f === "General" && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                        Default
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-[11px] font-bold text-violet-600">Selected</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Quick New Folder Creation */}
        <div>
          <form onSubmit={handleCreateFolder} className="flex gap-2 pt-1 border-t border-slate-100">
            <input
              className="input-field text-xs !py-2"
              placeholder="Create new folder..."
              maxLength={40}
              value={newFolderName}
              onChange={(e) => {
                setNewFolderName(e.target.value);
                if (error) setError("");
              }}
            />
            <button
              type="submit"
              disabled={creatingFolder}
              className="btn-secondary shrink-0 !py-2 !px-3 text-xs"
            >
              <FolderPlus size={14} /> Add
            </button>
          </form>
          {error && (
            <p className="mt-1 text-xs font-medium text-rose-600">
              {error}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          {isBookmarked && onRemove ? (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="btn-ghost !text-rose-600 hover:!bg-rose-50 !py-2 text-xs font-semibold cursor-pointer"
            >
              <Trash2 size={14} /> Remove Bookmark
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-secondary !py-2 text-xs cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || selectedFolders.length === 0}
              className="btn-primary !py-2 text-xs cursor-pointer"
            >
              <Bookmark size={14} /> {selectedFolders.length > 1 ? `Save to ${selectedFolders.length} Folders` : "Save Bookmark"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
