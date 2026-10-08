import type { Catalog, OptimizationRequest } from "@dofus/shared";

export function CategoryToggles({ catalog, request, onChange }: {
  catalog: Catalog;
  request: OptimizationRequest;
  onChange: (request: OptimizationRequest) => void;
}) {
  const categories = Array.from(new Set(catalog.items.map((item) => item.category)));
  const excludedCategories = request.filters.excludedCategories;
  return (
    <div className="category-toggles">
      {categories.map((category) => {
        const excluded = excludedCategories.includes(category);
        return (
          <button
            key={category}
            className={`category-toggle ${excluded ? "off" : ""}`}
            onClick={() =>
              onChange({
                ...request,
                filters: {
                  ...request.filters,
                  excludedCategories: excluded
                    ? excludedCategories.filter((value) => value !== category)
                    : [...excludedCategories, category],
                },
              })
            }
          >
            {category}
            <span className="switch" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
