import api from "../api/axios";

export function uploadUrl(fileUrl, filename, disposition) {
  const match = /^\/uploads\/(circulars|resources|proofs)\/([^/]+)$/.exec(fileUrl || "");
  if (!match) throw new Error("Invalid uploaded file URL");
  const [, category, storedFilename] = match;
  const params = new URLSearchParams({ disposition });
  if (filename) params.set("name", filename);
  return `/files/${category}/${encodeURIComponent(storedFilename)}?${params.toString()}`;
}

function getFilename(fileUrl, filename) {
  if (filename) return filename;
  const storedFilename = fileUrl?.split("/").pop();
  return storedFilename || "download";
}

export async function openUpload(fileUrl, filename) {
  const match = /^\/uploads\/(circulars|resources|proofs)\/([^/]+)$/.exec(fileUrl || "");
  if (!match) throw new Error("Invalid uploaded file URL");
  const [, category, storedFilename] = match;
  const params = new URLSearchParams();
  if (filename) params.set("name", filename);
  const query = params.size ? `?${params.toString()}` : "";
  const previewPath = `/file-preview/${category}/${encodeURIComponent(storedFilename)}${query}`;
  window.open(previewPath, "_blank", "noopener,noreferrer");
}

export async function downloadUpload(fileUrl, filename) {
  const response = await api.get(uploadUrl(fileUrl, filename, "attachment"), { responseType: "blob" });
  const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/octet-stream" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = getFilename(fileUrl, filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
