#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <cmath>

namespace
{
constexpr float kPi = juce::MathConstants<float>::pi;

constexpr int kWindowW = 980;
constexpr int kWindowH = 560;
constexpr int kPanelTop = 118;
constexpr int kPanelH = 318;
constexpr int kOuterPad = 32;
/** Side cards — gutters between cards hold the stereo meters (see layout). */
constexpr int kPanelW = 200;
constexpr int kCenterW = 368;
#if JUCE_DEBUG
/** Debug-only: confirms Logic loaded this build (not shown in Release). */
constexpr const char* kUiBuildTag = "UI 2026-04c";
#endif

inline juce::Image makeFilmGrainTile(int size)
{
    juce::Image img(juce::Image::ARGB, size, size, true);
    juce::Random r(0x57475475);
    for (int y = 0; y < size; ++y)
        for (int x = 0; x < size; ++x)
        {
            if (r.nextFloat() < 0.11f)
            {
                const uint8_t a = (uint8_t)(r.nextInt(10) + 2);
                img.setPixelAt(x, y, juce::Colour((uint8_t)255, (uint8_t)255, (uint8_t)255, a));
            }
        }
    return img;
}

/** Soft stacked shadow so cards lift off the chassis (shipping-plugin depth). */
inline void drawCardShadow(juce::Graphics& g, juce::Rectangle<float> r, float corner)
{
    for (int pass = 4; pass >= 1; --pass)
    {
        const float t = (float)pass;
        g.setColour(juce::Colours::black.withAlpha(0.035f + 0.022f * t));
        g.fillRoundedRectangle(r.translated(t * 0.55f, t * 0.85f).expanded(t * 0.35f), corner + t * 0.4f);
    }
}

inline int gapWidth()
{
    return (kWindowW - 2 * kOuterPad - 2 * kPanelW - kCenterW) / 2;
}

inline int layoutLeftPanelX()
{
    return kOuterPad;
}

inline int layoutCenterX()
{
    return kOuterPad + kPanelW + gapWidth();
}

inline int layoutRightPanelX()
{
    return layoutCenterX() + kCenterW + gapWidth();
}

inline juce::Colour accentMain()
{
    return juce::Colour(0xff2ee0d8);
}
inline juce::Colour accentMic()
{
    return juce::Colour(0xff4dc4f5);
}
inline juce::Colour panelFill()
{
    return juce::Colour(0xff0e1118);
}
inline juce::Colour panelFillHi()
{
    return juce::Colour(0xff161b24);
}
inline juce::Colour chromeDeep()
{
    return juce::Colour(0xff06080c);
}

/** Inset card: vertical gradient + fine rim (premium plugin depth). */
inline void drawPremiumPanel(juce::Graphics& g, juce::Rectangle<float> r, float corner, juce::Colour rim,
                             juce::Colour innerGlow = juce::Colours::transparentBlack)
{
    juce::ColourGradient body(panelFillHi(), r.getX(), r.getY(), panelFill(), r.getX(), r.getBottom(), false);
    body.addColour(0.55f, panelFill().brighter(0.04f));
    g.setGradientFill(body);
    g.fillRoundedRectangle(r, corner);

    g.setColour(juce::Colours::black.withAlpha(0.35f));
    g.drawRoundedRectangle(r.reduced(0.5f), corner - 0.5f, 1.0f);
    g.setColour(juce::Colours::white.withAlpha(0.07f));
    g.drawRoundedRectangle(r.reduced(1.5f), corner - 1.0f, 1.0f);
    g.setColour(rim.withAlpha(0.55f));
    g.drawRoundedRectangle(r.reduced(2.0f), corner - 1.5f, 1.0f);

    if (innerGlow.getAlpha() > 0)
    {
        juce::ColourGradient gloss(juce::Colours::white.withAlpha(0.05f), r.getX(), r.getY(),
                                   juce::Colours::transparentBlack, r.getX(), r.getY() + r.getHeight() * 0.42f, false);
        g.saveState();
        juce::Path clip;
        clip.addRoundedRectangle(r.reduced(3.0f), corner - 2.0f);
        g.reduceClipRegion(clip);
        g.setGradientFill(gloss);
        g.fillRoundedRectangle(r.reduced(3.0f), corner - 2.0f);
        g.restoreState();
    }

    // Inner shadow along bottom edge (inset, hardware-console feel)
    g.saveState();
    juce::Path innerClip;
    innerClip.addRoundedRectangle(r.reduced(2.5f), corner - 1.5f);
    g.reduceClipRegion(innerClip);
    juce::ColourGradient insetShadow(juce::Colours::transparentBlack, r.getX(), r.getY() + r.getHeight() * 0.35f,
                                     juce::Colours::black.withAlpha(0.38f), r.getX(), r.getBottom(), false);
    g.setGradientFill(insetShadow);
    g.fillRoundedRectangle(r.reduced(2.5f), corner - 1.5f);
    g.restoreState();
}

inline void drawFrameBorder(juce::Graphics& g, juce::Rectangle<float> outer, float corner)
{
    g.setColour(accentMain().withAlpha(0.2f));
    g.drawRoundedRectangle(outer, corner, 1.25f);
    g.setColour(juce::Colours::black.withAlpha(0.35f));
    g.drawRoundedRectangle(outer.translated(0.0f, 1.0f), corner, 0.85f);
}
} // namespace

void WStudioLookAndFeel::drawRotarySlider(juce::Graphics& g, int x, int y, int w, int h,
                                          float sliderPosProportional, float rotaryStartAngle,
                                          float rotaryEndAngle, juce::Slider& slider)
{
    const bool micRing = slider.getName() == "micRing";
    const juce::Colour ringCol = micRing ? accentMic() : accentMain();

    auto bounds = juce::Rectangle<float>((float)x, (float)y, (float)w, (float)h).reduced(5.0f);
    const auto c = bounds.getCentre();
    const float rad = juce::jmin(bounds.getWidth(), bounds.getHeight()) * 0.5f;

    juce::DropShadow ds(juce::Colour(0xa0000000), 14, {0, 4});
    juce::Path shadowEllipse;
    shadowEllipse.addEllipse(c.x - rad - 1.0f, c.y - rad + 2.0f, (rad + 1.0f) * 2.0f, (rad + 1.0f) * 2.0f);
    ds.drawForPath(g, shadowEllipse);

    // Machined outer bezel (recessed ring)
    juce::ColourGradient bezel(juce::Colour(0xff1c222c), c.x, c.y - rad, juce::Colour(0xff0a0d12), c.x, c.y + rad,
                               true);
    g.setGradientFill(bezel);
    g.fillEllipse(c.x - rad, c.y - rad, rad * 2.0f, rad * 2.0f);
    g.setColour(juce::Colours::black.withAlpha(0.5f));
    g.drawEllipse(c.x - rad + 1.5f, c.y - rad + 1.5f, rad * 2.0f - 3.0f, rad * 2.0f - 3.0f, 1.0f);
    g.setColour(juce::Colours::white.withAlpha(0.08f));
    g.drawEllipse(c.x - rad + 2.5f, c.y - rad + 2.5f, rad * 2.0f - 5.0f, rad * 2.0f - 5.0f, 0.9f);

    const float trackR = rad - 5.0f;
    juce::Path track;
    track.addCentredArc(c.x, c.y, trackR, trackR, 0.0f, rotaryStartAngle, rotaryEndAngle, true);
    g.setColour(juce::Colour(0xff05070a));
    g.strokePath(track, juce::PathStrokeType(9.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    g.setColour(juce::Colours::white.withAlpha(0.06f));
    g.strokePath(track, juce::PathStrokeType(6.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    const float a =
        rotaryStartAngle + sliderPosProportional * (rotaryEndAngle - rotaryStartAngle);
    juce::Path valueArc;
    valueArc.addCentredArc(c.x, c.y, trackR, trackR, 0.0f, rotaryStartAngle, a, true);
    g.setColour(ringCol.withAlpha(0.15f));
    g.strokePath(valueArc, juce::PathStrokeType(14.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    g.setColour(ringCol.withAlpha(0.35f));
    g.strokePath(valueArc, juce::PathStrokeType(8.0f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    g.setColour(ringCol);
    g.strokePath(valueArc, juce::PathStrokeType(4.2f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));
    g.setColour(juce::Colours::white.withAlpha(0.55f));
    g.strokePath(valueArc, juce::PathStrokeType(1.4f, juce::PathStrokeType::curved, juce::PathStrokeType::rounded));

    const float kr = rad - 21.0f;

    // Brushed radial strokes (lathe / metal grain)
    g.saveState();
    juce::Path capOuter;
    capOuter.addEllipse(c.x - kr, c.y - kr, kr * 2.0f, kr * 2.0f);
    g.reduceClipRegion(capOuter);
    const int nBrush = 96;
    for (int i = 0; i < nBrush; ++i)
    {
        const float ang = kPi * 2.0f * (float)i / (float)nBrush;
        const float wobble = 0.55f + 0.45f * std::sin(ang * 6.0f + 1.3f);
        g.setColour(juce::Colours::white.withAlpha(0.018f * wobble));
        const float r0 = kr * 0.18f;
        const float r1 = kr * 0.98f;
        juce::Line<float> ray(c.x + std::cos(ang) * r0, c.y + std::sin(ang) * r0, c.x + std::cos(ang) * r1,
                              c.y + std::sin(ang) * r1);
        g.drawLine(ray, 1.1f);
    }
    g.restoreState();

    juce::ColourGradient knob(juce::Colour(0xff9ea6b0), c.x - kr * 0.3f, c.y - kr * 0.75f,
                              juce::Colour(0xff2c323c), c.x + kr * 0.2f, c.y + kr * 0.95f, true);
    knob.addColour(0.35f, juce::Colour(0xff5c646e));
    knob.addColour(0.62f, juce::Colour(0xff3a4048));
    g.setGradientFill(knob);
    g.fillEllipse(c.x - kr, c.y - kr, kr * 2.0f, kr * 2.0f);

    // Concentric lathe rings (subtle)
    for (int ri = 1; ri <= 4; ++ri)
    {
        const float rr = kr * (0.35f + 0.12f * (float)ri);
        g.setColour(juce::Colours::black.withAlpha(0.06f + 0.02f * (float)ri));
        g.drawEllipse(c.x - rr, c.y - rr, rr * 2.0f, rr * 2.0f, 0.7f);
    }

    juce::ColourGradient capHi(juce::Colours::white.withAlpha(0.28f), c.x - kr * 0.35f, c.y - kr * 0.85f,
                               juce::Colours::transparentBlack, c.x + kr * 0.4f, c.y - kr * 0.05f, true);
    g.saveState();
    juce::Path capClip;
    capClip.addEllipse(c.x - kr + 1.2f, c.y - kr + 1.2f, kr * 2.0f - 2.4f, kr * 2.0f - 2.4f);
    g.reduceClipRegion(capClip);
    g.setGradientFill(capHi);
    g.fillEllipse(c.x - kr, c.y - kr, kr * 2.0f, kr * 2.0f);
    g.restoreState();

    // Specular hotspot (machined dome)
    juce::ColourGradient spec(juce::Colours::white.withAlpha(0.5f), c.x - kr * 0.35f, c.y - kr * 0.55f,
                              juce::Colours::transparentBlack, c.x + kr * 0.2f, c.y - kr * 0.1f, true);
    g.saveState();
    juce::Path specClip;
    specClip.addEllipse(c.x - kr * 0.55f, c.y - kr * 0.95f, kr * 1.1f, kr * 0.65f);
    g.reduceClipRegion(specClip);
    g.setGradientFill(spec);
    g.fillEllipse(c.x - kr, c.y - kr, kr * 2.0f, kr * 2.0f);
    g.restoreState();

    g.setColour(juce::Colours::white.withAlpha(0.35f));
    g.drawEllipse(c.x - kr, c.y - kr, kr * 2.0f, kr * 2.0f, 1.05f);
    g.setColour(juce::Colours::black.withAlpha(0.55f));
    g.drawEllipse(c.x - kr + 2.2f, c.y - kr + 2.2f, kr * 2.0f - 4.4f, kr * 2.0f - 4.4f, 0.9f);

    const juce::Line<float> needle(
        c.x + std::cos(a - kPi * 0.5f) * (kr * 0.30f), c.y + std::sin(a - kPi * 0.5f) * (kr * 0.30f),
        c.x + std::cos(a - kPi * 0.5f) * (kr * 0.88f), c.y + std::sin(a - kPi * 0.5f) * (kr * 0.88f));
    g.setColour(juce::Colours::black.withAlpha(0.45f));
    const juce::Line<float> needleShadow(needle.getStart() + juce::Point<float>(0.8f, 0.8f),
                                         needle.getEnd() + juce::Point<float>(0.8f, 0.8f));
    g.drawLine(needleShadow, 3.2f);
    g.setColour(juce::Colour(0xfff5f7fa));
    g.drawLine(needle, 2.6f);

    // Recessed value readout
    const juce::Rectangle<float> lcd(c.x - kr * 0.72f, c.y + kr * 0.08f, kr * 1.44f, 17.0f);
    g.setColour(juce::Colour(0xff080a0e));
    g.fillRoundedRectangle(lcd, 4.0f);
    g.setColour(juce::Colours::black.withAlpha(0.4f));
    g.drawRoundedRectangle(lcd.translated(0, 0.8f), 4.0f, 0.8f);
    g.setColour(juce::Colours::white.withAlpha(0.12f));
    g.drawRoundedRectangle(lcd.reduced(0.5f), 3.5f, 0.7f);

    g.setColour(juce::Colour(0xffe8eef5));
    g.setFont(juce::FontOptions(12.0f, juce::Font::bold));
    const juce::String val = juce::String(slider.getValue(), 2);
    g.drawFittedText(val, (int)lcd.getX(), (int)lcd.getY(), (int)lcd.getWidth(), (int)lcd.getHeight(),
                     juce::Justification::centred, 1);
}

void WStudioLookAndFeel::drawButtonBackground(juce::Graphics& g, juce::Button& button,
                                              const juce::Colour&, bool, bool isDown)
{
    constexpr float corner = 8.0f;
    auto r = button.getLocalBounds().toFloat().reduced(0.5f);
    const bool on = button.getToggleState();
    const juce::String n = button.getName();
    const float alphaMul = button.isEnabled() ? 1.f : 0.55f;

    auto draw3D = [&](juce::Colour base, bool litRing, juce::Colour ringCol) {
        if (isDown)
            base = base.darker(0.12f);
        juce::ColourGradient sh(base.brighter(0.14f), r.getX(), r.getY(), base.darker(0.22f), r.getX(), r.getBottom(),
                                false);
        g.setGradientFill(sh);
        g.fillRoundedRectangle(r, corner);
        auto top = r.withHeight(r.getHeight() * 0.42f);
        g.setColour(juce::Colours::white.withAlpha(0.11f * alphaMul));
        g.fillRoundedRectangle(top, corner);
        g.setColour(juce::Colours::black.withAlpha(0.35f));
        g.drawRoundedRectangle(button.getLocalBounds().toFloat().reduced(0.5f), corner, 1.0f);
        g.setColour(juce::Colours::white.withAlpha(0.08f));
        g.drawRoundedRectangle(button.getLocalBounds().toFloat().reduced(1.5f), corner - 1.0f, 1.0f);
        if (litRing)
        {
            g.setColour(ringCol.withAlpha(0.55f * alphaMul));
            g.drawRoundedRectangle(button.getLocalBounds().toFloat().reduced(0.5f), corner, 1.65f);
            g.setColour(ringCol.withAlpha(0.2f * alphaMul));
            g.drawRoundedRectangle(button.getLocalBounds().toFloat().reduced(2.0f), corner - 1.5f, 2.0f);

            const float cy = r.getCentreY();
            const float lx = r.getX() + 10.f;
            g.setColour(juce::Colours::black.withAlpha(0.45f * alphaMul));
            g.fillEllipse(lx - 0.5f, cy - 3.5f, 8.0f, 8.0f);
            g.setColour(ringCol.brighter(0.25f).withAlpha(0.95f * alphaMul));
            g.fillEllipse(lx, cy - 3.0f, 7.0f, 7.0f);
            g.setColour(juce::Colours::white.withAlpha(0.7f * alphaMul));
            g.fillEllipse(lx + 1.2f, cy - 2.2f, 2.8f, 2.2f);
        }
    };

    if (n == "monitor" && on)
    {
        draw3D(juce::Colour(0xff1f6b5c), true, accentMain());
        return;
    }

    if ((n == "mute" || n == "inputMute") && on)
    {
        draw3D(juce::Colour(0xff8f3838), true, juce::Colour(0xffff6b6b));
        return;
    }

    if (n == "talkback" && on)
    {
        draw3D(juce::Colour(0xff1a5f72), true, accentMic());
        return;
    }

    draw3D(juce::Colour(0xff232a34).withMultipliedAlpha(alphaMul), false, {});
}

//==============================================================================
WStudioPluginAudioProcessorEditor::WStudioPluginAudioProcessorEditor(WStudioPluginAudioProcessor& p)
    : AudioProcessorEditor(&p), audioProcessor(p)
{
    setSize(kWindowW, kWindowH);
    setBufferedToImage(true);
    setLookAndFeel(&lnf);

    filmGrainTile = makeFilmGrainTile(112);

    titleLabel.setText("W.STUDIO", juce::dontSendNotification);
    titleLabel.setJustificationType(juce::Justification::centredLeft);
    titleLabel.setFont(juce::FontOptions(26.0f, juce::Font::bold));
    titleLabel.setColour(juce::Label::textColourId, juce::Colour(0xfff2f6fa));
    titleLabel.setInterceptsMouseClicks(false, false);
    addAndMakeVisible(titleLabel);

    statusLabel.setText("OFFLINE", juce::dontSendNotification);
    statusLabel.setJustificationType(juce::Justification::centredRight);
    statusLabel.setFont(juce::FontOptions(15.0f, juce::Font::bold));
    statusLabel.setColour(juce::Label::textColourId, juce::Colour(0xff9ca3b0));
    statusLabel.setInterceptsMouseClicks(false, false);
    addAndMakeVisible(statusLabel);

    artistLabel.setText("ARTIST: SESSION", juce::dontSendNotification);
    artistLabel.setJustificationType(juce::Justification::centredRight);
    artistLabel.setFont(juce::FontOptions(14.0f));
    artistLabel.setColour(juce::Label::textColourId, juce::Colour(0xff8a93a0));
    artistLabel.setInterceptsMouseClicks(false, false);
    addAndMakeVisible(artistLabel);

    controlStatusLabel.setText({}, juce::dontSendNotification);
    controlStatusLabel.setJustificationType(juce::Justification::centredLeft);
    controlStatusLabel.setFont(juce::FontOptions(12.0f, juce::Font::bold));
    controlStatusLabel.setColour(juce::Label::textColourId, juce::Colour(0xff6a7380));
    controlStatusLabel.setInterceptsMouseClicks(false, false);
    addAndMakeVisible(controlStatusLabel);

    sessionCodeEditor.setMultiLine(false);
    sessionCodeEditor.setReturnKeyStartsNewLine(false);
    sessionCodeEditor.setScrollToShowCursor(false);
    sessionCodeEditor.setCaretVisible(true);
    sessionCodeEditor.setFont(juce::FontOptions(12.5f));
    sessionCodeEditor.setTextToShowWhenEmpty("Session code", juce::Colour(0xff6a7380));
    sessionCodeEditor.setColour(juce::TextEditor::backgroundColourId, juce::Colour(0xff12161e));
    sessionCodeEditor.setColour(juce::TextEditor::outlineColourId, juce::Colours::white.withAlpha(0.12f));
    sessionCodeEditor.setColour(juce::TextEditor::focusedOutlineColourId, accentMain().withAlpha(0.55f));
    sessionCodeEditor.setColour(juce::TextEditor::textColourId, juce::Colour(0xffe8eef5));
    addAndMakeVisible(sessionCodeEditor);

    accessTokenEditor.setMultiLine(false);
    accessTokenEditor.setReturnKeyStartsNewLine(false);
    accessTokenEditor.setScrollToShowCursor(false);
    accessTokenEditor.setCaretVisible(true);
    accessTokenEditor.setFont(juce::FontOptions(12.5f));
    accessTokenEditor.setPasswordCharacter((juce::juce_wchar) 0x2022);
    accessTokenEditor.setTextToShowWhenEmpty("Supabase access token", juce::Colour(0xff6a7380));
    accessTokenEditor.setColour(juce::TextEditor::backgroundColourId, juce::Colour(0xff12161e));
    accessTokenEditor.setColour(juce::TextEditor::outlineColourId, juce::Colours::white.withAlpha(0.12f));
    accessTokenEditor.setColour(juce::TextEditor::focusedOutlineColourId, accentMic().withAlpha(0.45f));
    accessTokenEditor.setColour(juce::TextEditor::textColourId, juce::Colour(0xffe8eef5));
    addAndMakeVisible(accessTokenEditor);

    fetchSessionButton.setButtonText("SYNC");
    fetchSessionButton.setName("fetchSession");
    fetchSessionButton.setColour(juce::TextButton::textColourOffId, juce::Colours::white);
    fetchSessionButton.setColour(juce::TextButton::textColourOnId, juce::Colours::white);
    fetchSessionButton.setLookAndFeel(&lnf);
    fetchSessionButton.onClick = [this] {
        if (session == nullptr)
            return;
        sessionSyncStatusLabel.setText("Sync: …", juce::dontSendNotification);
        fetchSessionButton.setEnabled(false);
        juce::Component::SafePointer<WStudioPluginAudioProcessorEditor> safe(this);
        session->fetchRemoteSession(sessionCodeEditor.getText(), accessTokenEditor.getText(),
                                    [safe](bool ok, juce::String err) {
                                        if (safe == nullptr)
                                            return;
                                        safe->fetchSessionButton.setEnabled(true);
                                        if (ok)
                                            safe->sessionSyncStatusLabel.setText("Sync: connected to session",
                                                                                  juce::dontSendNotification);
                                        else if (err.isNotEmpty())
                                            safe->sessionSyncStatusLabel.setText("Sync: " + err,
                                                                                   juce::dontSendNotification);
                                        else
                                            safe->sessionSyncStatusLabel.setText({}, juce::dontSendNotification);
                                        safe->syncTalkbackWithRole();
                                        safe->refreshHeaderLabelsFromSession();
                                        safe->refreshControlButtonLabels();
                                        safe->updatePriorityControlStatus();
                                        safe->repaint();
                                    });
    };
    addAndMakeVisible(fetchSessionButton);

    sessionSyncStatusLabel.setText({}, juce::dontSendNotification);
    sessionSyncStatusLabel.setJustificationType(juce::Justification::centredLeft);
    sessionSyncStatusLabel.setFont(juce::FontOptions(11.0f));
    sessionSyncStatusLabel.setColour(juce::Label::textColourId, juce::Colour(0xff7a8494));
    sessionSyncStatusLabel.setInterceptsMouseClicks(false, false);
    addAndMakeVisible(sessionSyncStatusLabel);

    gainKnob.setName("engineerRing");
    gainKnob.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    gainKnob.setTextBoxStyle(juce::Slider::NoTextBox, false, 0, 0);
    gainKnob.setRotaryParameters(1.1f * kPi, 2.9f * kPi, true);
    gainKnob.setColour(juce::Slider::textBoxTextColourId, juce::Colours::white);
    gainKnob.setLookAndFeel(&lnf);
    addAndMakeVisible(gainKnob);

    gainLabel.setText("GAIN", juce::dontSendNotification);
    gainLabel.setJustificationType(juce::Justification::centred);
    gainLabel.setColour(juce::Label::textColourId, juce::Colour(0xffc5cdd8));
    gainLabel.setFont(juce::FontOptions(11.5f, juce::Font::bold));
    gainLabel.setInterceptsMouseClicks(false, false);
    addAndMakeVisible(gainLabel);

    muteButton.setButtonText("MUTE");
    muteButton.setName("mute");
    muteButton.setClickingTogglesState(true);
    muteButton.setColour(juce::TextButton::textColourOffId, juce::Colours::white);
    muteButton.setColour(juce::TextButton::textColourOnId, juce::Colours::white);
    muteButton.setLookAndFeel(&lnf);
    addAndMakeVisible(muteButton);

    monitorButton.setButtonText("MONITOR");
    monitorButton.setName("monitor");
    monitorButton.setClickingTogglesState(true);
    monitorButton.setColour(juce::TextButton::textColourOffId, juce::Colours::white);
    monitorButton.setColour(juce::TextButton::textColourOnId, juce::Colours::white);
    monitorButton.setLookAndFeel(&lnf);
    addAndMakeVisible(monitorButton);

    talkbackButton.setButtonText("TALKBACK");
    talkbackButton.setName("talkback");
    talkbackButton.setClickingTogglesState(true);
    talkbackButton.setColour(juce::TextButton::textColourOffId, juce::Colours::white);
    talkbackButton.setColour(juce::TextButton::textColourOnId, juce::Colours::white);
    talkbackButton.setLookAndFeel(&lnf);
    addAndMakeVisible(talkbackButton);

    inputGainKnob.setName("micRing");
    inputGainKnob.setSliderStyle(juce::Slider::RotaryVerticalDrag);
    inputGainKnob.setTextBoxStyle(juce::Slider::NoTextBox, false, 0, 0);
    inputGainKnob.setRotaryParameters(1.1f * kPi, 2.9f * kPi, true);
    inputGainKnob.setLookAndFeel(&lnf);
    addAndMakeVisible(inputGainKnob);

    inputGainLabel.setText("MIC GAIN", juce::dontSendNotification);
    inputGainLabel.setJustificationType(juce::Justification::centred);
    inputGainLabel.setColour(juce::Label::textColourId, juce::Colour(0xffc5cdd8));
    inputGainLabel.setFont(juce::FontOptions(11.5f, juce::Font::bold));
    inputGainLabel.setInterceptsMouseClicks(false, false);
    addAndMakeVisible(inputGainLabel);

    inputMuteButton.setButtonText("MIC MUTE");
    inputMuteButton.setName("inputMute");
    inputMuteButton.setClickingTogglesState(true);
    inputMuteButton.setColour(juce::TextButton::textColourOffId, juce::Colours::white);
    inputMuteButton.setColour(juce::TextButton::textColourOnId, juce::Colours::white);
    inputMuteButton.setLookAndFeel(&lnf);
    addAndMakeVisible(inputMuteButton);

    gainAttachment =
        std::make_unique<APVTS::SliderAttachment>(audioProcessor.getAPVTS(), WStudioParams::gainId, gainKnob);
    inputGainAttachment = std::make_unique<APVTS::SliderAttachment>(audioProcessor.getAPVTS(),
                                                                      WStudioParams::inputGainId, inputGainKnob);
    muteAttachment =
        std::make_unique<APVTS::ButtonAttachment>(audioProcessor.getAPVTS(), WStudioParams::muteId, muteButton);
    monitorAttachment =
        std::make_unique<APVTS::ButtonAttachment>(audioProcessor.getAPVTS(), WStudioParams::monitorId, monitorButton);
    talkbackAttachment =
        std::make_unique<APVTS::ButtonAttachment>(audioProcessor.getAPVTS(), WStudioParams::talkbackId, talkbackButton);
    inputMuteAttachment = std::make_unique<APVTS::ButtonAttachment>(audioProcessor.getAPVTS(),
                                                                    WStudioParams::inputMuteId, inputMuteButton);

    session = std::make_unique<SessionController>(audioProcessor);
    session->fromValueTree(audioProcessor.copySessionSnapshot());
    syncTalkbackWithRole();
    refreshHeaderLabelsFromSession();
    refreshControlButtonLabels();
    updatePriorityControlStatus();

    // Hosts (e.g. Logic) may not call prepareToPlay until play / graph wake — browser WebSocket connects earlier.
    audioProcessor.ensureNetworkBridgeServerRunning();

    startTimerHz(24);
}

WStudioPluginAudioProcessorEditor::~WStudioPluginAudioProcessorEditor()
{
    audioProcessor.commitSessionSnapshot(session->toValueTree());
    stopTimer();
    setLookAndFeel(nullptr);
    gainKnob.setLookAndFeel(nullptr);
    inputGainKnob.setLookAndFeel(nullptr);
    muteButton.setLookAndFeel(nullptr);
    monitorButton.setLookAndFeel(nullptr);
    talkbackButton.setLookAndFeel(nullptr);
    fetchSessionButton.setLookAndFeel(nullptr);
    fetchSessionButton.onClick = nullptr;
    inputMuteButton.setLookAndFeel(nullptr);
}

void WStudioPluginAudioProcessorEditor::refreshHeaderLabelsFromSession()
{
    if (session == nullptr)
        return;

    statusLabel.setText(session->getHeaderStatusText(), juce::dontSendNotification);
    artistLabel.setText(session->getHeaderSessionLine(), juce::dontSendNotification);

    juce::Colour c(0xff9ca3b0);
    switch (session->getSessionState())
    {
        case SessionState::Offline:
            c = juce::Colour(0xff9ca3b0);
            break;
        case SessionState::Connecting:
            c = juce::Colour(0xffffc080);
            break;
        case SessionState::Connected:
        case SessionState::Live:
        case SessionState::Recording:
            c = accentMain();
            break;
        case SessionState::Error:
            c = juce::Colour(0xffff6b6b);
            break;
    }
    statusLabel.setColour(juce::Label::textColourId, c);
}

juce::String WStudioPluginAudioProcessorEditor::computePriorityControlStatusMessage() const
{
    if (audioProcessor.isOutputMuted())
        return "OUTPUT MUTED";
    if (audioProcessor.isMicMuted())
        return "MIC MUTED";
    if (session != nullptr && session->isTalkbackAllowed() && audioProcessor.isTalkbackEnabled())
        return "TALKBACK ON";
    if (audioProcessor.isMonitorEnabled())
        return "MONITOR ON";
    return {};
}

void WStudioPluginAudioProcessorEditor::updatePriorityControlStatus()
{
    const auto msg = computePriorityControlStatusMessage();
    controlStatusLabel.setText(msg, juce::dontSendNotification);

    juce::Colour c(0xff5c6570);
    if (msg == "OUTPUT MUTED" || msg == "MIC MUTED")
        c = juce::Colour(0xffff9a8e);
    else if (msg == "TALKBACK ON")
        c = accentMic();
    else if (msg == "MONITOR ON")
        c = accentMain();
    controlStatusLabel.setColour(juce::Label::textColourId, c);
}

void WStudioPluginAudioProcessorEditor::refreshControlButtonLabels()
{
    muteButton.setButtonText(muteButton.getToggleState() ? "MUTED" : "MUTE");
    monitorButton.setButtonText(monitorButton.getToggleState() ? "MONITOR ON" : "MONITOR");
    talkbackButton.setButtonText(talkbackButton.getToggleState() ? "TALKBACK ON" : "TALKBACK");
    inputMuteButton.setButtonText(inputMuteButton.getToggleState() ? "MIC MUTED" : "MIC MUTE");
}

void WStudioPluginAudioProcessorEditor::syncTalkbackWithRole()
{
    if (session == nullptr)
        return;

    const bool allow = session->isTalkbackAllowed();
    talkbackButton.setEnabled(allow);
    talkbackButton.setAlpha(allow ? 1.f : 0.42f);

    if (!allow && audioProcessor.isTalkbackEnabled())
        audioProcessor.setTalkbackEnabled(false);
}

void WStudioPluginAudioProcessorEditor::drawStereoMeters(juce::Graphics& g, int leftBarX, int rightBarX, int y,
                                                         int barW, int barH, juce::Colour meterAccent) const
{
    auto drawTrack = [&](int x) {
        juce::Rectangle<float> outer((float)x - 3, (float)y - 3, (float)barW + 6, (float)barH + 6);
        g.setColour(juce::Colour(0xff010203));
        g.fillRoundedRectangle(outer, 11.0f);
        juce::ColourGradient groove(juce::Colour(0xff060910), (float)x, (float)y, juce::Colour(0xff121a24), (float)x,
                                    (float)(y + barH), false);
        g.setGradientFill(groove);
        g.fillRoundedRectangle((float)x, (float)y, (float)barW, (float)barH, 7.0f);
        g.setColour(juce::Colours::white.withAlpha(0.04f));
        g.drawRoundedRectangle((float)x, (float)y, (float)barW, (float)barH, 7.0f, 1.0f);

        g.setColour(juce::Colours::white.withAlpha(0.07f));
        for (float frac : {0.25f, 0.5f, 0.75f})
        {
            const float ty = (float)y + (float)barH * (1.f - frac);
            g.drawLine((float)x + 2.0f, ty, (float)(x + barW) - 2.0f, ty, 0.7f);
        }
    };

    drawTrack(leftBarX);
    drawTrack(rightBarX);

    auto drawFill = [&](int x, float level) {
        const float clamped = juce::jlimit(0.0f, 1.0f, level);
        constexpr int segH = 3;
        constexpr int gap = 2;
        const int innerTop = y + 3;
        const int innerBottom = y + barH - 3;
        const int usable = innerBottom - innerTop;
        const int nSeg = juce::jmax(10, usable / (segH + gap));

        juce::Colour cOff(0xff141a22);
        juce::Colour cDeep(0xff053038);
        juce::Colour cMid(meterAccent);
        juce::Colour cHi(meterAccent.brighter(0.55f));

        if (audioProcessor.isMuteEnabled())
        {
            cDeep = cMid = cHi = juce::Colour(0xff2a3238);
        }
        else if (!audioProcessor.isMonitorEnabled())
        {
            cDeep = cDeep.withAlpha(0.4f);
            cMid = cMid.withAlpha(0.4f);
            cHi = cHi.withAlpha(0.4f);
        }

        for (int si = 0; si < nSeg; ++si)
        {
            const float t1 = (float)(si + 1) / (float)nSeg;
            const bool lit = clamped >= t1 - 0.0001f;
            const float segY = (float)innerBottom - (float)(si + 1) * (float)(segH + gap) + (float)gap;
            juce::Rectangle<float> seg((float)x + 4.0f, segY, (float)barW - 8.0f, (float)segH);

            if (!lit)
            {
                g.setColour(cOff);
                g.fillRoundedRectangle(seg, 1.2f);
                g.setColour(juce::Colours::black.withAlpha(0.35f));
                g.drawRoundedRectangle(seg, 1.2f, 0.6f);
                continue;
            }

            const float segNorm = t1;
            juce::Colour a = cDeep.interpolatedWith(cMid, segNorm);
            juce::Colour b = cMid.interpolatedWith(cHi, juce::jlimit(0.f, 1.f, (segNorm - 0.5f) * 2.f));
            juce::ColourGradient sg(a, seg.getX(), seg.getBottom(), b, seg.getX(), seg.getY(), false);
            g.setGradientFill(sg);
            g.fillRoundedRectangle(seg, 1.2f);

            g.setColour(juce::Colours::white.withAlpha(0.42f));
            g.fillRoundedRectangle(seg.withHeight(1.0f), 0.55f);
        }
    };

    float vl = smoothedLeft;
    float vr = smoothedRight;
    if (audioProcessor.isMuteEnabled())
    {
        vl = vr = 0.f;
    }
    else if (!audioProcessor.isMonitorEnabled())
    {
        vl *= 0.2f;
        vr *= 0.2f;
    }

    drawFill(leftBarX, vl);
    drawFill(rightBarX, vr);
}

void WStudioPluginAudioProcessorEditor::paint(juce::Graphics& g)
{
    auto bounds = getLocalBounds().toFloat();

    g.fillAll(chromeDeep());

    juce::ColourGradient vignette(accentMain().withAlpha(0.07f), bounds.getCentreX(), bounds.getY() + 40.f,
                                   juce::Colours::transparentBlack, bounds.getCentreX(), bounds.getBottom(), true);
    g.setGradientFill(vignette);
    g.fillRect(bounds);

    juce::ColourGradient bgGradient(juce::Colour(0xff121820), 0.0f, 0.0f, juce::Colour(0xff05070a), 0.0f,
                                    (float)getHeight(), false);
    bgGradient.addColour(0.5f, juce::Colour(0xff0c1016));
    g.setGradientFill(bgGradient);
    g.fillRect(bounds);

    if (filmGrainTile.isValid())
    {
        g.setOpacity(0.14f);
        for (int py = 0; py < getHeight(); py += filmGrainTile.getHeight())
            for (int px = 0; px < getWidth(); px += filmGrainTile.getWidth())
                g.drawImageAt(filmGrainTile, px, py);
        g.setOpacity(1.f);
    }

    drawFrameBorder(g, bounds.reduced(8.0f), 18.0f);

    juce::Rectangle<float> topBar(18.0f, 16.0f, (float)getWidth() - 36.0f, 74.0f);
    drawCardShadow(g, topBar, 16.0f);
    drawPremiumPanel(g, topBar, 16.0f, accentMain(), juce::Colours::white);

    const float leftPX = (float)layoutLeftPanelX();
    const float rightPX = (float)layoutRightPanelX();

    juce::Rectangle<float> leftPanel(leftPX, (float)kPanelTop, (float)kPanelW, (float)kPanelH);
    juce::Rectangle<float> rightPanel(rightPX, (float)kPanelTop, (float)kPanelW, (float)kPanelH);
    centerPanelFloat =
        juce::Rectangle<float>((float)layoutCenterX(), (float)kPanelTop, (float)kCenterW, (float)kPanelH);

    drawCardShadow(g, leftPanel, 18.0f);
    drawPremiumPanel(g, leftPanel, 18.0f, accentMain(), juce::Colours::white);
    drawCardShadow(g, centerPanelFloat, 22.0f);
    drawPremiumPanel(g, centerPanelFloat, 22.0f, accentMain().withAlpha(0.9f), juce::Colours::white);
    drawCardShadow(g, rightPanel, 18.0f);
    drawPremiumPanel(g, rightPanel, 18.0f, accentMic().withAlpha(0.85f), juce::Colours::white);

    {
        juce::Graphics::ScopedSaveState clipScope(g);
        juce::Path clipPath;
        clipPath.addRoundedRectangle(centerPanelFloat.reduced(4.0f), 19.0f);
        g.reduceClipRegion(clipPath);

        auto liveArea = liveButtonBounds.toFloat();
        auto centre = liveArea.getCentre();

        const auto st = session->getSessionState();
        const bool liveConnecting = (st == SessionState::Connecting);
        const bool liveActive = (st == SessionState::Live || st == SessionState::Recording);
        const bool orbShouldGlow = session->shouldGlowLiveOrb();

        const float glowRadius = liveActive ? 155.0f : (orbShouldGlow ? 138.0f : 122.0f);
        juce::Colour glowCentre = liveActive ? accentMain().withAlpha(0.58f)
                                              : (liveConnecting ? juce::Colour(0xffffb84d).withAlpha(0.45f)
                                                                : accentMain().withAlpha(0.32f));
        juce::ColourGradient glowGradient(glowCentre, centre.x, centre.y, juce::Colours::transparentBlack,
                                          centre.x + glowRadius * 0.9f, centre.y + glowRadius * 0.9f, true);
        g.setGradientFill(glowGradient);
        g.fillEllipse(centre.x - glowRadius, centre.y - glowRadius, glowRadius * 2.0f, glowRadius * 2.0f);

        juce::ColourGradient outerHalo(accentMain().withAlpha(liveActive ? 0.25f : 0.1f), centre.x, centre.y - 20.f,
                                       juce::Colours::transparentBlack, centre.x, centre.y + 90.f, true);
        g.setGradientFill(outerHalo);
        g.fillEllipse(centre.x - glowRadius * 1.05f, centre.y - glowRadius * 1.05f, glowRadius * 2.1f,
                      glowRadius * 2.1f);

        const float outerSize = 172.0f;
        const float innerSize = 132.0f;

        juce::Rectangle<float> outerCircle(centre.x - outerSize * 0.5f, centre.y - outerSize * 0.5f, outerSize,
                                           outerSize);
        juce::Rectangle<float> innerCircle(centre.x - innerSize * 0.5f, centre.y - innerSize * 0.5f, innerSize,
                                           innerSize);

        juce::Colour ringCol =
            liveActive ? accentMain() : (liveConnecting ? juce::Colour(0xffffb84d) : accentMain().withAlpha(0.8f));
        g.setColour(ringCol.withAlpha(0.35f));
        g.drawEllipse(outerCircle.expanded(2.0f, 2.0f), 4.0f);
        g.setColour(ringCol);
        g.drawEllipse(outerCircle, 2.8f);
        g.setColour(juce::Colours::white.withAlpha(0.18f));
        g.drawEllipse(outerCircle.reduced(3.0f), 1.2f);
        g.setColour(juce::Colours::black.withAlpha(0.35f));
        g.drawEllipse(outerCircle.translated(0, 1.5f), 1.5f);

        juce::ColourGradient liveFill(
            liveActive ? juce::Colour(0xff143832)
                       : (liveConnecting ? juce::Colour(0xff2e2618) : juce::Colour(0xff121820)),
            innerCircle.getX(), innerCircle.getY(),
            liveActive ? juce::Colour(0xff0a1412)
                       : (liveConnecting ? juce::Colour(0xff1a140c) : juce::Colour(0xff080c12)),
            innerCircle.getBottomRight().x, innerCircle.getBottomRight().y, false);

        g.setGradientFill(liveFill);
        g.fillEllipse(innerCircle);
        g.setColour(juce::Colours::white.withAlpha(0.28f));
        g.drawEllipse(innerCircle, 1.35f);

        juce::ColourGradient innerSheen(juce::Colours::white.withAlpha(0.12f), innerCircle.getCentreX(),
                                          innerCircle.getY() + 8.f, juce::Colours::transparentBlack,
                                          innerCircle.getCentreX(), innerCircle.getBottom(), false);
        g.saveState();
        juce::Path innerClip;
        innerClip.addEllipse(innerCircle.reduced(4.0f));
        g.reduceClipRegion(innerClip);
        g.setGradientFill(innerSheen);
        g.fillEllipse(innerCircle.reduced(4.0f));
        g.restoreState();

        const juce::String liveTitle = session->getLivePrimaryText();
        const juce::String liveSubtitle = session->getLiveSecondaryText();
        juce::Colour liveStatusColour = juce::Colour(0xff9ca3b0);
        if (liveConnecting)
            liveStatusColour = juce::Colour(0xffffc080);
        else if (liveActive)
            liveStatusColour = accentMain();
        else if (st == SessionState::Connected)
            liveStatusColour = accentMain().withAlpha(0.85f);

        g.setFont(juce::FontOptions(31.0f, juce::Font::bold));
        g.setColour(juce::Colours::black.withAlpha(0.45f));
        g.drawFittedText(liveTitle, (int)innerCircle.getX() + 1, (int)innerCircle.getY() + 39,
                         (int)innerCircle.getWidth(), 34, juce::Justification::centred, 1);
        g.setColour(juce::Colours::white);
        g.drawFittedText(liveTitle, (int)innerCircle.getX(), (int)innerCircle.getY() + 38, (int)innerCircle.getWidth(),
                         34, juce::Justification::centred, 1);

        g.setFont(juce::FontOptions(13.5f, juce::Font::bold));
        g.setColour(juce::Colours::black.withAlpha(0.35f));
        g.drawFittedText(liveSubtitle, (int)innerCircle.getX() + 1, (int)innerCircle.getY() + 81,
                         (int)innerCircle.getWidth(), 22, juce::Justification::centred, 1);
        g.setColour(liveStatusColour);
        g.drawFittedText(liveSubtitle, (int)innerCircle.getX(), (int)innerCircle.getY() + 80,
                         (int)innerCircle.getWidth(), 22, juce::Justification::centred, 1);
    }

    drawStereoMeters(g, leftMeterLeftX, leftMeterRightX, meterBarY, meterBarW, meterBarH, accentMain());
    drawStereoMeters(g, rightMeterLeftX, rightMeterRightX, meterBarY, meterBarW, meterBarH, accentMic());

    g.setColour(accentMain().withAlpha(0.55f));
    g.setFont(juce::FontOptions(9.5f, juce::Font::bold));
    const int stereoSpanL = (leftMeterRightX + meterBarW) - leftMeterLeftX + 8;
    g.drawFittedText("STEREO", leftMeterLeftX - 4, leftStereoLabelY, stereoSpanL, 14, juce::Justification::centred, 1);
    const int stereoSpanR = (rightMeterRightX + meterBarW) - rightMeterLeftX + 8;
    g.drawFittedText("STEREO", rightMeterLeftX - 4, rightStereoLabelY, stereoSpanR, 14, juce::Justification::centred, 1);

    g.setColour(juce::Colours::white.withAlpha(0.82f));
    g.setFont(juce::FontOptions(10.5f, juce::Font::bold));
    g.drawFittedText("L", leftMeterLeftX, leftLrLabelY, meterBarW, 14, juce::Justification::centred, 1);
    g.drawFittedText("R", leftMeterRightX, leftLrLabelY, meterBarW, 14, juce::Justification::centred, 1);
    g.drawFittedText("L", rightMeterLeftX, rightLrLabelY, meterBarW, 14, juce::Justification::centred, 1);
    g.drawFittedText("R", rightMeterRightX, rightLrLabelY, meterBarW, 14, juce::Justification::centred, 1);

    g.setColour(juce::Colours::white.withAlpha(0.28f));
    g.setFont(juce::FontOptions(10.5f, juce::Font::bold));
    g.drawFittedText("W.STUDIO REMOTE SESSION", getWidth() - 220, getHeight() - 26, 208, 16,
                     juce::Justification::centredRight, 1);

#if JUCE_DEBUG
    g.setColour(accentMain().withAlpha(0.45f));
    g.setFont(juce::FontOptions(9.5f, juce::Font::bold));
    g.drawFittedText(kUiBuildTag, 20, getHeight() - 26, 140, 16, juce::Justification::centredLeft, 1);
#endif
}

void WStudioPluginAudioProcessorEditor::resized()
{
    titleLabel.setBounds(40, 30, 260, 34);
    statusLabel.setBounds(getWidth() - 280, 24, 220, 26);
    artistLabel.setBounds(getWidth() - 300, 50, 260, 22);
    controlStatusLabel.setBounds(40, 56, juce::jmax(180, getWidth() - 380), 18);

    centerPanelFloat =
        juce::Rectangle<float>((float)layoutCenterX(), (float)kPanelTop, (float)kCenterW, (float)kPanelH);

    const int leftPanelX = layoutLeftPanelX();
    const int rightPanelX = layoutRightPanelX();
    const int gw = gapWidth();

    meterBarW = 22;
    meterBarH = 210;
    meterBarY = kPanelTop + (kPanelH - meterBarH) / 2;

    const int gapLeft0 = leftPanelX + kPanelW;
    const int gapLeftMid = gapLeft0 + gw / 2;
    const int pairW = meterBarW * 2 + 8;
    leftMeterLeftX = gapLeftMid - pairW / 2;
    leftMeterRightX = leftMeterLeftX + meterBarW + 8;

    const int gapRight0 = layoutCenterX() + kCenterW;
    const int gapRightMid = gapRight0 + gw / 2;
    rightMeterLeftX = gapRightMid - pairW / 2;
    rightMeterRightX = rightMeterLeftX + meterBarW + 8;

    leftStereoLabelY = meterBarY + meterBarH + 4;
    leftLrLabelY = leftStereoLabelY + 14;
    rightStereoLabelY = leftStereoLabelY;
    rightLrLabelY = leftLrLabelY;

    const int knobSz = 118;
    const int leftCx = leftPanelX + kPanelW / 2;
    gainKnob.setBounds(leftCx - knobSz / 2, kPanelTop + 22, knobSz, knobSz);
    gainLabel.setBounds(leftPanelX + 12, kPanelTop + 22 + knobSz + 2, kPanelW - 24, 20);

    const int btnRowY = kPanelTop + 212;
    muteButton.setBounds(leftPanelX + 14, btnRowY, 62, 28);
    monitorButton.setBounds(leftPanelX + 80, btnRowY, 106, 28);
    talkbackButton.setBounds(leftPanelX + 14, btnRowY + 34, kPanelW - 28, 28);

    const int rightCx = rightPanelX + kPanelW / 2;
    inputGainKnob.setBounds(rightCx - knobSz / 2, kPanelTop + 22, knobSz, knobSz);
    inputGainLabel.setBounds(rightPanelX + 12, kPanelTop + 22 + knobSz + 2, kPanelW - 24, 20);
    inputMuteButton.setBounds(rightCx - 58, btnRowY, 116, 28);

    const int cx = layoutCenterX() + kCenterW / 2;
    const int cy = kPanelTop + kPanelH / 2;
    const int liveSide = 176;
    liveButtonBounds = juce::Rectangle<int>(cx - liveSide / 2, cy - liveSide / 2, liveSide, liveSide);

    gainKnob.toFront(false);
    gainLabel.toFront(false);
    muteButton.toFront(false);
    monitorButton.toFront(false);
    talkbackButton.toFront(false);
    inputGainKnob.toFront(false);
    inputGainLabel.toFront(false);
    inputMuteButton.toFront(false);
    controlStatusLabel.toFront(false);
    sessionCodeEditor.toFront(false);
    accessTokenEditor.toFront(false);
    fetchSessionButton.toFront(false);
    sessionSyncStatusLabel.toFront(false);
}

void WStudioPluginAudioProcessorEditor::mouseUp(const juce::MouseEvent& event)
{
    // Dev / internal: Cmd-click the title to flip Engineer vs Artist until a shipped role control exists.
    if (titleLabel.getBounds().contains(event.getPosition()) && event.mods.isCommandDown())
    {
        const auto nextRole =
            session->getUserRole() == UserRole::Engineer ? UserRole::Artist : UserRole::Engineer;
        session->setUserRole(nextRole);
        syncTalkbackWithRole();
        refreshHeaderLabelsFromSession();
        refreshControlButtonLabels();
        updatePriorityControlStatus();
        repaint();
        return;
    }

    if (!liveButtonBounds.contains(event.getPosition()))
        return;

    session->onLiveRegionClicked();
    syncTalkbackWithRole();
    refreshHeaderLabelsFromSession();
    refreshControlButtonLabels();
    updatePriorityControlStatus();
    repaint();
}

void WStudioPluginAudioProcessorEditor::timerCallback()
{
    leftMeterLevel = audioProcessor.getLeftLevel();
    rightMeterLevel = audioProcessor.getRightLevel();

    constexpr float smooth = 0.78f;
    smoothedLeft = smoothedLeft * smooth + leftMeterLevel * (1.0f - smooth);
    smoothedRight = smoothedRight * smooth + rightMeterLevel * (1.0f - smooth);

    session->tick();
    syncTalkbackWithRole();
    refreshHeaderLabelsFromSession();
    refreshControlButtonLabels();
    updatePriorityControlStatus();

    repaint();
}
