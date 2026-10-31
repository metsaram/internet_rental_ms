import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { BankSlipUploader, extractFileFromDataTransfer } from "@/components/shared/bank-slip-uploader";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("extractFileFromDataTransfer helper", () => {
  it("returns null when DataTransfer is null or empty", () => {
    expect(extractFileFromDataTransfer(null)).toBeNull();
    const emptyDt = { files: [], items: [] } as unknown as DataTransfer;
    expect(extractFileFromDataTransfer(emptyDt)).toBeNull();
  });

  it("extracts file from DataTransfer.files matching allowed mimes", () => {
    const file = new File(["test-image-content"], "telegram-slip.png", { type: "image/png" });
    const dt = {
      files: [file],
      items: [],
    } as unknown as DataTransfer;

    const extracted = extractFileFromDataTransfer(dt);
    expect(extracted).not.toBeNull();
    expect(extracted?.name).toBe("telegram-slip.png");
    expect(extracted?.type).toBe("image/png");
  });

  it("extracts and names generic file from DataTransfer.items", () => {
    const blob = new Blob(["image-bytes"], { type: "image/jpeg" });
    const dt = {
      files: [],
      items: [
        {
          kind: "file",
          type: "image/jpeg",
          getAsFile: () => new File([blob], "image.png", { type: "image/jpeg" }),
        },
      ],
    } as unknown as DataTransfer;

    const extracted = extractFileFromDataTransfer(dt);
    expect(extracted).not.toBeNull();
    expect(extracted?.type).toBe("image/jpeg");
    expect(extracted?.name).toMatch(/^bank-slip-\d+-\d+\.jpg$/);
  });

  it("ignores non-matching items (e.g. text)", () => {
    const dt = {
      files: [],
      items: [
        {
          kind: "string",
          type: "text/plain",
          getAsFile: () => null,
        },
      ],
    } as unknown as DataTransfer;

    expect(extractFileFromDataTransfer(dt)).toBeNull();
  });
});

describe("BankSlipUploader Component", () => {
  const onSelectMock = vi.fn();
  const onRemoveMock = vi.fn();
  const onErrorMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dropzone with upload and paste instructions when no file is selected", () => {
    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
        onError={onErrorMock}
      />
    );

    expect(
      screen.getByText("Upload or paste bank transaction slip / receipt")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Drag & drop, browse, or paste with/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Ctrl+V")).toBeInTheDocument();
    expect(screen.getByTestId("bank-slip-browse-btn")).toBeInTheDocument();
    expect(screen.getByTestId("bank-slip-paste-btn")).toBeInTheDocument();
  });

  it("handles file selection via hidden file input", () => {
    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
        onError={onErrorMock}
      />
    );

    const input = screen.getByTestId("bank-slip-file-input") as HTMLInputElement;
    const file = new File(["test-content"], "receipt.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onSelectMock).toHaveBeenCalledTimes(1);
    expect(onSelectMock).toHaveBeenCalledWith(file);
  });

  it("validates file mime type and rejects unsupported formats", () => {
    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
        onError={onErrorMock}
      />
    );

    const input = screen.getByTestId("bank-slip-file-input") as HTMLInputElement;
    const invalidFile = new File(["some text"], "notes.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(onSelectMock).not.toHaveBeenCalled();
    expect(onErrorMock).toHaveBeenCalledWith(
      "Please select an image (PNG, JPG, WEBP, GIF) or PDF file"
    );
    expect(toast.error).toHaveBeenCalledWith(
      "Please select an image (PNG, JPG, WEBP, GIF) or PDF file"
    );
  });

  it("validates file size limit and rejects files exceeding maxSizeBytes", () => {
    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
        onError={onErrorMock}
        maxSizeBytes={1024 * 1024} // 1MB
      />
    );

    const input = screen.getByTestId("bank-slip-file-input") as HTMLInputElement;
    // Create mock file with size 2MB
    const bigFile = new File(["x"], "huge.png", { type: "image/png" });
    Object.defineProperty(bigFile, "size", { value: 2 * 1024 * 1024 });

    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(onSelectMock).not.toHaveBeenCalled();
    expect(onErrorMock).toHaveBeenCalledWith("File exceeds maximum allowed size of 1MB");
    expect(toast.error).toHaveBeenCalledWith("File exceeds maximum allowed size of 1MB");
  });

  it("handles drag & drop with an image file", () => {
    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
      />
    );

    const dropzone = screen.getByTestId("bank-slip-dropzone");
    const file = new File(["image-bytes"], "telegram-receipt.jpg", { type: "image/jpeg" });

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
        items: [],
      },
    });

    expect(onSelectMock).toHaveBeenCalledWith(file);
  });

  it("handles keyboard Ctrl+V paste event on dropzone", () => {
    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
      />
    );

    const dropzone = screen.getByTestId("bank-slip-dropzone");
    const file = new File(["pasted-slip-bytes"], "telegram-copy.png", { type: "image/png" });

    fireEvent.paste(dropzone, {
      clipboardData: {
        files: [file],
        items: [],
      },
    });

    expect(onSelectMock).toHaveBeenCalledWith(file);
    expect(toast.success).toHaveBeenCalledWith("Bank slip pasted from clipboard");
  });

  it("handles window paste event when component is mounted", () => {
    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
      />
    );

    const file = new File(["pasted-data"], "window-pasted.webp", { type: "image/webp" });

    // Simulate pressing Ctrl+V anywhere in the window
    window.dispatchEvent(
      new CustomEvent("paste", {
        detail: {},
      })
    );

    // Using real ClipboardEvent
    const pasteEvt = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvt, "clipboardData", {
      value: {
        files: [file],
        items: [],
      },
    });
    window.dispatchEvent(pasteEvt);

    expect(onSelectMock).toHaveBeenCalledWith(file);
    expect(toast.success).toHaveBeenCalledWith("Bank slip pasted from clipboard");
  });

  it("reads image from navigator.clipboard.read when 'Paste image' button is clicked", async () => {
    const imageBlob = new Blob(["fake-image-bytes"], { type: "image/png" });
    const mockClipboardItem = {
      types: ["image/png"],
      getType: vi.fn().mockResolvedValue(imageBlob),
    };

    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      value: {
        read: vi.fn().mockResolvedValue([mockClipboardItem]),
      },
    });

    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
      />
    );

    const pasteBtn = screen.getByTestId("bank-slip-paste-btn");
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      expect(onSelectMock).toHaveBeenCalledTimes(1);
    });

    const selectedFile = onSelectMock.mock.calls[0][0];
    expect(selectedFile.type).toBe("image/png");
    expect(selectedFile.name).toMatch(/^bank-slip-\d+-\d+\.png$/);
    expect(toast.success).toHaveBeenCalledWith("Bank slip pasted from clipboard");
  });

  it("displays error toast when clipboard contains no images", async () => {
    const textBlob = new Blob(["some-text"], { type: "text/plain" });
    const mockClipboardItem = {
      types: ["text/plain"],
      getType: vi.fn().mockResolvedValue(textBlob),
    };

    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      value: {
        read: vi.fn().mockResolvedValue([mockClipboardItem]),
      },
    });

    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
      />
    );

    const pasteBtn = screen.getByTestId("bank-slip-paste-btn");
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "No image found in clipboard. Please copy an image first (e.g. from Telegram)."
      );
    });
    expect(onSelectMock).not.toHaveBeenCalled();
  });

  it("handles clipboard permission rejection gracefully", async () => {
    const permError = new Error("NotAllowedError: Read permission denied.");
    permError.name = "NotAllowedError";

    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      value: {
        read: vi.fn().mockRejectedValue(permError),
      },
    });

    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
      />
    );

    const pasteBtn = screen.getByTestId("bank-slip-paste-btn");
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Clipboard permission denied. Press Ctrl+V to paste the image directly."
      );
    });
  });

  it("renders preview card, file name, and file size when a file is selected", () => {
    const file = new File(["fake-image-bytes"], "my-bank-slip.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 1024 * 250 }); // 250 KB

    render(
      <BankSlipUploader
        file={file}
        previewUrl="blob:http://localhost/fake-preview"
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
      />
    );

    expect(screen.getByText("my-bank-slip.png")).toBeInTheDocument();
    expect(screen.getByText(/250\.0 KB · Ready to save with payment/i)).toBeInTheDocument();
    expect(screen.getByAltText("Bank slip preview")).toHaveAttribute(
      "src",
      "blob:http://localhost/fake-preview"
    );

    // Remove button removes slip
    const removeBtn = screen.getByTestId("bank-slip-remove-btn");
    fireEvent.click(removeBtn);
    expect(onRemoveMock).toHaveBeenCalledTimes(1);
  });

  it("renders PDF document icon placeholder when previewUrl is null", () => {
    const pdfFile = new File(["%PDF-1.4"], "bank-transfer.pdf", { type: "application/pdf" });
    Object.defineProperty(pdfFile, "size", { value: 1024 * 50 });

    render(
      <BankSlipUploader
        file={pdfFile}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
      />
    );

    expect(screen.getByText("bank-transfer.pdf")).toBeInTheDocument();
    expect(screen.queryByAltText("Bank slip preview")).not.toBeInTheDocument();
  });

  it("opens context menu on right click with Paste and Browse options", async () => {
    render(
      <BankSlipUploader
        file={null}
        previewUrl={null}
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
      />
    );

    const dropzone = screen.getByTestId("bank-slip-dropzone");
    fireEvent.contextMenu(dropzone);

    await waitFor(() => {
      expect(screen.getByTestId("context-menu-paste-action")).toBeInTheDocument();
      expect(screen.getByTestId("context-menu-browse-action")).toBeInTheDocument();
    });

    expect(screen.getByText("Paste from clipboard")).toBeInTheDocument();
    expect(screen.getByText("Browse file...")).toBeInTheDocument();
  });

  it("shows 'Paste image to replace' and 'Remove image' in context menu when file exists", async () => {
    const file = new File(["bytes"], "slip.jpg", { type: "image/jpeg" });

    render(
      <BankSlipUploader
        file={file}
        previewUrl="blob:fake"
        onSelect={onSelectMock}
        onRemove={onRemoveMock}
      />
    );

    const previewContainer = screen.getByTestId("bank-slip-preview-container");
    fireEvent.contextMenu(previewContainer);

    await waitFor(() => {
      expect(screen.getByTestId("context-menu-paste-action")).toBeInTheDocument();
      expect(screen.getByTestId("context-menu-browse-action")).toBeInTheDocument();
      expect(screen.getByTestId("context-menu-remove-action")).toBeInTheDocument();
    });

    expect(screen.getByText("Paste image to replace")).toBeInTheDocument();
    expect(screen.getByText("Browse file to replace...")).toBeInTheDocument();
    expect(screen.getByText("Remove image")).toBeInTheDocument();

    // Clicking remove from context menu
    fireEvent.click(screen.getByTestId("context-menu-remove-action"));
    expect(onRemoveMock).toHaveBeenCalledTimes(1);
  });
});

