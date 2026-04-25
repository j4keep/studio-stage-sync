#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"
#include "Session/SessionController.h"

/** Skeuomorphic controls — W.STUDIO cyan/charcoal palette. */
class WStudioLookAndFeel : public juce::LookAndFeel_V4
{
public:
    void drawRotarySlider(juce::Graphics& g, int x, int y, int w, int h, float sliderPosProportional,
                          float rotaryStartAngle, float rotaryEndAngle, juce::Slider& slider) override;

    void drawButtonBackground(juce::Graphics& g, juce::Button& button, const juce::Colour& backgroundColour,
                              bool shouldDrawButtonAsHighlighted, bool shouldDrawButtonAsDown) override;
};

/**
 * Layout + painting only. Session / mock networking lives in SessionController (message thread).
 */
class WStudioPluginAudioProcessorEditor : public juce::AudioProcessorEditor, private juce::Timer
{
public:
    explicit WStudioPluginAudioProcessorEditor(WStudioPluginAudioProcessor&);
    ~WStudioPluginAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;
    void mouseUp(const juce::MouseEvent& event) override;
    void timerCallback() override;

private:
    void drawStereoMeters(juce::Graphics& g, int leftBarX, int rightBarX, int y, int barW, int barH,
                          juce::Colour meterAccent) const;
    void refreshHeaderLabelsFromSession();
    void refreshControlButtonLabels();
    void updatePriorityControlStatus();
    void syncTalkbackWithRole();

    /** Highest-priority active routing hint (output mute > mic > talkback > monitor). */
    juce::String computePriorityControlStatusMessage() const;

    WStudioPluginAudioProcessor& audioProcessor;
    WStudioLookAndFeel lnf;

    std::unique_ptr<SessionController> session;

    juce::Slider gainKnob;
    juce::Label gainLabel;

    juce::TextButton muteButton;
    juce::TextButton monitorButton;
    juce::TextButton talkbackButton;

    juce::Slider inputGainKnob;
    juce::Label inputGainLabel;
    juce::TextButton inputMuteButton;

    juce::Label titleLabel;
    juce::Label statusLabel;
    juce::Label artistLabel;
    juce::Label controlStatusLabel;

    juce::TextEditor sessionCodeEditor;
    juce::TextEditor accessTokenEditor;
    juce::TextButton fetchSessionButton;
    juce::Label sessionSyncStatusLabel;

    juce::Rectangle<int> liveButtonBounds;
    juce::Rectangle<float> centerPanelFloat;

    int leftStereoLabelY = 0;
    int rightStereoLabelY = 0;
    int leftLrLabelY = 0;
    int rightLrLabelY = 0;
    int leftMeterLeftX = 0;
    int leftMeterRightX = 0;
    int rightMeterLeftX = 0;
    int rightMeterRightX = 0;
    int meterBarW = 30;
    int meterBarH = 168;
    int meterBarY = 0;

    float leftMeterLevel = 0.0f;
    float rightMeterLevel = 0.0f;
    float smoothedLeft = 0.f;
    float smoothedRight = 0.f;

    /** Tiled subtle grain — breaks up flat “prototype” fills. */
    juce::Image filmGrainTile;

    using APVTS = juce::AudioProcessorValueTreeState;
    std::unique_ptr<APVTS::SliderAttachment> gainAttachment;
    std::unique_ptr<APVTS::SliderAttachment> inputGainAttachment;
    std::unique_ptr<APVTS::ButtonAttachment> muteAttachment;
    std::unique_ptr<APVTS::ButtonAttachment> monitorAttachment;
    std::unique_ptr<APVTS::ButtonAttachment> talkbackAttachment;
    std::unique_ptr<APVTS::ButtonAttachment> inputMuteAttachment;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(WStudioPluginAudioProcessorEditor)
};
