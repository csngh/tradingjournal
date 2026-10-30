"use client";

import { useState } from "react";
import { Tag as TagIcon, Pencil, Trash2, Plus, X, Check } from "lucide-react";
import { createTag, updateTag, deleteTag } from "@/app/actions";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui/form";
import type { Tag } from "@/db/schema";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16"];

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-6 w-6 rounded-full ring-offset-2 cursor-pointer"
          style={{
            background: c,
            boxShadow: value === c ? `0 0 0 2px var(--bg-elevated), 0 0 0 4px ${c}` : "none",
          }}
        />
      ))}
    </div>
  );
}

export function TagsManager({ tags, className = "" }: { tags: Tag[]; className?: string }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      await createTag({ name, color: newColor });
      setNewName("");
      setNewColor(COLORS[0]);
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      await updateTag(editingId, { name, color: editColor });
      setEditingId(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setSubmitting(true);
    try {
      await deleteTag(id);
      if (editingId === id) setEditingId(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 ${className}`}>
      <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--text)]">
        <TagIcon size={17} className="text-[var(--accent)]" />
        Tags
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Manage the tags available when logging a trade. Each trade can carry at most one tag.
      </p>

      <div className="mt-3 flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {tags.map((tag) =>
          editingId === tag.id ? (
            <form
              key={tag.id}
              onSubmit={handleUpdate}
              className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  className={inputClass}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)] cursor-pointer"
                >
                  <X size={15} />
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--profit)] hover:bg-[var(--surface)] cursor-pointer"
                >
                  <Check size={15} />
                </button>
              </div>
              <ColorPicker value={editColor} onChange={setEditColor} />
            </form>
          ) : (
            <div
              key={tag.id}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tag.color }} />
                {tag.name}
              </span>
              <span className="flex items-center gap-1">
                <button
                  onClick={() => startEdit(tag)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(tag.id)}
                  disabled={submitting}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--gradient-loss-soft)] hover:text-[var(--loss)] cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          )
        )}

        {tags.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-sm text-[var(--text-muted)]">
            No tags yet. Add your first one below.
          </p>
        )}
      </div>

      <form onSubmit={handleAdd} className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
        <div>
          <label className={labelClass}>New tag</label>
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Breakout, Revenge trade, A+ setup"
            />
            <button
              type="submit"
              disabled={submitting || !newName.trim()}
              className={`${primaryButtonClass} shrink-0`}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
        <ColorPicker value={newColor} onChange={setNewColor} />
      </form>
    </div>
  );
}
