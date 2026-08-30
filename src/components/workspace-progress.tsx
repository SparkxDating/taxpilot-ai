import { cn } from "@/lib/utils";
import { WORKSPACE_STEPS, type WorkspaceStepId } from "@/lib/review/workspace";

export function WorkspaceProgress({ current }: { current: WorkspaceStepId }) {
  const currentIndex = Math.max(0, WORKSPACE_STEPS.findIndex((s) => s.id === current));
  return (
    <ol className="sans flex flex-wrap gap-2 text-xs" aria-label="Return progress">
      {WORKSPACE_STEPS.map((step, i) => {
        const active = step.id === current;
        const done = i < currentIndex;
        return (
          <li key={step.id}>
            <span
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-3 py-1",
                active ? "bg-[#1f4e46] text-white" : done ? "bg-[#eef5f3] text-[#1f4e46]" : "bg-[#efe8da] text-[#5c6773]",
              )}
            >
              {i + 1}. {step.label}
              {done ? " · Done" : active ? " · Current" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
