// Fetches a picture and decodes it at a smaller size here, off the page's thread: decoding with a resize on the page
// held a slowed phone for a fifth of a second.
onmessage = async ({ data: { url, width, height } }) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
    const bitmap = await createImageBitmap(await res.blob(), { resizeWidth: width, resizeHeight: height, resizeQuality: 'medium' });
    postMessage({ bitmap }, [bitmap]);
  } catch (e) {
    postMessage({ error: String(e?.message || e) });
  }
};
