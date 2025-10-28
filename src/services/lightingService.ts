import axios from 'axios';

class LightingService {
  private readonly API_URL: string;
  private readonly API_KEY: string;

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    this.API_KEY = apiKey;
    this.API_URL = 'https://api.openai.com/v1/chat/completions';
  }

  async getLightingSuggestion(base64Image: string): Promise<string> {
    const lightingReference = `Use this detailed lighting reference for placement decisions:

1. Recessed Light
- Description: Flush-mounted in ceiling. Light shines down.
- Purpose: General overhead illumination, can create harsh shadows.

2. Step Light
- Description: Mounted low on wall, angled at floor.
- Purpose: Wayfinding at night; good for stairs or hallways.

3. Presence Sensor
- Description: In-wall sensor with 120° cone of detection.
- Purpose: Adjusts lighting based on motion/activity zones.

4. Spot Light
- Description: Directional light with narrow cone.
- Purpose: Highlights walls, art, or features without drawing attention to the light.

5. Pendant Light
- Description: Hanging fixture above surfaces.
- Purpose: Task lighting for tables, counters; adds focal points.

6. Tape Light
- Description: Hidden strip light for indirect glow.
- Purpose: Adds ambient fill, soft wall/shelf wash, or corner accenting.`;

    const userPrompt = `
You are a lighting assistant. Given this room image and the lighting reference, suggest optimal lighting placement.

Please follow these strict rules for the response:
- Respond with pure JSON only — no text, no code block, no explanation.
- Each light object must contain:
  - "light_id": one of the numeric IDs from the reference (e.g., "1", "2", ..., "6")
  - "x": x coordinate in **pixels** relative to the image you see
  - "y": y coordinate in **pixels** relative to the image you see
  - "reason": a short explanation for placement
  - "name": name from thr refrence (e.g., "Recessed","Spot") dont add light with the name
- Use only the numeric IDs from the reference list.
- Do not normalize coordinates. Provide raw pixel values based on the image.
- get the image size in pixels and give x and y inside those pixels
- (0,0) cordinates will be the top left of the image
`;

    const response = await axios.post(
      this.API_URL,
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: lightingReference,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 800,
      },
      {
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  }
}

export const lightingService = new LightingService();
