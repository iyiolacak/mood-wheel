import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MoodWheel } from "../src/MoodWheel";

const options = [
  { value: "bad", label: "Bad" },
  { value: "rough", label: "Rough" },
  { value: "okay", label: "Okay" },
  { value: "good", label: "Good" },
  { value: "great", label: "Great" },
] as const;

describe("MoodWheel", () => {
  it("publishes stable values from keyboard selection", () => {
    const onChange = vi.fn();
    render(<MoodWheel options={options} intro={false} sound={false} onChange={onChange} />);

    const slider = screen.getByRole("slider", { name: "Mood wheel" });
    expect(slider).toHaveAttribute("aria-valuetext", "Okay");
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      index: 3,
      option: expect.objectContaining({ value: "good", label: "Good" }),
      source: "keyboard",
    }));
    expect(slider).toHaveAttribute("aria-valuetext", "Good");
  });

  it("supports controlled values without mutating the visible selection", () => {
    const onChange = vi.fn();
    render(<MoodWheel options={options} value="okay" intro={false} sound={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Next mood" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ option: expect.objectContaining({ value: "good" }) }));
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "Okay");
  });

  it("fails visibly for an unusable option set", () => {
    render(<MoodWheel options={[{ value: "only", label: "Only" }]} intro={false} sound={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent("exactly five");
  });

  it("does not accept a sixth authored hit point", () => {
    render(<MoodWheel options={[...options, { value: "too-much", label: "Too much" }]} intro={false} sound={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent("exactly five");
  });
});
