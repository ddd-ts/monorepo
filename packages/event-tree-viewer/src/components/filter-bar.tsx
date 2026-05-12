import { Input } from "@/components/ui/input";
import { KindFilter } from "@/components/kind-filter";
import type { FiltersApi } from "@/application/use-filters";

export function FilterBar({ filters }: { filters: FiltersApi }) {
  return (
    <div className="flex items-center gap-3 border-b px-6 py-3">
      <Input
        placeholder="Search nodes…"
        value={filters.filter.search}
        onChange={(e) => filters.setSearch(e.target.value)}
        className="max-w-xs"
      />
      <KindFilter filters={filters} />
    </div>
  );
}
