const Bookmark = require("../models/Bookmark");
const BookmarkFolder = require("../models/BookmarkFolder");
const Resource = require("../models/Resource");
const Circular = require("../models/Circular");

exports.listBookmarks = async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ user: req.user._id })
      .populate({ path: "resource", populate: { path: "subject", select: "name code" } })
      .populate({ path: "circular", populate: { path: "uploadedBy", select: "name" } })
      .sort({ createdAt: -1 });
    res.json({ bookmarks });
  } catch (err) {
    res.status(500).json({ message: "Could not load bookmarks", error: err.message });
  }
};

exports.listFolders = async (req, res) => {
  try {
    const folders = await BookmarkFolder.find({ user: req.user._id }).sort({ name: 1 }).lean();
    res.json({ folders: ["General", ...folders.map((folder) => folder.name)] });
  } catch (err) {
    res.status(500).json({ message: "Could not load bookmark folders", error: err.message });
  }
};

exports.createFolder = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name || name.length > 40) return res.status(400).json({ message: "Folder name must be 1 to 40 characters" });
    if (name.toLowerCase() === "general") return res.status(400).json({ message: "General is a reserved folder name" });
    const folder = await BookmarkFolder.findOneAndUpdate(
      { user: req.user._id, name },
      { $setOnInsert: { user: req.user._id, name } },
      { upsert: true, new: true }
    );
    res.status(201).json({ folder });
  } catch (err) {
    res.status(500).json({ message: "Could not create bookmark folder", error: err.message });
  }
};

exports.renameFolder = async (req, res) => {
  try {
    const oldName = String(req.body.oldName || "").trim();
    const name = String(req.body.name || "").trim();
    if (!oldName || !name || name.length > 40) {
      return res.status(400).json({ message: "Folder names must be 1 to 40 characters" });
    }
    if (oldName.toLowerCase() === "general" || name.toLowerCase() === "general") {
      return res.status(400).json({ message: "General is a reserved folder name" });
    }
    const folder = await BookmarkFolder.findOne({ user: req.user._id, name: oldName });
    if (!folder) return res.status(404).json({ message: "Folder not found" });
    if (await BookmarkFolder.exists({ user: req.user._id, name })) {
      return res.status(409).json({ message: "A folder with that name already exists" });
    }
    await Bookmark.updateMany({ user: req.user._id, folder: oldName }, { $set: { folder: name } });
    folder.name = name;
    await folder.save();
    res.json({ folder });
  } catch (err) {
    res.status(500).json({ message: "Could not rename bookmark folder", error: err.message });
  }
};

exports.deleteFolder = async (req, res) => {
  try {
    const name = String(req.params.name || "").trim();
    if (name.toLowerCase() === "general") {
      return res.status(400).json({ message: "The General folder cannot be deleted" });
    }
    const folder = await BookmarkFolder.findOne({ user: req.user._id, name });
    if (!folder) return res.status(404).json({ message: "Folder not found" });
    await Bookmark.updateMany({ user: req.user._id, folder: name }, { $set: { folder: "General" } });
    await folder.deleteOne();
    res.json({ message: "Folder deleted; saved items were moved to General" });
  } catch (err) {
    res.status(500).json({ message: "Could not delete bookmark folder", error: err.message });
  }
};

exports.addBookmark = async (req, res) => {
  try {
    const { resourceId, circularId, folder, folders } = req.body || {};

    if (!resourceId && !circularId) {
      return res.status(400).json({ message: "A resourceId or circularId is required" });
    }

    const rawFolders = folders || folder;
    let targetFolders = [];
    if (Array.isArray(rawFolders)) {
      targetFolders = rawFolders.flat().filter(Boolean).map((f) => String(f).trim());
    } else if (rawFolders) {
      targetFolders = [String(rawFolders).trim()];
    }
    if (targetFolders.length === 0) targetFolders = ["General"];

    let snapshot = {};
    if (resourceId) {
      const r = await Resource.findById(resourceId).populate("subject", "name").populate("uploadedBy", "name");
      if (r) {
        snapshot = {
          title: r.title,
          fileName: r.fileName,
          fileUrl: r.fileUrl,
          fileType: r.type,
          subjectName: r.subject?.name || "",
          uploadedByName: r.uploadedBy?.name || "",
        };
      }
    } else if (circularId) {
      const c = await Circular.findById(circularId).populate("uploadedBy", "name");
      if (c) {
        snapshot = {
          title: c.title,
          fileName: c.fileName,
          fileUrl: c.fileUrl,
          fileType: "Circular",
          uploadedByName: c.uploadedBy?.name || "",
        };
      }
    }

    const created = [];
    for (const f of targetFolders) {
      const query = {
        user: req.user._id,
        folder: f,
        ...(resourceId ? { resource: resourceId } : {}),
        ...(circularId ? { circular: circularId } : {}),
      };
      const update = {
        user: req.user._id,
        folder: f,
        ...(resourceId ? { resource: resourceId } : {}),
        ...(circularId ? { circular: circularId } : {}),
        ...snapshot,
      };
      const bookmark = await Bookmark.findOneAndUpdate(query, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
      created.push(bookmark);
    }

    res.status(201).json({ bookmark: created[0], bookmarks: created });
  } catch (err) {
    res.status(500).json({ message: "Could not add bookmark", error: err.message });
  }
};

exports.batchAddBookmarks = async (req, res) => {
  try {
    const { resourceIds, folders } = req.body;
    if (!Array.isArray(resourceIds) || !resourceIds.length) {
      return res.status(400).json({ message: "resourceIds array is required" });
    }
    const targetFolders = Array.isArray(folders) && folders.length ? folders : ["General"];
    const resources = await Resource.find({ _id: { $in: resourceIds } }).populate("subject", "name").populate("uploadedBy", "name");

    const created = [];
    for (const r of resources) {
      const snapshot = {
        title: r.title,
        fileName: r.fileName,
        fileUrl: r.fileUrl,
        fileType: r.type,
        subjectName: r.subject?.name || "",
        uploadedByName: r.uploadedBy?.name || "",
      };
      for (const f of targetFolders) {
        const b = await Bookmark.findOneAndUpdate(
          { user: req.user._id, resource: r._id, folder: f },
          { user: req.user._id, resource: r._id, folder: f, ...snapshot },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        created.push(b);
      }
    }
    res.status(201).json({ count: created.length, bookmarks: created });
  } catch (err) {
    res.status(500).json({ message: "Could not batch add bookmarks", error: err.message });
  }
};

exports.removeBookmark = async (req, res) => {
  try {
    const targetId = req.params.id;
    const { itemId, type, folder } = req.body || {};
    const idToUse = targetId || itemId;

    // 1. If targetId matches a specific Bookmark document ID, delete that single bookmark
    // (Removes the bookmark from that specific folder only)
    if (targetId) {
      const deletedDoc = await Bookmark.findOneAndDelete({ _id: targetId, user: req.user._id });
      if (deletedDoc) {
        return res.json({ message: "Bookmark removed from folder", deletedCount: 1 });
      }
    }

    // 2. Fallback: treat idToUse as resourceId or circularId (e.g. unbookmarking from Resources/Circulars modal)
    const query = { user: req.user._id };
    if (folder) query.folder = folder;

    if (type === "circular") {
      query.circular = idToUse;
    } else if (type === "resource") {
      query.resource = idToUse;
    } else if (idToUse) {
      query.$or = [{ resource: idToUse }, { circular: idToUse }];
    }

    const result = await Bookmark.deleteMany(query);
    res.json({ message: "Bookmark removed", deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: "Could not remove bookmark", error: err.message });
  }
};

exports.moveBookmark = async (req, res) => {
  try {
    const bookmarkId = req.params.id || req.body?.bookmarkId;
    const existing = await Bookmark.findOne({ _id: bookmarkId, user: req.user._id });
    if (!existing) {
      return res.status(404).json({ message: "Bookmark not found to move" });
    }

    const rawFolders = req.body.folders || req.body.folder;
    let targetFolders = [];
    if (Array.isArray(rawFolders)) {
      targetFolders = rawFolders.flat().filter(Boolean).map((f) => String(f).trim());
    } else if (rawFolders) {
      targetFolders = [String(rawFolders).trim()];
    }
    if (targetFolders.length === 0) targetFolders = ["General"];

    const snapshot = {
      title: existing.title,
      fileName: existing.fileName,
      fileUrl: existing.fileUrl,
      fileType: existing.fileType,
      subjectName: existing.subjectName,
      uploadedByName: existing.uploadedByName,
      resource: existing.resource,
      circular: existing.circular,
    };

    const saved = [];
    for (const f of targetFolders) {
      const query = {
        user: req.user._id,
        folder: f,
        ...(existing.resource ? { resource: existing.resource } : {}),
        ...(existing.circular ? { circular: existing.circular } : {}),
        ...(!existing.resource && !existing.circular ? { title: existing.title, fileName: existing.fileName } : {}),
      };
      const b = await Bookmark.findOneAndUpdate(
        query,
        { ...query, ...snapshot },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      saved.push(b);
    }

    // Bookmark in original folder is also preserved as requested!
    res.json({ message: "Bookmark added to selected folders", bookmarks: saved });
  } catch (err) {
    res.status(500).json({ message: "Could not move bookmark", error: err.message });
  }
};
