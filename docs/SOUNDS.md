# Sounds

Everything is synthesised in `lib/sfx.ts` so the app ships no audio files —
except the pour, which is the one sound the ear actually checks. Real liquid is
irregular in a way an oscillator is not.

## Adding the real pour

Drop a file here and it is picked up automatically, no code change:

```
public/koup/sfx/pour.mp3
```

If the file is missing or unplayable the synthesised pour plays instead, so the
app is never silent.

### What to look for

- **2–3 seconds**, steady pour into a cup — not a kettle, not a waterfall.
- **Mono, 44.1 kHz, under ~80 KB** at 96–128 kbps. It plays on every launch.
- **Trim the silence** at both ends. The envelope in `sfx.ts` fades it in over
  120 ms and out over the last 350 ms, so any lead-in doubles up.
- You want the **rising pitch** as the cup fills. That is the cue that says
  "vessel filling" rather than "tap running" — a recording without it sounds
  worse than the synth.

### Where to get one

- **freesound.org** — filter to **CC0**. Search "pouring coffee cup".
- **pixabay.com/sound-effects** — all free for commercial use.
- Or record it: a phone 30 cm from a real cup at كوب, pouring at normal speed.
  That is the most on-brand option and takes two minutes.

Check the licence allows commercial use, and keep a note of the source in this
file when you add one.
