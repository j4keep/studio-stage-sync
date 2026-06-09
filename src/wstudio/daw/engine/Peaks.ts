export function computePeaks(buffer: AudioBuffer, samplesPerPixel = 512): Float32Array {
  const channelData = buffer.getChannelData(0);
  const numPeaks = Math.ceil(channelData.length / samplesPerPixel);
  const peaks = new Float32Array(numPeaks * 2);
  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, channelData.length);
    let min = 0, max = 0;
    for (let j = start; j < end; j++) {
      const v = channelData[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }
  return peaks;
}
