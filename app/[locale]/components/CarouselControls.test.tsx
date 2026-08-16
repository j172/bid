// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import CarouselControls from "./CarouselControls";

afterEach(() => {
  cleanup();
});

// Locks in the exact markup/classes issue #162 extracted this component
// from — HeroSection ("translucentLarge"), NewsCarouselCard ("solid") and
// PigeonShowcaseCarouselCard ("translucentSmall") each rendered this block
// by hand before. Any drift in these class strings would be a visible,
// unintended appearance change on the homepage.
describe("CarouselControls", () => {
  it("renders nothing when there's only one item", () => {
    const { container } = render(
      <CarouselControls
        itemCount={1}
        activeIndex={0}
        onSelect={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        variant="solid"
        dotLabel={(index) => `go to ${index}`}
        previousLabel="prev"
        nextLabel="next"
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there are zero items", () => {
    const { container } = render(
      <CarouselControls
        itemCount={0}
        activeIndex={0}
        onSelect={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        variant="solid"
        dotLabel={(index) => `go to ${index}`}
        previousLabel="prev"
        nextLabel="next"
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders one dot per item, labels them via dotLabel, and calls onSelect with its index", () => {
    const onSelect = vi.fn();
    render(
      <CarouselControls
        itemCount={3}
        activeIndex={1}
        onSelect={onSelect}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        variant="solid"
        dotLabel={(index) => `go to ${index + 1}`}
        previousLabel="prev"
        nextLabel="next"
      />,
    );

    const dots = [1, 2, 3].map((n) => screen.getByRole("button", { name: `go to ${n}` }));
    expect(dots).toHaveLength(3);

    fireEvent.click(dots[2]);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("wires the prev/next arrow buttons", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <CarouselControls
        itemCount={2}
        activeIndex={0}
        onSelect={vi.fn()}
        onPrev={onPrev}
        onNext={onNext}
        variant="solid"
        dotLabel={(index) => `go to ${index}`}
        previousLabel="prev"
        nextLabel="next"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "prev" }));
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("renders NewsCarouselCard's original solid-variant classes", () => {
    render(
      <CarouselControls
        itemCount={2}
        activeIndex={0}
        onSelect={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        variant="solid"
        dotLabel={(index) => `dot-${index}`}
        previousLabel="prev"
        nextLabel="next"
      />,
    );

    expect(screen.getByRole("button", { name: "dot-0" }).className).toBe("h-2.5 rounded-full transition w-8 bg-header");
    expect(screen.getByRole("button", { name: "dot-1" }).className).toBe(
      "h-2.5 rounded-full transition w-2.5 bg-ink/20 hover:bg-ink/40",
    );
    expect(screen.getByRole("button", { name: "prev" }).className).toBe(
      "inline-flex h-8 w-8 items-center justify-center rounded-full bg-header text-sm text-white transition hover:bg-twilight-indigo-600",
    );
  });

  it("renders HeroSection's original translucentLarge-variant classes", () => {
    render(
      <CarouselControls
        itemCount={2}
        activeIndex={0}
        onSelect={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        variant="translucentLarge"
        dotLabel={(index) => `dot-${index}`}
        previousLabel="prev"
        nextLabel="next"
      />,
    );

    expect(screen.getByRole("button", { name: "dot-0" }).className).toBe("h-2.5 rounded-full transition w-8 bg-white");
    expect(screen.getByRole("button", { name: "dot-1" }).className).toBe(
      "h-2.5 rounded-full transition w-2.5 bg-white/35 hover:bg-white/60",
    );
    expect(screen.getByRole("button", { name: "prev" }).className).toBe(
      "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg text-white backdrop-blur-sm transition hover:bg-white/20",
    );
  });

  it("renders PigeonShowcaseCarouselCard's original translucentSmall-variant classes", () => {
    render(
      <CarouselControls
        itemCount={2}
        activeIndex={0}
        onSelect={vi.fn()}
        onPrev={vi.fn()}
        onNext={vi.fn()}
        variant="translucentSmall"
        dotLabel={(index) => `dot-${index}`}
        previousLabel="prev"
        nextLabel="next"
      />,
    );

    expect(screen.getByRole("button", { name: "dot-0" }).className).toBe("h-2 rounded-full transition w-6 bg-white");
    expect(screen.getByRole("button", { name: "dot-1" }).className).toBe(
      "h-2 rounded-full transition w-2 bg-white/35 hover:bg-white/60",
    );
    expect(screen.getByRole("button", { name: "prev" }).className).toBe(
      "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm text-white backdrop-blur-sm transition hover:bg-white/20",
    );
  });
});
