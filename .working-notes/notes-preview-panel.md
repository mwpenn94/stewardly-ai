# Preview Panel - Working

The Preview tab shows the assembled AI configuration from all 5 layers:
- Active Layers: L1: Platform (checked), L5: User (empty)
- Resolved values: Tone=professional, Format=mixed, Length=standard, Temperature=0.70
- Ensemble Weights: default: 100%
- Active Guardrails (5): Never provide specific investment recommendations without suitability data, Never share other users data, Never impersonate a licensed professional, Always include disclaimers for financial advice, Never generate harmful or illegal content
- Prompt Overlays (1 layer): L1-Platform with the base system prompt
- Full Assembled Overlay Prompt showing the XML-structured prompt with layer_overlays and response_style sections
- The resolution engine is working correctly, pulling from the seeded platform settings
