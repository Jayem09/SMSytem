const PRINT_FRAME_ID = 'receipt-print-frame';

function getPrintFrame() {
  let frame = document.getElementById(PRINT_FRAME_ID) as HTMLIFrameElement | null;

  if (frame) {
    return frame;
  }

  frame = document.createElement('iframe');
  frame.id = PRINT_FRAME_ID;
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.style.pointerEvents = 'none';
  frame.style.background = 'transparent';
  document.body.appendChild(frame);

  return frame;
}

async function waitForPrintLayout(frameWindow: Window, frameDocument: Document) {
  if ('fonts' in frameDocument) {
    try {
      await frameDocument.fonts.ready;
    } catch {
      // Ignore font readiness failures and continue to print.
    }
  }

  await new Promise<void>((resolve) => {
    frameWindow.requestAnimationFrame(() => {
      frameWindow.requestAnimationFrame(() => resolve());
    });
  });

  await new Promise<void>((resolve) => setTimeout(resolve, 250));
}

export async function printHtmlDocument(htmlContent: string) {
  const frame = getPrintFrame();
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;

  if (!frameWindow || !frameDocument) {
    throw new Error('Printable frame is unavailable.');
  }

  frameDocument.open();
  frameDocument.write(htmlContent);
  frameDocument.close();

  await waitForPrintLayout(frameWindow, frameDocument);

  frameWindow.focus();
  frameWindow.print();

  frameDocument.open();
  frameDocument.write('<!DOCTYPE html><html><head><title>print</title></head><body></body></html>');
  frameDocument.close();
}
