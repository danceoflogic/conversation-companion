# Audio Capture Helper

This machine's proven working input source is:

`alsa_input.usb-046d_HD_Pro_Webcam_C920_8185B3DF-02.analog-stereo`

The helper is intentionally hardened for that explicit Pulse/PipeWire source instead of trying to auto-detect a better one. It now records through `pw-record`, which proved reliable for this source on this host where `parec` was intermittently returning zero-byte captures.

## Usage

From the project root:

```bash
bash scripts/capture-audio-sample.sh
```

Optional arguments:

```bash
bash scripts/capture-audio-sample.sh 5 captures/test.wav
```

- first arg: duration in seconds
- second arg: output wav path

## Machine-specific note

On this host, the Logitech C920 mic source is most reliable when the helper first selects it as the default source, explicitly unmutes it, and then unsuspends it. The helper calls:

```bash
pactl set-default-source alsa_input.usb-046d_HD_Pro_Webcam_C920_8185B3DF-02.analog-stereo
pactl set-source-mute alsa_input.usb-046d_HD_Pro_Webcam_C920_8185B3DF-02.analog-stereo 0
pactl suspend-source alsa_input.usb-046d_HD_Pro_Webcam_C920_8185B3DF-02.analog-stereo 0
```

before `pw-record`, which is the machine-specific wake-up sequence for the explicit-source path here.

## Override

If you need to test a different source temporarily, set `AUDIO_SOURCE`, but the supported/default path for this machine is the C920 source above.

```bash
AUDIO_SOURCE=alsa_input.usb-046d_HD_Pro_Webcam_C920_8185B3DF-02.analog-stereo \
  bash scripts/capture-audio-sample.sh 3 /tmp/capture.wav
```
