import Skeleton from './Skeleton';

export function FeedPostSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm animate-pulse p-5 space-y-4">
      <div className="flex gap-3 items-center">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-3.5 w-32 rounded-lg" />
          <Skeleton className="h-2.5 w-24 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-4 w-full rounded-lg opacity-92" />
      <Skeleton className="h-4 w-[92%] rounded-lg opacity-85" />
      <Skeleton className="h-[180px] w-full rounded-xl opacity-71" />
    </div>
  );
}
