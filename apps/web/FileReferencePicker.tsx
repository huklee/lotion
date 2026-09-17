import { useEffect, useRef, useState } from "react";

export function FileReferencePicker({
  onInsert,
  onCancel,
}: {
  onInsert: (file: File, signal: AbortSignal) => Promise<void>;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
    input.current?.focus();
    return () => request.current?.abort();
  }, []);

  const cancel = () => {
    request.current?.abort();
    onCancel();
  };

  return (
    <dialog
      ref={dialog}
      className="file-reference-picker"
      aria-label="Insert file reference"
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!file || busy) return;
          const controller = new AbortController();
          request.current = controller;
          setBusy(true);
          setError("");
          void onInsert(file, controller.signal).catch((reason) => {
            if (!controller.signal.aborted) {
              setBusy(false);
              setError((reason as Error).message);
            }
          });
        }}
      >
        <h2>Insert file reference</h2>
        <p>Upload a file up to 20 MB and insert a downloadable reference.</p>
        <label>
          File
          <input
            ref={input}
            type="file"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError("");
            }}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="file-reference-actions">
          <button type="button" disabled={busy} onClick={cancel}>
            Cancel
          </button>
          <button type="submit" disabled={!file || busy}>
            {busy ? "Uploading…" : "Insert file"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
