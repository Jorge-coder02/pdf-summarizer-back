import express from "express";
import cors from "cors";
import multer from "multer";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());

app.use(express.json());

// Multer config para guardar en 'uploads/'
const upload = multer({ dest: "uploads/" });

// GET para prueba msg
app.get("/", async (_, res) => {
  res.status(400).json({ respuesta: "Todo en orden" });
});

// POST /upload
// Recibe un archivo PDF, lo lee y lo resume usando CohereAI
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("req.file:", req.file);
    if (!req.file) {
      return res.status(400).json({ error: "No se envió ningún archivo" });
    }

    const filePath = req.file.path; // Ruta del archivo temporal subido

    // Extraer texto del PDF
    const inputText = await extractTextFromPDF(filePath);

    // Eliminar el archivo temporal
    await fs.unlink(filePath);

    // Llamada a Cohere
    const summary = await getSummaryFromCohere(inputText);

    return res.json({ summary });
  } catch (err) {
    console.error("❌ ERROR en /upload:", err);
    res
      .status(500)
      .json({ error: "Error interno en servidor", details: err.message });
  }
});

// Función para extraer texto de un PDF
async function extractTextFromPDF(filePath) {
  try {
    console.log("Leyendo PDF desde:", filePath);
    const fileBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(fileBuffer);
    const MAX_TOKENS = 8000;
    return pdfData.text.slice(0, MAX_TOKENS);
  } catch (error) {
    console.error("Error en extractTextFromPDF:", error.stack);
    throw error;
  }
}

// Función para llamar a la API de Cohere con el contenido del PDF
async function getSummaryFromCohere(text) {
  const inputText = `Idioma: Español\nFormato: párrafo\nResumen:\n\n${text}`;

  try {
    const response = await axios.post(
      "https://api.cohere.ai/v1/summarize",
      {
        text: inputText,
        length: "medium",
        format: "paragraph",
        model: "summarize-xlarge",
        extractiveness: "auto",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // const textoTranslated = await translateToSpanish(response.data.summary);
    // return textoTranslated;
    return response.data.summary;
  } catch (err) {
    console.error("❌ ERROR en getSummaryFromCohere:", err);
    throw err; // lanza para que el catch del endpoint lo gestione
  }
}

export async function translateToSpanish(text) {
  const res = await axios.post("https://de.libretranslate.com/translate", {
    q: text,
    source: "en",
    target: "es",
    format: "text",
  });

  return res.data.translatedText;
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en ${PORT}`);
  console.log("COHERE KEY:", process.env.COHERE_API_KEY);
  console.log("FRONTEND URL:", process.env.FRONTEND_URL);
});
