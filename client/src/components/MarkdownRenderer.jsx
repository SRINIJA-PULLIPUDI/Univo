import React from "react";

/**
 * High-performance, zero-dependency Markdown renderer tailored for AI academic outputs.
 * Supports: tables, bold, italics, code blocks, bullet lists, numbered lists, headings, and quotes.
 */
export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  // Split content into blocks (paragraphs, tables, lists, headers)
  const lines = content.split("\n");
  const blocks = [];
  let currentTable = null;
  let currentList = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Table handling
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (!currentTable) {
        currentTable = [];
      }
      currentTable.push(trimmed);
      continue;
    } else if (currentTable) {
      blocks.push({ type: "table", lines: currentTable });
      currentTable = null;
    }

    // 2. Unordered List handling
    if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const item = trimmed.replace(/^[•\-\*]\s+/, "");
      if (!currentList || currentList.type !== "ul") {
        if (currentList) blocks.push(currentList);
        currentList = { type: "ul", items: [] };
      }
      currentList.items.push(item);
      continue;
    }

    // 3. Ordered List handling
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      if (!currentList || currentList.type !== "ol") {
        if (currentList) blocks.push(currentList);
        currentList = { type: "ol", items: [] };
      }
      currentList.items.push(orderedMatch[2]);
      continue;
    }

    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }

    // 4. Headings
    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4) });
    } else if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3) });
    } else if (trimmed.startsWith("# ")) {
      blocks.push({ type: "h1", text: trimmed.slice(2) });
    } else if (trimmed.startsWith("> ")) {
      blocks.push({ type: "quote", text: trimmed.slice(2) });
    } else if (trimmed === "") {
      blocks.push({ type: "spacer" });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }

  if (currentTable) blocks.push({ type: "table", lines: currentTable });
  if (currentList) blocks.push(currentList);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-slate-800">
      {blocks.map((block, idx) => {
        if (block.type === "h1") {
          return (
            <h1 key={idx} className="font-display font-extrabold text-lg text-slate-900 mt-3 mb-1">
              {formatInline(block.text)}
            </h1>
          );
        }
        if (block.type === "h2") {
          return (
            <h2 key={idx} className="font-display font-bold text-base text-slate-900 mt-2.5 mb-1">
              {formatInline(block.text)}
            </h2>
          );
        }
        if (block.type === "h3") {
          return (
            <h3 key={idx} className="font-display font-bold text-sm text-sky-950 mt-2 mb-0.5">
              {formatInline(block.text)}
            </h3>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote key={idx} className="border-l-4 border-sky-500 pl-3 py-1 my-2 text-slate-600 bg-sky-50/50 rounded-r-lg italic text-xs">
              {formatInline(block.text)}
            </blockquote>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={idx} className="list-disc list-inside space-y-1 my-1.5 pl-1">
              {block.items.map((item, i) => (
                <li key={i} className="text-slate-700">
                  {formatInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={idx} className="list-decimal list-inside space-y-1 my-1.5 pl-1">
              {block.items.map((item, i) => (
                <li key={i} className="text-slate-700">
                  {formatInline(item)}
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === "table") {
          return <TableBlock key={idx} lines={block.lines} />;
        }
        if (block.type === "spacer") {
          return <div key={idx} className="h-1" />;
        }
        return (
          <p key={idx} className="text-slate-800">
            {formatInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function TableBlock({ lines }) {
  if (lines.length < 2) return null;

  const headerCols = lines[0]
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  // Skip delimiter line (line 1 with :---:)
  const dataRows = lines.slice(2).map((row) =>
    row
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
  );

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs">
      <table className="w-full text-left text-xs border-collapse">
        <thead className="bg-slate-100/90 text-slate-900 border-b border-slate-200">
          <tr>
            {headerCols.map((h, i) => (
              <th key={i} className="px-3.5 py-2 font-bold whitespace-nowrap">
                {formatInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {dataRows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-sky-50/40 transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2 text-slate-700 whitespace-nowrap">
                  {formatInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Handles inline styles: **bold**, *italic*, `code`
 */
function formatInline(text) {
  if (!text) return "";

  // Split on inline patterns: `code`, **bold**, *italic*
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // 1. Code: `code`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // 2. Bold: **text**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // 3. Italic: *text* (single star)
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

    // Find earliest match
    let earliest = null;
    let matchType = null;

    if (codeMatch && (!earliest || codeMatch.index < earliest.index)) {
      earliest = codeMatch;
      matchType = "code";
    }
    if (boldMatch && (!earliest || boldMatch.index < earliest.index)) {
      earliest = boldMatch;
      matchType = "bold";
    }
    if (italicMatch && (!earliest || italicMatch.index < earliest.index)) {
      earliest = italicMatch;
      matchType = "italic";
    }

    if (!earliest) {
      parts.push(remaining);
      break;
    }

    // Add preceding text
    if (earliest.index > 0) {
      parts.push(remaining.substring(0, earliest.index));
    }

    if (matchType === "code") {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-sky-800 font-mono text-xs border border-slate-200">
          {earliest[1]}
        </code>
      );
    } else if (matchType === "bold") {
      parts.push(
        <strong key={key++} className="font-bold text-slate-900">
          {earliest[1]}
        </strong>
      );
    } else if (matchType === "italic") {
      parts.push(
        <em key={key++} className="italic text-slate-600">
          {earliest[1]}
        </em>
      );
    }

    remaining = remaining.substring(earliest.index + earliest[0].length);
  }

  return parts;
}
