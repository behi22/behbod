// A strip tile's pixels from the graphics card, read here where waiting for them holds up no frame of the house.
onmessage = async ({ data: frame }) => {
  try {
    const buf = new Uint8ClampedArray(frame.allocationSize({ format: 'RGBA' }));
    const [{ offset, stride }] = await frame.copyTo(buf, { format: 'RGBA' });
    postMessage({ buf, offset, stride }, [buf.buffer]);
  } catch (e) {
    postMessage({ error: String(e?.message || e) });
  } finally {
    frame.close();
  }
};
