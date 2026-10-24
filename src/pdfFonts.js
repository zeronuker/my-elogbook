// Inter for the PDFs: static TTFs (jsPDF cannot use the woff2 files), fetched once on first export and cached by the service worker.
const toBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
let pdfFontsPromise = null;
export const loadPdfFonts = () => {
  if (!pdfFontsPromise) {
    const get = async (file) => {
      const res = await fetch(`${import.meta.env.BASE_URL}fonts/inter/${file}`);
      if (!res.ok) throw new Error("Could not load the PDF fonts");
      return toBase64(await res.arrayBuffer());
    };
    pdfFontsPromise = Promise.all([get("inter-pdf-400.ttf"), get("inter-pdf-700.ttf")])
      .then(([regular, bold]) => ({ regular, bold }))
      .catch((e) => { pdfFontsPromise = null; throw e; });
  }
  return pdfFontsPromise;
};
