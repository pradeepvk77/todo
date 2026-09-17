"use client";

import { useState, useTransition } from "react";
import {
  AllTasksAnalyticsData,
  IndividualTaskAnalyticsData,
  TimeRange,
  getAllTasksAnalytics,
  getIndividualTaskAnalytics,
} from "@/app/actions/analytics";
import { AllTasksAnalytics } from "./AllTasksAnalytics";
import { IndividualTaskAnalytics } from "./IndividualTaskAnalytics";
import { useRouter, useSearchParams } from "next/navigation";

interface AnalyticsPageClientProps {
  initialAllData?: AllTasksAnalyticsData | null;
  initialTaskData?: IndividualTaskAnalyticsData | null;
  isOtherUser?: boolean;
  otherUserName?: string;
  initialTaskId?: number | null;
  initialTimeRange?: TimeRange;
}

export function AnalyticsPageClient({
  initialAllData,
  initialTaskData,
  isOtherUser = false,
  otherUserName = "User",
  initialTaskId = null,
  initialTimeRange = "this_week",
}: AnalyticsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(initialTaskId);
  const [selectedRange, setSelectedRange] = useState<TimeRange>(initialTimeRange);

  const [allData, setAllData] = useState<AllTasksAnalyticsData | null>(initialAllData || null);
  const [taskData, setTaskData] = useState<IndividualTaskAnalyticsData | null>(initialTaskData || null);

  const targetUserId = isOtherUser ? "other" : undefined;

  // Handle switching time range
  const handleSelectTimeRange = (range: TimeRange) => {
    setSelectedRange(range);
    startTransition(async () => {
      if (selectedTaskId) {
        const updated = await getIndividualTaskAnalytics(selectedTaskId, range, targetUserId);
        setTaskData(updated);
      } else {
        const updated = await getAllTasksAnalytics(range, targetUserId);
        setAllData(updated);
      }
    });
  };

  // Handle selecting a task to view individual analytics
  const handleSelectTask = (taskId: number) => {
    setSelectedTaskId(taskId);
    // Update URL param
    const params = new URLSearchParams(searchParams.toString());
    params.set("taskId", String(taskId));
    router.replace(`/analytics?${params.toString()}`);

    startTransition(async () => {
      const updated = await getIndividualTaskAnalytics(taskId, selectedRange, targetUserId);
      setTaskData(updated);
    });
  };

  // Handle clicking back to All Tasks Analytics
  const handleBackToAllTasks = () => {
    setSelectedTaskId(null);
    setTaskData(null);
    // Remove taskId from URL param
    const params = new URLSearchParams(searchParams.toString());
    params.delete("taskId");
    const queryStr = params.toString();
    router.replace(queryStr ? `/analytics?${queryStr}` : "/analytics");

    if (!allData) {
      startTransition(async () => {
        const updated = await getAllTasksAnalytics(selectedRange, targetUserId);
        setAllData(updated);
      });
    }
  };

  return (
    <div className={`relative transition-opacity ${isPending ? "opacity-70 pointer-events-none" : "opacity-100"}`}>
      {selectedTaskId && taskData ? (
        <IndividualTaskAnalytics
          data={taskData}
          onBack={handleBackToAllTasks}
          onSelectTimeRange={handleSelectTimeRange}
          isOtherUser={isOtherUser}
        />
      ) : allData ? (
        <AllTasksAnalytics
          initialData={allData}
          onSelectTimeRange={handleSelectTimeRange}
          onSelectTask={handleSelectTask}
          isOtherUser={isOtherUser}
          otherUserName={otherUserName}
        />
      ) : (
        <div className="py-20 text-center text-muted-foreground font-semibold">
          Loading analytics...
        </div>
      )}
    </div>
  );
}
