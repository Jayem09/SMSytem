function getPrintArea() {
  let printArea = document.getElementById('print-area');

  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'print-area';
    document.body.appendChild(printArea);
  }

  return printArea;
}

function waitForPrintPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 150);
      });
    });
  });
}

export async function printMarkup(markup: string) {
  const printArea = getPrintArea();
  printArea.innerHTML = markup;

  await waitForPrintPaint();

  await new Promise<void>((resolve) => {
    const handleAfterPrint = () => {
      printArea.innerHTML = '';
      window.removeEventListener('afterprint', handleAfterPrint);
      resolve();
    };

    window.addEventListener('afterprint', handleAfterPrint, { once: true });
    window.print();
  });
}
