import clsx from "clsx";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

/** 목록 정렬: 열 머리글을 누르면 오름차순 → 내림차순 전환. null 값은 항상 뒤로 */
export function useSort<T, K extends string>(rows: T[], getters: Record<K, (r: T) => string | number | null | undefined>, initial: { key: NoInfer<K>; dir: SortDir }) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => {
    const get = getters[sort.key];
    const m = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null || x === "") return 1;
      if (y == null || y === "") return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * m;
      return String(x).localeCompare(String(y), "ko") * m;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  const toggle = (key: K) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  return { sorted, sort, toggle };
}

export function SortTh<K extends string>({
  k,
  label,
  sort,
  toggle,
  className,
}: {
  k: K;
  label: string;
  sort: { key: K; dir: SortDir };
  toggle: (k: K) => void;
  className?: string;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={clsx("px-2 py-2", className)}>
      <button
        onClick={() => toggle(k)}
        className={clsx("inline-flex items-center gap-1 whitespace-nowrap hover:text-slate-800", active && "font-semibold text-slate-800")}
        title={active ? (sort.dir === "asc" ? "오름차순 (누르면 내림차순)" : "내림차순 (누르면 오름차순)") : "정렬"}
      >
        {label} <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}
