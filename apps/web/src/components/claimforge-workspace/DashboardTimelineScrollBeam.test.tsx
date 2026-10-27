import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardHome } from "./DashboardHome";

describe("Dashboard Timeline Scroll Beam & Stability", () => {
  it("renders the locked dashboard timeline widget with rail and orange scroll-following beam", () => {
    const onOpenReview = vi.fn();
    const onStartClaim = vi.fn();
    const onNavigateTab = vi.fn();

    const { container } = render(
      <DashboardHome
        onStartClaim={onStartClaim}
        onOpenReview={onOpenReview}
        onNavigateTab={onNavigateTab}
      />
    );

    // Verify "Your Timeline" section exists
    const timelineCard = container.querySelector(".timeline-widget-card");
    expect(timelineCard).toBeInTheDocument();

    // Verify existing vertical rail (.timeline-vertical-spine) exists
    const spine = container.querySelector(".timeline-vertical-spine") as HTMLElement;
    expect(spine).toBeInTheDocument();

    // Verify the scroll-following beam (.timeline-vertical-spine-beam) is present inside the spine
    const beam = container.querySelector(".timeline-vertical-spine-beam") as HTMLElement;
    expect(beam).toBeInTheDocument();
    expect(spine).toContainElement(beam);

    // At rest (initial render), height style is 0%
    expect(beam).toHaveStyle({ height: "0%" });
  });

  it("updates the orange beam progress percentage when scrolling in the timeline container", () => {
    const onOpenReview = vi.fn();
    const onStartClaim = vi.fn();
    const onNavigateTab = vi.fn();

    const { container } = render(
      <DashboardHome
        onStartClaim={onStartClaim}
        onOpenReview={onOpenReview}
        onNavigateTab={onNavigateTab}
      />
    );

    const scrollContainer = container.querySelector(
      ".timeline-events-scroll-container"
    ) as HTMLElement;
    expect(scrollContainer).toBeInTheDocument();

    const beam = container.querySelector(".timeline-vertical-spine-beam") as HTMLElement;
    expect(beam).toBeInTheDocument();

    // Mock scroll dimensions
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 600, configurable: true });
    Object.defineProperty(scrollContainer, "clientHeight", { value: 200, configurable: true });
    Object.defineProperty(scrollContainer, "scrollTop", { value: 200, configurable: true });

    // Fire scroll event
    fireEvent.scroll(scrollContainer);

    // 200 / (600 - 200) = 200 / 400 = 50%
    expect(beam).toHaveStyle({ height: "50%" });
  });

  it("triggers onOpenReview when 'View All' is clicked to open the full timeline", async () => {
    const user = userEvent.setup();
    const onOpenReview = vi.fn();
    const onStartClaim = vi.fn();
    const onNavigateTab = vi.fn();

    render(
      <DashboardHome
        onStartClaim={onStartClaim}
        onOpenReview={onOpenReview}
        onNavigateTab={onNavigateTab}
      />
    );

    const viewAllBtn = screen.getByRole("button", { name: /open full review/i });
    expect(viewAllBtn).toBeInTheDocument();

    await user.click(viewAllBtn);
    expect(onOpenReview).toHaveBeenCalledTimes(1);
  });

  it("preserves all approved timeline events and sections in the dashboard widget", () => {
    const onOpenReview = vi.fn();
    const onStartClaim = vi.fn();
    const onNavigateTab = vi.fn();

    const { container } = render(
      <DashboardHome
        onStartClaim={onStartClaim}
        onOpenReview={onOpenReview}
        onNavigateTab={onNavigateTab}
      />
    );

    const timelineCard = container.querySelector(".timeline-widget-card") as HTMLElement;
    expect(timelineCard).toBeInTheDocument();

    const timelineScope = within(timelineCard);

    // Section dividers exist
    expect(timelineScope.getByText("Upcoming")).toBeInTheDocument();
    expect(timelineScope.getByText("Later")).toBeInTheDocument();

    // Specific product rows exist in the timeline card with approved subtitles and status badges
    const eventTitles = Array.from(timelineCard.querySelectorAll(".event-item-title")).map(
      (el) => el.textContent
    );
    expect(eventTitles).toContain("LG Refrigerator");
    expect(eventTitles).toContain("Minimalist Sunscreen");
    expect(eventTitles).toContain("Titan Watch");

    expect(timelineScope.getByText("AMC renewal due")).toBeInTheDocument();
    expect(timelineScope.getByText("14 days")).toBeInTheDocument();
    expect(timelineScope.getByText("Time to restock")).toBeInTheDocument();
    expect(timelineScope.getByText("8 days")).toBeInTheDocument();
    expect(timelineScope.getByText("Warranty check reminder")).toBeInTheDocument();
  });
});
