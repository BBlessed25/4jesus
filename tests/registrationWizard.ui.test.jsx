import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrationWizard } from "../src/components/RegistrationWizard";
import { JACKET_LIMITS, MEMBER_CONFIRMATION, VISITOR_CONFIRMATION } from "../src/lib/registration";

const api = vi.hoisted(() => ({
  fetchJacketAvailability: vi.fn(),
  recordMemberResponse: vi.fn(),
  submitVisitorRegistration: vi.fn(),
}));

vi.mock("../src/lib/submitToGoogleSheet", () => api);

describe("RegistrationWizard", () => {
  beforeEach(() => {
    api.fetchJacketAvailability.mockResolvedValue({
      ok: true,
      closed: false,
      inventory: { ...JACKET_LIMITS },
    });
    api.recordMemberResponse.mockResolvedValue({ ok: true, registrationId: "WWS-2026-MEMBER1" });
    api.submitVisitorRegistration.mockResolvedValue({
      ok: true,
      registrationId: "WWS-2026-ABC12345",
      inventory: { ...JACKET_LIMITS, Small: 45 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("records a member before showing the early-exit confirmation", async () => {
    const user = userEvent.setup();
    render(<RegistrationWizard />);

    await user.click(screen.getByRole("radio", { name: "Member" }));

    expect(await screen.findByText(MEMBER_CONFIRMATION)).toBeInTheDocument();
    expect(api.recordMemberResponse).toHaveBeenCalledWith(
      expect.objectContaining({ registrationType: "Member" })
    );
    expect(api.submitVisitorRegistration).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Full Name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /continue/i })).not.toBeInTheDocument();
  });

  it("preserves answers through Back and completes the visitor flow", async () => {
    const user = userEvent.setup();
    render(<RegistrationWizard />);

    await user.click(screen.getByRole("radio", { name: "Visitor" }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByRole("textbox", { name: "Full Name" }), "Jordan Smith");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("textbox", { name: "Phone Number" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByRole("textbox", { name: "Full Name" })).toHaveValue("Jordan Smith");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByRole("textbox", { name: "Phone Number" }), "416-555-1234");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByRole("textbox", { name: "Email Address" }), "Jordan@example.com");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByRole("textbox", { name: "Location (City or Area)" }), "North York");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByRole("spinbutton", { name: "Age" }), "27");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(api.fetchJacketAvailability).toHaveBeenCalled());
    await user.click(screen.getByRole("radio", { name: /^Small/ }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("radio", { name: "Email" }));
    await user.click(screen.getByRole("button", { name: /submit registration/i }));

    expect(await screen.findByText(VISITOR_CONFIRMATION)).toBeInTheDocument();
    expect(screen.getByText(/WWS-2026-ABC12345/)).toBeInTheDocument();
    expect(api.submitVisitorRegistration).toHaveBeenCalledTimes(1);
    expect(api.submitVisitorRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        registrationType: "Visitor",
        fullName: "Jordan Smith",
        jacketSize: "Small",
        preferredContactMethod: "Email",
      })
    );
  });

  it("shows the closed card when the server reports that registration has ended", async () => {
    api.fetchJacketAvailability.mockResolvedValue({
      ok: true,
      closed: true,
      inventory: { ...JACKET_LIMITS },
    });
    render(<RegistrationWizard />);
    expect(await screen.findByText("Registration is now closed.")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Visitor" })).not.toBeInTheDocument();
  });

  it("allows a visitor past jacket size when live availability is temporarily unavailable", async () => {
    api.fetchJacketAvailability.mockRejectedValue(
      Object.assign(new Error("Live availability is temporarily unavailable."), {
        code: "SERVICE_UNAVAILABLE",
      })
    );
    const user = userEvent.setup();
    render(<RegistrationWizard />);

    await user.click(screen.getByRole("radio", { name: "Visitor" }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByRole("textbox", { name: "Full Name" }), "Jordan Smith");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByRole("textbox", { name: "Phone Number" }), "416-555-1234");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByRole("textbox", { name: "Email Address" }), "jordan@example.com");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByRole("textbox", { name: "Location (City or Area)" }), "Toronto");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(screen.getByRole("spinbutton", { name: "Age" }), "27");
    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.click(screen.getByRole("radio", { name: "Female" }));
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(
      await screen.findByText(/you can still select a size and continue/i)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Small/ }));
    await user.click(screen.getByRole("button", { name: /continue/i }));
    expect(
      screen.getByRole("heading", { name: "What is your preferred contact method?" })
    ).toBeInTheDocument();
  });
});
