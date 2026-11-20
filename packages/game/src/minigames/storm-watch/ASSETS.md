# Storm Watch Assets

All visuals and audio in Storm Watch are 100% procedurally synthesized:

- **Visuals (3D WebGL / three.js)**:
  - Procedural geometries only (spheres, lathes, tubes, cones, instanced blobs), toon shaded with outline hulls
  - Luma rig reused from `bridge-wait/luma.ts`, firefly reused from `lantern-watch/props.ts`
  - Owl, cricket and birds built in `creatures.ts`; tree, forest, clouds, rain and lightning in `forest.ts`
  - Sky gradients (calm, storm, lightning flash) are CSS layers behind the transparent canvas

- **Audio (Web Audio API)**:
  - All sound effects (chime, tap, owl hoot, rolling thunder, Luma babble, rain noise) are generated in real-time via Web Audio oscillators, noise buffers, and biquad filters.
  - Zero external MP3/WAV files required.
  - 100% offline-ready, zero network latency, zero CORS or 404 risk.
