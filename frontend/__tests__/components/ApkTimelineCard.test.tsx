import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApkTimelineCard } from "../../src/components/LookupExperience";
import type { ApkHistory } from "../../src/lib/api";

describe("ApkTimelineCard", () => {
  it("returns null if apkHistory is undefined", () => {
    const { container } = render(<ApkTimelineCard apkHistory={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows last 5 inspections by default when totalCount > 5", () => {
    const mockData: ApkHistory = {
      plate: "AB12CD",
      currentExpiry: "2027-02-28",
      currentStatus: "valid",
      inspections: Array.from({ length: 8 }, (_, i) => ({
        date: `2025-0${(i % 9) + 1}-01`,
        expiryDate: "2027-02-28",
        type: "periodieke controle",
        facility: "TestGarage",
        defectCount: 0,
        defects: [],
      })),
      totalCount: 8,
    };
    render(<ApkTimelineCard apkHistory={mockData} />);
    const items = screen.getAllByText(/periodieke controle/i);
    expect(items).toHaveLength(5);
  });

  it("reveals all inspections after show-more click", async () => {
    const user = userEvent.setup();
    const mockData: ApkHistory = {
      plate: "AB12CD",
      currentExpiry: "2027-02-28",
      currentStatus: "valid",
      inspections: Array.from({ length: 8 }, (_, i) => ({
        date: `2025-0${(i % 9) + 1}-01`,
        expiryDate: "2027-02-28",
        type: "periodieke controle",
        facility: "TestGarage",
        defectCount: 0,
        defects: [],
      })),
      totalCount: 8,
    };
    render(<ApkTimelineCard apkHistory={mockData} />);
    const showMoreButton = screen.getByRole("button", { name: /meer tonen/i });
    await user.click(showMoreButton);
    const items = screen.getAllByText(/periodieke controle/i);
    expect(items).toHaveLength(8);
  });

  it("renders inline defect descriptions", () => {
    const mockData: ApkHistory = {
      plate: "AB12CD",
      currentExpiry: "2027-02-28",
      currentStatus: "valid",
      inspections: [
        {
          date: "2026-02-13",
          expiryDate: "2027-02-28",
          type: "periodieke controle",
          facility: "TestGarage",
          defectCount: 2,
          defects: [
            { id: "123", description: "Remmen slijtageindicator", count: 1 },
            { id: "456", description: "Ruitsproeier niet werkend", count: 1 },
          ],
        },
      ],
      totalCount: 1,
    };
    render(<ApkTimelineCard apkHistory={mockData} />);
    expect(screen.getByText("Remmen slijtageindicator")).toBeInTheDocument();
    expect(screen.getByText("Ruitsproeier niet werkend")).toBeInTheDocument();
  });
});
