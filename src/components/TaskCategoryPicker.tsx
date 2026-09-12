"use client";

import { useState } from "react";
import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const DEFAULT_TASK_CATEGORIES = ["Health", "Study", "Learning", "Self Growth", "Work", "Personal"];

export function TaskCategoryPicker({ category, onChange }: { category: string; onChange: (category: string) => void }) {
  const [addingCustom, setAddingCustom] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const categories = category && !DEFAULT_TASK_CATEGORIES.includes(category)
    ? [...DEFAULT_TASK_CATEGORIES, category]
    : DEFAULT_TASK_CATEGORIES;
  const addCustomCategory = () => {
    const value = customCategory.trim().slice(0, 40);
    if (!value) return;
    onChange(value);
    setCustomCategory("");
    setAddingCustom(false);
  };

  return <div className="space-y-2">
    <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><Tag className="size-3.5 text-primary" />Category</Label>
    <div className="flex flex-wrap gap-1.5">{categories.map((item) => <Button key={item} type="button" size="sm" variant={category === item ? "default" : "outline"} onClick={() => onChange(item)} className="h-7 cursor-pointer rounded-md px-2.5 text-xs">{item}</Button>)}<Button type="button" size="sm" variant="outline" onClick={() => setAddingCustom((value) => !value)} className="h-7 cursor-pointer rounded-md px-2.5 text-xs"><Plus className="size-3" />Add tag</Button></div>
    {addingCustom && <div className="flex gap-2"><Input value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addCustomCategory())} placeholder="e.g., Finance" maxLength={40} className="h-8 text-xs" autoFocus /><Button type="button" size="sm" onClick={addCustomCategory} disabled={!customCategory.trim()} className="cursor-pointer">Add</Button></div>}
    <p className="text-[11px] text-muted-foreground">Choose a category for the analytics breakdown, or create your own tag.</p>
  </div>;
}
