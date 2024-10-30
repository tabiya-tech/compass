export function saveAs(blob: Blob, filename: string): void {
  // For Internet Explorer only
  if ((window.navigator as any)?.msSaveOrOpenBlob) {
    (window.navigator as any).msSaveOrOpenBlob(blob, filename);
    return;
  }

  // For other browsers, create a temporary URL
  const url = URL.createObjectURL(blob);

  // Create a temporary anchor element
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  // Append the anchor to the body (required for Firefox)
  document.body.appendChild(a);

  // Trigger the download by simulating a click
  a.click();

  // Clean up: remove the anchor and revoke the Blob URL
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
