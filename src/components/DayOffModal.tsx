"use client";

import { useState, useEffect } from "react";
import { DayOff, DayOffType } from "@/lib/db";
import { getDayOffs, markDayOff, removeDayOff } from "@/app/actions/day-off";
import { getISTDateString } from "@/lib/time-utils";
import { X, Calendar, Plus, Trash2, Sun, HeartPulse, Palmtree, PartyPopper, BedDouble } from "lucide-react";

interface DayOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const DAY_OFF_TYPES: { type: DayOffType; label: string; icon: string; bg: string; text: string }[] = [
  { type: "day_off", label: "Day Off", icon: "🏖️", bg: "bg-blue-500/10", text: "text-blue-600" },
  { type: "sick", label: "Sick Day", icon: "🤒", bg: "bg-rose-500/10", text: "text-rose-600" },
  { type: "leave", label: "Leave", icon: "🌴", bg: "bg-amber-500/10", text: "text-amber-600" },
  { type: "holiday", label: "Holiday", icon: "🎉", bg: "bg-purple-500/10", text: "text-purple-600" },
  { type: "rest_day", label: "Rest Day", icon: "😴", bg: "bg-emerald-500/10", text: "text-emerald-600" },
];

export function DayOffModal({ isOpen, onClose, onUpdate }: DayOffModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(getISTDateString());
  const [selectedType, setSelectedType] = useState<DayOffType>("day_off");
  const [note, setNote] = useState<string>("");
  const [dayOffsList, setDayOffsList] = useState<DayOff[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadDayOffs();
    }
  }, [isOpen]);

  async function loadDayOffs() {
    try {
      const data = await getDayOffs();
      setDayOffsList(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMarkDayOff(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await markDayOff(selectedDate, selectedType, note);
      setNote("");
      await loadDayOffs();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveDayOff(date: string) {
    setLoading(true);
    try {
      await removeDayOff(date);
      await loadDayOffs();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏖️</span>
            <div>
              <h3 className="text-base font-bold text-foreground">Manage Days Off & Leave</h3>
              <p className="text-xs text-muted-foreground">Excluded days won&apos;t hurt your analytics</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Mark Form */}
        <form onSubmit={handleMarkDayOff} className="space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border/60">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Plus className="size-3.5 text-emerald-600" />
            <span>Mark a Day Off</span>
          </h4>

          {/* Date Picker */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          {/* Type Picker */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Reason / Type</label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {DAY_OFF_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setSelectedType(t.type)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                    selectedType === t.type
                      ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-border/70 bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span>{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">Note (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Travel, fever, weekend trip"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full h-8 rounded-lg border border-input bg-background px-3 text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>Save Day Off</span>
          </button>
        </form>

        {/* Existing Days Off List */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            <span>Marked Days Off ({dayOffsList.length})</span>
          </h4>

          {dayOffsList.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border/70 rounded-xl">
              No days off marked yet.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {dayOffsList.map((d) => {
                const info = DAY_OFF_TYPES.find((t) => t.type === d.type) || DAY_OFF_TYPES[0];
                return (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{info.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{d.date}</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${info.bg} ${info.text}`}>
                            {info.label}
                          </span>
                        </div>
                        {d.note && <p className="text-[11px] text-muted-foreground truncate">{d.note}</p>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDayOff(d.date)}
                      disabled={loading}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                      title="Remove Day Off"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
