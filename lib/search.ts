/* One rule for every search box: Arabic is matched the way people type it.
 *
 *   أ إ آ ٱ → ا     ة → ه     ى → ي     ؤ → و     ئ → ي
 *   harakat and tatweel (ـ) are ignored, ٠١٢… are read as 0 1 2…,
 *   Latin letters ignore case.
 *
 * So "اسبريسو" finds "إسبريسو", "قهوه" finds "قهوة", "مثلّج" finds "مثلج". */

const MAP: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي",
}

/** The text reduced to what a search compares. */
export function fold(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFC")
    .replace(/[ً-ٰٟـ]/g, "") // harakat, dagger alif, tatweel
    .replace(/[أإآٱةىؤئ]/g, (c) => MAP[c])
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** Does `text` contain what was typed? An empty query matches everything. */
export function matches(text: string | null | undefined, query: string | null | undefined): boolean {
  const q = fold(query)
  return !q || fold(text).includes(q)
}
