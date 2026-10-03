import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrationWizard } from "../src/components/RegistrationWizard";
import { JACKET_SIZES, MEMBER_CONFIRMATION, VISITOR_CONFIRMATION } from "../src/lib/registration";

const AVAILABLE_SIZES = Object.fromEntries(JACKET_SIZES.map((size) => [size, true]));

const api = vi.hoisted(() => ({
  fetchJacketAvailability: vi.fn(),
  recordMemberResponse: vi.fn(),
  submitVisitorRegistration: vi.fn(),
}));

vi.mock("../src/lib/submitToGoogleSheet", () => api);

async function reachJacketSize(user) {
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
  await screen.findByRole("heading", { name: "Jacket Size" });
}

describe("RegistrationWizard", () => {
  beforeEach(() => {
    api.fetchJacketAvailability.mockResolvedValue({
      ok: true,
      closed: false,
      inventory: { ...AVAILABLE_SIZES },
    });
    api.recordMemberResponse.mockResolvedValue({ ok: true, registrationId: "WWS-2026-MEMBER1" });
    api.submitVisitorRegistration.mockResolvedValue({
      ok: true,
      registrationId: "WWS-2026-ABC12345",
      inventory: { ...AVAILABLE_SIZES },
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

    expect(
      await screen.findByRole("heading", { name: "Registration could not be completed" })
    ).toBeInTheDocument();
    expect(await screen.findByText(MEMBER_CONFIRMATION)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Registration complete" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/WWS-2026-MEMBER1/)).not.toBeInTheDocument();
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
    expect(screen.queryByText(/\d+\s+remaining/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/checked at submission/i)).not.toBeInTheDocument();
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

  it("shows the closed card when all jackets have been reserved", async () => {
    api.fetchJacketAvailability.mockResolvedValue({
      ok: true,
      closed: true,
      inventory: Object.fromEntries(Object.keys(AVAILABLE_SIZES).map((size) => [size, false])),
    });
    render(<RegistrationWizard />);
    expect(
      await screen.findByText(
        "Registration is now closed. All available jackets have been reserved."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Visitor" })).not.toBeInTheDocument();
  });

  it("shows only availability status and disables sold-out sizes", async () => {
    api.fetchJacketAvailability.mockResolvedValue({
      ok: true,
      closed: false,
      inventory: { ...AVAILABLE_SIZES, Large: false },
    });
    const user = userEvent.setup();
    render(<RegistrationWizard />);

    await reachJacketSize(user);

    expect(screen.getByRole("radio", { name: /^Large/ })).toBeDisabled();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/\d+\s+remaining/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/capacity|claimed|stock/i)).not.toBeInTheDocument();
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
