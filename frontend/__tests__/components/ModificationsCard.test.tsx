import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModificationsCard } from "../../src/components/LookupExperience";
import type { Modifications } from "../../src/lib/api";

describe("ModificationsCard", () => {
  it("returns null if modifications is undefined", () => {
    const { container } = render(<ModificationsCard modifications={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders active modifications", () => {
    const mockData: Modifications = {
      plate: "AB12CD",
      modifications: [
        {
          code: "MOD-001",
          description: "Verhoogde carrosserie",
          active: true,
          mountDate: "2023-06-01",
          removeDate: null,
        },
        {
          code: "MOD-002",
          description: "Trekhaak gemonteerd",
          active: true,
          mountDate: "2023-08-15",
          removeDate: null,
        },
      ],
      activeCount: 2,
    };
    render(<ModificationsCard modifications={mockData} />);
    expect(screen.getByText(/verhoogde carrosserie/i)).toBeInTheDocument();
    expect(screen.getByText(/trekhaak gemonteerd/i)).toBeInTheDocument();
  });

  it("renders empty state when modifications array is empty", () => {
    const mockData: Modifications = {
      plate: "AB12CD",
      modifications: [],
      activeCount: 0,
    };
    render(<ModificationsCard modifications={mockData} />);
    expect(screen.getByText(/geen ombouwregistraties/i)).toBeInTheDocument();
  });
});
