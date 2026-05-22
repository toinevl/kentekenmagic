import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecallCard } from "../../src/components/LookupExperience";
import type { RecallStatus } from "../../src/lib/api";

describe("RecallCard", () => {
  it("returns null if recallStatus is undefined", () => {
    const { container } = render(<RecallCard recallStatus={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows open recall badge when hasOpenRecall is true", () => {
    const mockData: RecallStatus = {
      plate: "AB12CD",
      hasOpenRecall: true,
      statusDescription: "1 open terugroepactie",
      recalls: [
        {
          referenceNumber: "RDW-2024-001",
          description: "Brandstoflek mogelijk",
          remedyDescription: "Vervangen afdichting",
          startDate: "2024-01-15",
          status: "open",
        },
      ],
    };
    render(<RecallCard recallStatus={mockData} />);
    expect(screen.getByText(/open terugroepactie/i)).toBeInTheDocument();
  });

  it("shows no-recall state when recalls array is empty", () => {
    const mockData: RecallStatus = {
      plate: "AB12CD",
      hasOpenRecall: false,
      statusDescription: "Geen open terugroepacties",
      recalls: [],
    };
    render(<RecallCard recallStatus={mockData} />);
    expect(screen.getByText(/geen open terugroepacties/i)).toBeInTheDocument();
  });
});
