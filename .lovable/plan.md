## Plan: Match Logic Pro Desktop DAW Layout

### Color Palette Update
- Change from dark theme (#3e3e3e) to Logic Pro's medium gray (#58585a app bg, #636366 panels, #4a4a4c panel lo)
- LCD display: dark navy with blue-green text (matching Logic's BAR/BEAT/TEMPO display)
- Gold/amber ruler bar for timeline
- Green accents for meters, Read automation, volume bars

### Edit View Changes
1. **Left Inspector Panel** (when open): Shows "Region: Audio Defaults" header and "Track: Audio 1" with channel strip below (number, pan knob L/R, Setting, EQ, Input, Audio FX, Sends, Stereo Out, Group, Read button, pan knob, dB display, fader with meter, R/I buttons, M/S buttons, track name label)
2. **Header Toolbar Row 1**: Library/Info/QuickHelp/Toolbar/SmartControls/Mixer/Scissors icons | Transport (Rewind, FF, Stop, Play, Record, Loop) | LCD (BAR/BEAT, TEMPO, TIME SIG, KEY) | 1234 button, metronome, zoom slider, List/Note/Loop/Media browsers
3. **Header Toolbar Row 2**: Edit/Functions/View dropdowns | Grid/List/Linear views | Pen/Auto/Flex icons | >T< | Pointer/Crosshair tools | Gear/waveform/quantize icons | zoom vertical/horizontal with delta buttons
4. **Track Header Row**: + button, track icon, number, waveform icon, track name, M/S/R buttons, green volume bar with thumb, pan knob
5. **Timeline**: Bar numbers on amber ruler, dark grid area

### Mixer View Changes
1. **Filter Bar**: Single | Tracks (selected) | All | Audio | Inst | Aux | Bus | Input | Output | Master/VCA | MIDI
2. **Channel Strip Layout** (top to bottom): Setting row, Gain Reduction bar, EQ slot, Input (O + "In 1"), Audio FX slot, Sends slot, Output "St Out", Group slot, Automation "Read" (green), waveform icon, Pan label + large knob, dB "0.0" + peak, tall fader with dB scale (6 to -60), colored meters, R/I buttons, M/S buttons, channel name with colored bottom bar
3. **Stereo Out Strip**: Same layout, Bnce button, M button, green label
4. **Master Strip**: M/D buttons, purple label

### Implementation
- Update LP color constants
- Rewrite mixer strip components with proper row-based Logic Pro layout
- Update all button/icon styling to match Logic Pro's lighter gray buttons
- Ensure inspector panel shows channel strip when open