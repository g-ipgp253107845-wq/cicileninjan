import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function stripDataUrlPrefix(imageBase64: string): { mimeType: string; data: string } {
  const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: "image/jpeg", data: imageBase64 };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "12mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "SmartPack" });
  });

  app.post("/api/scan-luggage", async (req: Request, res: Response) => {
    try {
      const { imageBase64, hintType } = req.body as {
        imageBase64?: string;
        hintType?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== "string") {
        res.status(400).json({ error: "An image capture or upload is required." });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            "Gemini API key is not configured in environment secrets. Please adjust dimensions manually below.",
        });
        return;
      }

      const { mimeType, data } = stripDataUrlPrefix(imageBase64);
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data,
              },
            },
            {
              text:
                "Analyze this luggage/suitcase photo. Estimate its external dimensions in centimeters (height/length, width, depth/thickness), classify whether it looks like a 'carry-on' or 'checked' suitcase, estimate empty weight in kg, and give a realistic measurement confidence percentage (usually 55-82% from a single 2D photo due to perspective distortion and lack of physical reference scale). " +
                (hintType ? `User hint: ${hintType}.` : ""),
            },
          ],
        },
        config: {
          systemInstruction:
            "You are a geometric computer-vision luggage measurement assistant. Be realistic and honest about single-image estimation uncertainty; never claim 100% accuracy.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedName: { type: Type.STRING },
              luggageType: { type: Type.STRING, enum: ["carry-on", "checked"] },
              lengthCm: { type: Type.NUMBER },
              widthCm: { type: Type.NUMBER },
              heightCm: { type: Type.NUMBER },
              emptyWeightKg: { type: Type.NUMBER },
              confidencePct: { type: Type.NUMBER },
              shellNotes: { type: Type.STRING },
              measurementNote: { type: Type.STRING },
            },
            required: [
              "detectedName",
              "luggageType",
              "lengthCm",
              "widthCm",
              "heightCm",
              "emptyWeightKg",
              "confidencePct",
              "shellNotes",
              "measurementNote",
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Luggage analysis failed.";
      const status =
        typeof (err as { status?: number })?.status === "number"
          ? (err as { status: number }).status
          : 500;
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  app.post("/api/scan-item", async (req: Request, res: Response) => {
    try {
      const { imageBase64 } = req.body as { imageBase64?: string };

      if (!imageBase64 || typeof imageBase64 !== "string") {
        res.status(400).json({ error: "An image capture or upload is required." });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            "Gemini API key is not configured in environment secrets. Use manual entry or quick presets instead.",
        });
        return;
      }

      const { mimeType, data } = stripDataUrlPrefix(imageBase64);
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data,
              },
            },
            {
              text: "Identify the primary travel item in this photo for luggage packing. Classify it into one of these exact categories: 'T-shirts & Shirts', 'Trousers & Jeans', 'Dresses', 'Jackets', 'Shoes', 'Toiletries', 'Towels', 'Accessories', 'Electronic Devices', 'Other Personal Belongings'. Estimate practical folded or packed dimensions in centimeters (lengthCm, widthCm, heightCm), weight in kg, suggested quantity, geometric shape ('box', 'cylinder', or 'compressible_prism'), compressibility (0 for rigid, 0.15-0.35 for soft fabrics), liquidMl (0 if not liquid, or ml estimate if toiletry liquid), and confidence percentage (60-90%).",
            },
          ],
        },
        config: {
          systemInstruction:
            "You are a travel packing geometry assistant. Return realistic folded/packed travel dimensions in centimeters and weights in kilograms.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: {
                type: Type.STRING,
                enum: [
                  "T-shirts & Shirts",
                  "Trousers & Jeans",
                  "Dresses",
                  "Jackets",
                  "Shoes",
                  "Toiletries",
                  "Towels",
                  "Accessories",
                  "Electronic Devices",
                  "Other Personal Belongings",
                ],
              },
              quantity: { type: Type.INTEGER },
              lengthCm: { type: Type.NUMBER },
              widthCm: { type: Type.NUMBER },
              heightCm: { type: Type.NUMBER },
              weightKg: { type: Type.NUMBER },
              shape: { type: Type.STRING, enum: ["box", "cylinder", "compressible_prism"] },
              compressibility: { type: Type.NUMBER },
              liquidMl: { type: Type.NUMBER },
              confidencePct: { type: Type.NUMBER },
              estimationNote: { type: Type.STRING },
            },
            required: [
              "name",
              "category",
              "quantity",
              "lengthCm",
              "widthCm",
              "heightCm",
              "weightKg",
              "shape",
              "compressibility",
              "liquidMl",
              "confidencePct",
              "estimationNote",
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Item recognition failed.";
      const status =
        typeof (err as { status?: number })?.status === "number"
          ? (err as { status: number }).status
          : 500;
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SmartPack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
